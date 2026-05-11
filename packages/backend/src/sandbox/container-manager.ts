import Docker from "dockerode";
import { nanoid } from "nanoid";
import type { SandboxConfig, ContainerInfo } from "@northwall/shared";
import fs from "node:fs/promises";
import path from "node:path";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";

const CONTAINER_IMAGE = "northwall-agent-control:latest";
const CONTROL_PORT_INTERNAL = 3001;
const MAX_WAIT_MS = 15_000;

export class ContainerManager {
  private docker: Docker;
  // Track created containers by containerId for destroy operations
  private containers = new Map<string, Docker.Container>();

  constructor(dockerSocket = "/var/run/docker.sock") {
    this.docker = new Docker({ socketPath: dockerSocket });
  }

  async createSessionContainer(config: SandboxConfig, proxyPort: number): Promise<ContainerInfo> {
    const authToken = nanoid(32);

    const container = await this.docker.createContainer({
      Image: CONTAINER_IMAGE,
      Labels: {
        "Northwall.managed": "true",
        "Northwall.session": config.sessionId,
      },
      Env: [
        `CONTROL_AUTH_TOKEN=${authToken}`,
        `WORKSPACE_DIR=${config.workspaceDir}`,
        // Session-specific placeholder key. The credential proxy uses
        // this value to identify the session and route to the correct API key.
        `ANTHROPIC_API_KEY=session-${config.sessionId}`,
        // Route all SDK API calls through the credential proxy on the host
        `ANTHROPIC_BASE_URL=http://host.docker.internal:${proxyPort}`,
      ],
      HostConfig: {
        Memory: config.memoryBytes,
        MemorySwap: config.memoryBytes, // No swap (MemorySwap == Memory)
        NanoCpus: config.nanoCpus,
        PortBindings: {
          [`${CONTROL_PORT_INTERNAL}/tcp`]: [{ HostPort: "0" }], // Docker assigns free port
        },
        // Linux compat: allow container to reach host.docker.internal
        ExtraHosts: ["host.docker.internal:host-gateway"],
        // Security: add only NET_ADMIN, drop everything else, no new privileges
        CapAdd: ["NET_ADMIN"],
        CapDrop: ["ALL"],
        SecurityOpt: ["no-new-privileges"],
      },
    });

    await container.start();

    // Inspect to get Docker-assigned host port
    const inspectData = await container.inspect();
    const portBindings = inspectData.NetworkSettings?.Ports?.[`${CONTROL_PORT_INTERNAL}/tcp`];
    if (!portBindings || portBindings.length === 0) {
      await container.remove({ force: true });
      throw new Error(`Container started but no port binding found for ${CONTROL_PORT_INTERNAL}/tcp`);
    }

    const hostPortStr = portBindings[0]?.HostPort;
    if (!hostPortStr) {
      await container.remove({ force: true });
      throw new Error(`Container started but HostPort is undefined`);
    }
    const hostPort = parseInt(hostPortStr, 10);

    // Track container for future operations
    this.containers.set(container.id, container);

    const info: ContainerInfo = {
      containerId: container.id,
      sessionId: config.sessionId,
      hostPort,
      authToken,
      createdAt: Date.now(),
    };

    return info;
  }

  async destroySessionContainer(containerId: string): Promise<void> {
    try {
      // Use tracked container or get a reference from docker
      let container = this.containers.get(containerId);
      if (!container) {
        container = this.docker.getContainer(containerId);
      }
      await container.remove({ force: true });
      this.containers.delete(containerId);
    } catch (err) {
      // Log and swallow — container may already be gone (crashed, manual removal)
      console.warn(`ContainerManager.destroySessionContainer: could not remove ${containerId}:`, err);
    }
  }

  async sweepOrphans(): Promise<number> {
    const orphans = await this.docker.listContainers({
      all: true,
      filters: JSON.stringify({ label: ["Northwall.managed=true"] }),
    });

    let count = 0;
    for (const c of orphans) {
      try {
        const container = this.docker.getContainer(c.Id);
        await container.remove({ force: true });
        count++;
      } catch (err) {
        console.warn(`ContainerManager.sweepOrphans: failed to remove ${c.Id}:`, err);
      }
    }

    if (count > 0) {
      console.log(`ContainerManager: swept ${count} orphan container(s)`);
    }

    return count;
  }

  async waitForReady(hostPort: number, authToken: string, maxWaitMs = MAX_WAIT_MS): Promise<void> {
    const startTime = Date.now();
    let delay = 100;

    while (true) {
      try {
        const res = await fetch(`http://localhost:${hostPort}/status`, {
          headers: { "x-control-token": authToken },
        });
        if (res.ok) return;
      } catch {
        // Connection refused — container not ready yet
      }

      const elapsed = Date.now() - startTime;
      if (elapsed + delay >= maxWaitMs) {
        throw new Error(
          `ContainerManager.waitForReady: control server on port ${hostPort} did not become ready within ${maxWaitMs}ms`,
        );
      }

      await new Promise((resolve) => setTimeout(resolve, delay));
      delay = Math.min(delay * 2, 2000);
    }
  }

  async copyWorkspaceFromContainer(
    containerId: string,
    containerPath: string,
    hostPath: string,
  ): Promise<void> {
    let container = this.containers.get(containerId);
    if (!container) {
      container = this.docker.getContainer(containerId);
    }

    await fs.mkdir(hostPath, { recursive: true });

    const stream = await container.getArchive({ path: containerPath });
    const outputPath = path.join(hostPath, "workspace.tar");
    await pipeline(stream as NodeJS.ReadableStream, createWriteStream(outputPath));
  }
}
