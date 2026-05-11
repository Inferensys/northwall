import { Hono } from "hono";
import { z } from "zod";
import type { ExplorationActivity } from "@northwall/agent-runtime";
import type { MissionManager } from "../services/mission-manager.js";

export function missionsRouter(missionManager: MissionManager) {
  const router = new Hono();

  // Helper: check mission exists and belongs to user
  function checkOwnership(missionId: string, userId: string) {
    const mission = missionManager.getMission(missionId);
    if (!mission) return { error: "Mission not found", status: 404 as const };
    if (mission.userId && mission.userId !== userId) {
      return { error: "Forbidden", status: 403 as const };
    }
    return { mission };
  }

  // List missions for the authenticated user
  router.get("/", (c) => {
    const { userId } = c.var.auth;
    const missions = missionManager.listMissions(userId);
    return c.json({ missions });
  });

  // Create a new mission
  router.post("/", (c) => {
    const { userId } = c.var.auth;
    const mission = missionManager.createMission(userId);
    return c.json({ mission }, 201);
  });

  // Get a mission by ID
  router.get("/:id", (c) => {
    const result = checkOwnership(c.req.param("id"), c.var.auth.userId);
    if ("error" in result) return c.json({ error: result.error }, result.status);
    return c.json({ mission: result.mission });
  });

  // Explore — send a message during exploration phase
  router.post("/:id/explore", async (c) => {
    const id = c.req.param("id");
    const result = checkOwnership(id, c.var.auth.userId);
    if ("error" in result) return c.json({ error: result.error }, result.status);

    const body = await c.req.json();

    const schema = z.object({ content: z.string().min(1) });
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: parsed.error.issues }, 400);
    }

    try {
      const activities: ExplorationActivity[] = [];
      const exploreResult = await missionManager.exploreMission(
        id,
        parsed.data.content,
        (activity) => activities.push(activity),
      );
      return c.json({ ...exploreResult, activities });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return c.json({ error: message }, 400);
    }
  });

  // Begin planning — transition from exploring to plan generation
  router.post("/:id/begin-planning", async (c) => {
    const id = c.req.param("id");
    const result = checkOwnership(id, c.var.auth.userId);
    if ("error" in result) return c.json({ error: result.error }, result.status);

    try {
      const mission = await missionManager.beginPlanning(id);
      return c.json({ mission });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return c.json({ error: message }, 400);
    }
  });

  // Send a chat message (planner responds during planning, engine during running)
  router.post("/:id/chat", async (c) => {
    const id = c.req.param("id");
    const result = checkOwnership(id, c.var.auth.userId);
    if ("error" in result) return c.json({ error: result.error }, result.status);

    const body = await c.req.json();

    const schema = z.object({ content: z.string().min(1) });
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: parsed.error.issues }, 400);
    }

    try {
      const chatResult = await missionManager.planMission(id, parsed.data.content);
      return c.json(chatResult);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return c.json({ error: message }, 400);
    }
  });

  // Approve plan and start execution
  router.post("/:id/approve", async (c) => {
    const id = c.req.param("id");
    const result = checkOwnership(id, c.var.auth.userId);
    if ("error" in result) return c.json({ error: result.error }, result.status);

    try {
      await missionManager.approvePlan(id);
      const mission = missionManager.getMission(id);
      return c.json({ mission });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return c.json({ error: message }, 400);
    }
  });

  // Send a message during execution
  router.post("/:id/message", async (c) => {
    const id = c.req.param("id");
    const result = checkOwnership(id, c.var.auth.userId);
    if ("error" in result) return c.json({ error: result.error }, result.status);

    const body = await c.req.json();

    const schema = z.object({ content: z.string().min(1) });
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: parsed.error.issues }, 400);
    }

    try {
      const message = await missionManager.sendMessage(id, parsed.data.content);
      return c.json({ message });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return c.json({ error: msg }, 400);
    }
  });

  // Get events
  router.get("/:id/events", (c) => {
    const id = c.req.param("id");
    const result = checkOwnership(id, c.var.auth.userId);
    if ("error" in result) return c.json({ error: result.error }, result.status);

    const since = c.req.query("since")
      ? parseInt(c.req.query("since")!, 10)
      : undefined;
    const limit = c.req.query("limit")
      ? parseInt(c.req.query("limit")!, 10)
      : undefined;

    const events = missionManager.getEvents(id, since, limit);
    return c.json({ events });
  });

  // Get chat history
  router.get("/:id/chat", (c) => {
    const id = c.req.param("id");
    const result = checkOwnership(id, c.var.auth.userId);
    if ("error" in result) return c.json({ error: result.error }, result.status);

    const chat = missionManager.getChat(id);
    return c.json({ chat });
  });

  // Get raw SDK messages (for hydration on reconnect)
  router.get("/:id/sdk-messages", (c) => {
    const id = c.req.param("id");
    const result = checkOwnership(id, c.var.auth.userId);
    if ("error" in result) return c.json({ error: result.error }, result.status);

    const sdkMessages = missionManager.getSDKMessages(id);
    return c.json({ sdkMessages });
  });

  // List workspace files
  router.get("/:id/files", async (c) => {
    const id = c.req.param("id");
    const result = checkOwnership(id, c.var.auth.userId);
    if ("error" in result) return c.json({ error: result.error }, result.status);

    const dir = c.req.query("dir") || undefined;
    const files = await missionManager.listWorkspaceFiles(id, dir);
    return c.json({ files });
  });

  // Read a workspace file
  router.get("/:id/files/read", async (c) => {
    const id = c.req.param("id");
    const result = checkOwnership(id, c.var.auth.userId);
    if ("error" in result) return c.json({ error: result.error }, result.status);

    const filePath = c.req.query("path");

    if (!filePath) {
      return c.json({ error: "path query parameter is required" }, 400);
    }

    const content = await missionManager.readWorkspaceFile(id, filePath);
    if (content === null) {
      return c.json({ error: "File not found or workspace unavailable" }, 404);
    }

    return c.json({ path: filePath, content });
  });

  // Get container info (VNC URL, status)
  router.get("/:id/container", (c) => {
    const id = c.req.param("id");
    const result = checkOwnership(id, c.var.auth.userId);
    if ("error" in result) return c.json({ error: result.error }, result.status);

    const info = missionManager.getContainerInfo(id);
    return c.json(info);
  });

  // Relay credentials to container agent
  router.post("/:id/credential", async (c) => {
    const id = c.req.param("id");
    const result = checkOwnership(id, c.var.auth.userId);
    if ("error" in result) return c.json({ error: result.error }, result.status);

    const body = await c.req.json();

    const schema = z.object({
      requestId: z.string().min(1),
      credentials: z.record(z.string(), z.string()),
    });
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: parsed.error.issues }, 400);
    }

    try {
      await missionManager.relayCredential(id, parsed.data);
      return c.json({ status: "relayed" });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return c.json({ error: message }, 400);
    }
  });

  return router;
}
