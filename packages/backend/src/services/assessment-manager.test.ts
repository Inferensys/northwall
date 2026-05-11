import { describe, expect, it } from "vitest";
import type { GitHubRepository, VulnerabilityFinding } from "@northwall/shared";
import { AssessmentManager } from "./assessment-manager.js";

const repo: GitHubRepository = {
  id: 77,
  owner: "inferensys",
  name: "ledger-api",
  fullName: "inferensys/ledger-api",
  private: true,
  defaultBranch: "main",
  htmlUrl: "https://github.com/inferensys/ledger-api",
  permissions: { pull: true, push: true },
};

const finding: VulnerabilityFinding = {
  id: "BG-101",
  title: "Missing tenant ownership check",
  severity: "high",
  confidence: "medium",
  status: "open",
  affectedNodes: ["routes", "auth"],
  evidence: [{ path: "src/routes/invoices.ts", line: 34 }],
  impact: "A tenant-scoped route can read data without proving tenant ownership.",
  remediation: "Resolve tenant scope from the authenticated session and add cross-tenant tests.",
  labels: ["backend"],
  issueTitle: "[Northwall] Missing tenant ownership check",
  issueBody: "Evidence and fix plan.",
};

describe("AssessmentManager workflow gates", () => {
  it("rejects planning before repository understanding", async () => {
    const manager = new AssessmentManager();
    const assessment = await manager.createAssessment("user-1", repo, "main");

    await expect(manager.plan(assessment.id, "user-1")).rejects.toThrow("Build context before planning.");
  });

  it("rejects execution before plan approval", async () => {
    const manager = new AssessmentManager();
    const assessment = await manager.createAssessment("user-1", repo, "main");
    const stored = manager.getAssessment(assessment.id);
    if (!stored) throw new Error("assessment missing");
    stored.phase = "plan_ready";
    stored.plan = {
      summary: "Review repo",
      agents: [{ id: "a1", name: "Rhea", title: "Reviewer", focus: "Static review", status: "queued" }],
      tasks: [{ id: "t1", title: "Review routes", agentId: "a1", dependsOn: [], status: "queued", evidence: [] }],
      approvalNotes: [],
    };

    await expect(manager.run(assessment.id, "user-1")).rejects.toThrow("Execution requires an approved plan.");
  });

  it("requires selected finding IDs before creating GitHub issues", async () => {
    const manager = new AssessmentManager();
    const assessment = await manager.createAssessment("user-1", repo, "main");
    const stored = manager.getAssessment(assessment.id);
    if (!stored) throw new Error("assessment missing");
    stored.phase = "findings_ready";
    stored.findings = [finding];

    await expect(manager.createIssues(assessment.id, "user-1", [])).rejects.toThrow("Select at least one finding.");
  });
});
