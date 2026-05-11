import { Hono } from "hono";
import { z } from "zod";
import { GitHubRepository } from "@northwall/shared";
import type { AssessmentManager } from "../services/assessment-manager.js";

function ownership(assessmentManager: AssessmentManager, id: string, userId: string) {
  const assessment = assessmentManager.getAssessment(id);
  if (!assessment) return { error: "Assessment not found", status: 404 as const };
  if (assessment.userId && assessment.userId !== userId) return { error: "Forbidden", status: 403 as const };
  return { assessment };
}

export function assessmentsRouter(assessmentManager: AssessmentManager) {
  const router = new Hono();

  router.get("/", (c) => {
    const { userId } = c.var.auth;
    return c.json({ assessments: assessmentManager.listAssessments(userId) });
  });

  router.post("/", async (c) => {
    const { userId } = c.var.auth;
    const body = await c.req.json();
    const parsed = z.object({
      repository: GitHubRepository,
      branch: z.string().min(1).optional(),
    }).safeParse(body);
    if (!parsed.success) return c.json({ error: parsed.error.issues }, 400);

    const assessment = await assessmentManager.createAssessment(
      userId,
      parsed.data.repository,
      parsed.data.branch,
    );
    return c.json({ assessment }, 201);
  });

  router.get("/:id", (c) => {
    const result = ownership(assessmentManager, c.req.param("id"), c.var.auth.userId);
    if ("error" in result) return c.json({ error: result.error }, result.status);
    return c.json({ assessment: result.assessment });
  });

  router.get("/:id/events", (c) => {
    const id = c.req.param("id");
    const result = ownership(assessmentManager, id, c.var.auth.userId);
    if ("error" in result) return c.json({ error: result.error }, result.status);
    return c.json({ events: assessmentManager.getEvents(id) });
  });

  router.post("/:id/understand", async (c) => {
    try {
      const assessment = await assessmentManager.understand(c.req.param("id"), c.var.auth.userId);
      return c.json({ assessment });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return c.json({ error: message }, message === "Forbidden" ? 403 : 400);
    }
  });

  router.post("/:id/plan", async (c) => {
    try {
      const assessment = await assessmentManager.plan(c.req.param("id"), c.var.auth.userId);
      return c.json({ assessment });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return c.json({ error: message }, message === "Forbidden" ? 403 : 400);
    }
  });

  router.post("/:id/approve", async (c) => {
    try {
      const assessment = await assessmentManager.approve(c.req.param("id"), c.var.auth.userId);
      return c.json({ assessment });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return c.json({ error: message }, message === "Forbidden" ? 403 : 400);
    }
  });

  router.post("/:id/run", async (c) => {
    try {
      const assessment = await assessmentManager.run(c.req.param("id"), c.var.auth.userId);
      return c.json({ assessment });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return c.json({ error: message }, message === "Forbidden" ? 403 : 400);
    }
  });

  router.post("/:id/issues", async (c) => {
    const body = await c.req.json();
    const parsed = z.object({ findingIds: z.array(z.string()).min(1) }).safeParse(body);
    if (!parsed.success) return c.json({ error: parsed.error.issues }, 400);

    try {
      const assessment = await assessmentManager.createIssues(
        c.req.param("id"),
        c.var.auth.userId,
        parsed.data.findingIds,
      );
      return c.json({ assessment });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return c.json({ error: message }, message === "Forbidden" ? 403 : 400);
    }
  });

  return router;
}
