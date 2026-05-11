import { Hono } from "hono";
import { z } from "zod";
import type { AssessmentManager } from "../services/assessment-manager.js";

export function githubRouter(assessmentManager: AssessmentManager) {
  const router = new Hono();

  router.get("/connection", async (c) => {
    const { userId } = c.var.auth;
    const connection = await assessmentManager.getConnection(userId);
    return c.json({ connection });
  });

  router.post("/connect", async (c) => {
    const { userId } = c.var.auth;
    const body = await c.req.json();
    const parsed = z.object({ token: z.string().min(1) }).safeParse(body);
    if (!parsed.success) return c.json({ error: parsed.error.issues }, 400);

    try {
      const connection = await assessmentManager.connectGitHub(userId, parsed.data.token);
      return c.json({ connection });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return c.json({ error: message }, 400);
    }
  });

  router.get("/repos", async (c) => {
    const { userId } = c.var.auth;
    try {
      const repos = await assessmentManager.listRepos(userId);
      return c.json({ repos });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return c.json({ error: message }, 400);
    }
  });

  return router;
}
