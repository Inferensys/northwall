import { describe, expect, it } from "vitest";
import {
  Assessment,
  GitHubRepository,
  KnowledgeGraph,
  buildGitHubIssuePayload,
  canTransitionAssessment,
  type VulnerabilityFinding,
} from "./assessment";

const repo = {
  id: 42,
  owner: "inferensys",
  name: "payments-api",
  fullName: "inferensys/payments-api",
  private: true,
  defaultBranch: "main",
  htmlUrl: "https://github.com/inferensys/payments-api",
  permissions: { pull: true, push: true },
};

describe("GitHubRepository", () => {
  it("validates the public repository shape without leaking credentials", () => {
    const parsed = GitHubRepository.parse(repo);
    expect(parsed.fullName).toBe("inferensys/payments-api");
    expect("token" in parsed).toBe(false);
  });
});

describe("Assessment phase transitions", () => {
  it("allows the intended approval workflow and rejects skipped execution", () => {
    expect(canTransitionAssessment("repo_selected", "understanding")).toBe(true);
    expect(canTransitionAssessment("plan_ready", "approved")).toBe(true);
    expect(canTransitionAssessment("repo_selected", "running")).toBe(false);
  });
});

describe("KnowledgeGraph", () => {
  it("validates node and edge creation from repo understanding", () => {
    const graph = KnowledgeGraph.parse({
      summary: "API service with auth middleware and package risk.",
      confidence: 84,
      nodes: [
        { id: "repo", label: "payments-api", kind: "repo", risk: "medium" },
        { id: "auth", label: "Auth middleware", kind: "auth", risk: "high" },
      ],
      edges: [{ id: "repo-auth", source: "repo", target: "auth", label: "contains" }],
    });

    expect(graph.nodes).toHaveLength(2);
    expect(graph.edges[0]?.source).toBe("repo");
  });
});

describe("GitHub issue payload", () => {
  it("creates stable issue labels from a finding", () => {
    const finding: VulnerabilityFinding = {
      id: "BG-1",
      title: "Missing tenant check",
      severity: "high",
      confidence: "high",
      status: "open",
      affectedNodes: ["api"],
      evidence: [{ path: "src/api/invoices.ts", line: 20 }],
      impact: "Cross-tenant export risk.",
      remediation: "Resolve tenant from session before query.",
      labels: ["backend"],
      issueTitle: "[Northwall] Missing tenant check",
      issueBody: "Evidence and remediation.",
    };

    const payload = buildGitHubIssuePayload(finding);
    expect(payload.labels).toEqual(["northwall", "security", "high", "backend"]);
  });
});

describe("Assessment", () => {
  it("stores graph, plan, and findings without a token field", () => {
    const parsed = Assessment.parse({
      id: "assessment-1",
      userId: "user-1",
      phase: "repo_selected",
      repository: repo,
      branch: "main",
      createdAt: 1,
      updatedAt: 1,
    });

    expect(parsed.repository.fullName).toBe(repo.fullName);
    expect("token" in parsed).toBe(false);
  });
});
