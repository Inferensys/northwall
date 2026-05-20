import { z } from "zod";

export const GitHubRepository = z.object({
  id: z.number(),
  owner: z.string().min(1),
  name: z.string().min(1),
  fullName: z.string().min(1),
  private: z.boolean(),
  defaultBranch: z.string().min(1),
  htmlUrl: z.string().url(),
  permissions: z.object({
    admin: z.boolean().optional(),
    push: z.boolean().optional(),
    pull: z.boolean().optional(),
  }).default({}),
});
export type GitHubRepository = z.infer<typeof GitHubRepository>;

export const RepositoryConnection = z.object({
  connected: z.boolean(),
  provider: z.literal("github"),
  account: z.string().nullable(),
  scopes: z.array(z.string()).default([]),
  connectedAt: z.number().nullable(),
});
export type RepositoryConnection = z.infer<typeof RepositoryConnection>;

export const AssessmentPhase = z.enum([
  "connect_repo",
  "repo_selected",
  "understanding",
  "plan_ready",
  "approved",
  "running",
  "findings_ready",
  "issues_created",
]);
export type AssessmentPhase = z.infer<typeof AssessmentPhase>;

export const KnowledgeGraphNode = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  kind: z.enum([
    "repo",
    "app",
    "service",
    "route",
    "api",
    "package",
    "auth",
    "database",
    "integration",
    "secret",
    "ci",
    "config",
  ]),
  risk: z.enum(["low", "medium", "high", "critical"]),
  evidence: z.array(z.string()).default([]),
});
export type KnowledgeGraphNode = z.infer<typeof KnowledgeGraphNode>;

export const KnowledgeGraphEdge = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  label: z.string().min(1),
});
export type KnowledgeGraphEdge = z.infer<typeof KnowledgeGraphEdge>;

export const KnowledgeGraph = z.object({
  nodes: z.array(KnowledgeGraphNode),
  edges: z.array(KnowledgeGraphEdge),
  summary: z.string().default(""),
  confidence: z.number().min(0).max(100).default(70),
});
export type KnowledgeGraph = z.infer<typeof KnowledgeGraph>;

export const AgentRole = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  title: z.string().min(1),
  focus: z.string().min(1),
  status: z.enum(["queued", "working", "complete"]).default("queued"),
});
export type AgentRole = z.infer<typeof AgentRole>;

export const AssessmentTask = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  agentId: z.string().min(1),
  dependsOn: z.array(z.string()).default([]),
  status: z.enum(["queued", "running", "complete"]).default("queued"),
  evidence: z.array(z.string()).default([]),
});
export type AssessmentTask = z.infer<typeof AssessmentTask>;

export const AssessmentPlan = z.object({
  summary: z.string().min(1),
  agents: z.array(AgentRole),
  tasks: z.array(AssessmentTask),
  approvalNotes: z.array(z.string()).default([]),
});
export type AssessmentPlan = z.infer<typeof AssessmentPlan>;

export const EvidenceLocation = z.object({
  path: z.string().min(1),
  line: z.number().int().positive().optional(),
  excerpt: z.string().optional(),
});
export type EvidenceLocation = z.infer<typeof EvidenceLocation>;

export const VulnerabilityFinding = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  severity: z.enum(["low", "medium", "high", "critical"]),
  confidence: z.enum(["low", "medium", "high"]),
  status: z.enum(["open", "approved", "issue_created"]).default("open"),
  affectedNodes: z.array(z.string()).default([]),
  evidence: z.array(EvidenceLocation).default([]),
  impact: z.string().min(1),
  remediation: z.string().min(1),
  labels: z.array(z.string()).default([]),
  issueTitle: z.string().min(1),
  issueBody: z.string().min(1),
  issueNumber: z.number().int().positive().optional(),
  issueUrl: z.string().url().optional(),
});
export type VulnerabilityFinding = z.infer<typeof VulnerabilityFinding>;

export const AssessmentEvent = z.object({
  id: z.string().min(1),
  assessmentId: z.string().min(1),
  type: z.enum([
    "repo_connected",
    "repo_selected",
    "understanding_started",
    "graph_updated",
    "plan_ready",
    "plan_approved",
    "run_started",
    "agent_started",
    "task_completed",
    "finding_created",
    "issue_created",
    "status_update",
  ]),
  summary: z.string().min(1),
  timestamp: z.number(),
  data: z.record(z.string(), z.unknown()).optional(),
});
export type AssessmentEvent = z.infer<typeof AssessmentEvent>;

export const Assessment = z.object({
  id: z.string().min(1),
  userId: z.string().optional(),
  phase: AssessmentPhase,
  repository: GitHubRepository,
  branch: z.string().min(1),
  createdAt: z.number(),
  updatedAt: z.number(),
  inventory: z.object({
    files: z.number().int().min(0),
    packageFiles: z.array(z.string()).default([]),
    routes: z.array(z.string()).default([]),
    authFiles: z.array(z.string()).default([]),
    ciFiles: z.array(z.string()).default([]),
    configFiles: z.array(z.string()).default([]),
    dependencies: z.array(z.string()).default([]),
  }).default({
    files: 0,
    packageFiles: [],
    routes: [],
    authFiles: [],
    ciFiles: [],
    configFiles: [],
    dependencies: [],
  }),
  graph: KnowledgeGraph.nullable().default(null),
  plan: AssessmentPlan.nullable().default(null),
  findings: z.array(VulnerabilityFinding).default([]),
  events: z.array(AssessmentEvent).default([]),
});
export type Assessment = z.infer<typeof Assessment>;

const allowedTransitions: Record<AssessmentPhase, AssessmentPhase[]> = {
  connect_repo: ["repo_selected"],
  repo_selected: ["understanding"],
  understanding: ["plan_ready"],
  plan_ready: ["approved"],
  approved: ["running"],
  running: ["findings_ready"],
  findings_ready: ["issues_created", "running"],
  issues_created: [],
};

export function canTransitionAssessment(from: AssessmentPhase, to: AssessmentPhase): boolean {
  return allowedTransitions[from].includes(to);
}

export function buildGitHubIssuePayload(finding: VulnerabilityFinding): {
  title: string;
  body: string;
  labels: string[];
} {
  return {
    title: finding.issueTitle,
    body: finding.issueBody,
    labels: Array.from(new Set(["northwall", "agentic-appsec", "appsec-orchestration", finding.severity, finding.confidence, ...finding.labels])),
  };
}
