import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock dockerode ───────────────────────────────────────────────────────────
// vi.mock must appear at top level. The mock must be a class (constructor) to work
// when ContainerManager does `new Docker(...)`.

const mockContainerStart = vi.fn().mockResolvedValue(undefined);
const mockContainerInspect = vi.fn().mockResolvedValue({
  NetworkSettings: {
    Ports: {
      "3001/tcp": [{ HostPort: "54321" }],
    },
  },
});
const mockContainerRemove = vi.fn().mockResolvedValue(undefined);

const mockContainer = {
  id: "mock-container-id-abc123",
  start: mockContainerStart,
  inspect: mockContainerInspect,
  remove: mockContainerRemove,
};

const mockCreateContainer = vi.fn().mockResolvedValue(mockContainer);
const mockListContainers = vi.fn().mockResolvedValue([]);
const mockGetContainer = vi.fn().mockReturnValue(mockContainer);

vi.mock("dockerode", () => {
  // Must export a class (constructor) as the default export
  class MockDocker {
    constructor(_opts: unknown) {}
    createContainer = mockCreateContainer;
    listContainers = mockListContainers;
    getContainer = mockGetContainer;
  }
  return { default: MockDocker };
});

// Import after mocking
import { ContainerManager } from "../container-manager.js";

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("ContainerManager", () => {
  let manager: ContainerManager;

  beforeEach(() => {
    vi.clearAllMocks();
    // Re-wire defaults after clearAllMocks
    mockCreateContainer.mockResolvedValue(mockContainer);
    mockContainerStart.mockResolvedValue(undefined);
    mockContainerInspect.mockResolvedValue({
      NetworkSettings: {
        Ports: {
          "3001/tcp": [{ HostPort: "54321" }],
        },
      },
    });
    mockContainerRemove.mockResolvedValue(undefined);
    mockListContainers.mockResolvedValue([]);
    mockGetContainer.mockReturnValue(mockContainer);

    manager = new ContainerManager("/var/run/docker.sock");
  });

  const defaultConfig = {
    sessionId: "test-session-123",
    workspaceDir: "/workspace/test-session-123",
    controlPort: 3001,
    memoryBytes: 4 * 1024 * 1024 * 1024,
    nanoCpus: 2_000_000_000,
    diskSizeGb: 10,
    wallClockTimeoutMs: 30 * 60 * 1000,
    idleTimeoutMs: 30 * 60 * 1000,
    costBudgetUsd: 5,
  };

  describe("createSessionContainer", () => {
    it("calls docker.createContainer with correct resource limits", async () => {
      await manager.createSessionContainer(defaultConfig, 9100);

      expect(mockCreateContainer).toHaveBeenCalledOnce();
      const createArgs = mockCreateContainer.mock.calls[0]?.[0] as Record<string, unknown>;
      const hostConfig = createArgs["HostConfig"] as Record<string, unknown>;
      expect(hostConfig["Memory"]).toBe(4 * 1024 * 1024 * 1024);
      expect(hostConfig["MemorySwap"]).toBe(4 * 1024 * 1024 * 1024);
      expect(hostConfig["NanoCpus"]).toBe(2_000_000_000);
    });

    it("calls docker.createContainer with correct labels", async () => {
      const config = { ...defaultConfig, sessionId: "test-session-abc" };
      await manager.createSessionContainer(config, 9100);

      const createArgs = mockCreateContainer.mock.calls[0]?.[0] as Record<string, unknown>;
      const labels = createArgs["Labels"] as Record<string, string>;
      expect(labels["Northwall.managed"]).toBe("true");
      expect(labels["Northwall.session"]).toBe("test-session-abc");
    });

    it("sets ANTHROPIC_API_KEY with session-specific placeholder (not static string)", async () => {
      const config = { ...defaultConfig, sessionId: "unique-session-xyz" };
      await manager.createSessionContainer(config, 9100);

      const createArgs = mockCreateContainer.mock.calls[0]?.[0] as Record<string, unknown>;
      const env = createArgs["Env"] as string[];

      // Must use session-specific placeholder
      expect(env).toContain("ANTHROPIC_API_KEY=session-unique-session-xyz");
      // Must NOT use a static placeholder
      expect(env).not.toContain("ANTHROPIC_API_KEY=proxy-key-placeholder");
    });

    it("sets ANTHROPIC_BASE_URL pointing to credential proxy on host", async () => {
      const config = { ...defaultConfig, sessionId: "test-session-proxy" };
      await manager.createSessionContainer(config, 9100);

      const createArgs = mockCreateContainer.mock.calls[0]?.[0] as Record<string, unknown>;
      const env = createArgs["Env"] as string[];

      const baseUrlEntry = env.find((e) => e.startsWith("ANTHROPIC_BASE_URL="));
      expect(baseUrlEntry).toBeDefined();
      expect(baseUrlEntry).toContain("host.docker.internal");
      expect(baseUrlEntry).toContain("9100");
    });

    it("sets NET_ADMIN cap and drops all caps", async () => {
      await manager.createSessionContainer(defaultConfig, 9100);

      const createArgs = mockCreateContainer.mock.calls[0]?.[0] as Record<string, unknown>;
      const hostConfig = createArgs["HostConfig"] as Record<string, unknown>;
      expect(hostConfig["CapAdd"]).toContain("NET_ADMIN");
      expect(hostConfig["CapDrop"]).toContain("ALL");
    });

    it("returns ContainerInfo with containerId, hostPort, authToken", async () => {
      const info = await manager.createSessionContainer(defaultConfig, 9100);

      expect(info.containerId).toBe("mock-container-id-abc123");
      expect(info.hostPort).toBe(54321);
      expect(info.authToken).toBeDefined();
      expect(info.authToken.length).toBeGreaterThan(16);
      expect(info.sessionId).toBe("test-session-123");
    });
  });

  describe("destroySessionContainer", () => {
    it("calls container.remove with force:true", async () => {
      const info = await manager.createSessionContainer(defaultConfig, 9100);
      await manager.destroySessionContainer(info.containerId);

      expect(mockContainerRemove).toHaveBeenCalledWith({ force: true });
    });

    it("does not throw if container.remove throws", async () => {
      mockGetContainer.mockReturnValue({
        remove: vi.fn().mockRejectedValue(new Error("container not found")),
      });

      await expect(manager.destroySessionContainer("nonexistent-id")).resolves.not.toThrow();
    });
  });

  describe("sweepOrphans", () => {
    it("lists containers with Northwall.managed=true label", async () => {
      await manager.sweepOrphans();

      expect(mockListContainers).toHaveBeenCalledWith(
        expect.objectContaining({
          all: true,
          filters: expect.stringContaining("Northwall.managed"),
        }),
      );
    });

    it("removes all found orphan containers", async () => {
      const orphan1Remove = vi.fn().mockResolvedValue(undefined);
      const orphan2Remove = vi.fn().mockResolvedValue(undefined);

      mockListContainers.mockResolvedValueOnce([{ Id: "orphan-1" }, { Id: "orphan-2" }]);
      mockGetContainer.mockImplementation((id: string) => {
        if (id === "orphan-1") return { remove: orphan1Remove };
        if (id === "orphan-2") return { remove: orphan2Remove };
        return { remove: vi.fn() };
      });

      const count = await manager.sweepOrphans();

      expect(count).toBe(2);
      expect(orphan1Remove).toHaveBeenCalledWith({ force: true });
      expect(orphan2Remove).toHaveBeenCalledWith({ force: true });
    });

    it("returns 0 when no orphans found", async () => {
      mockListContainers.mockResolvedValueOnce([]);
      const count = await manager.sweepOrphans();
      expect(count).toBe(0);
    });
  });
});
