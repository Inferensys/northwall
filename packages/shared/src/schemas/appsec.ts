import { z } from "zod";

export const EngagementStatus = z.enum([
  "draft",
  "scoping",
  "planning",
  "running",
  "review",
  "remediating",
  "verified",
]);
export type EngagementStatus = z.infer<typeof EngagementStatus>;

export const ScanMode = z.enum(["safe-appsec", "authorized-dast", "code-only"]);
export type ScanMode = z.infer<typeof ScanMode>;

export const EngagementScope = z.object({
  targetName: z.string().min(1),
  targetType: z.enum(["sample-app", "repo", "sbom", "staging-url"]),
  ownedEnvironment: z.boolean(),
  authorizationConfirmed: z.boolean(),
  allowedHosts: z.array(z.string()).default([]),
  maxRequestsPerMinute: z.number().int().positive().max(120).default(30),
  destructiveTesting: z.boolean().default(false),
  thirdPartyTargets: z.boolean().default(false),
});
export type EngagementScope = z.infer<typeof EngagementScope>;

export const Engagement = z.object({
  id: z.string(),
  title: z.string(),
  status: EngagementStatus,
  scanMode: ScanMode,
  runBudgetMinutes: z.number().int().positive(),
  scope: EngagementScope,
  createdAt: z.number(),
  updatedAt: z.number(),
});
export type Engagement = z.infer<typeof Engagement>;

export const SystemGraphNode = z.object({
  id: z.string(),
  label: z.string(),
  kind: z.enum(["app", "service", "route", "api", "package", "secret", "auth", "database", "integration"]),
  risk: z.enum(["low", "medium", "high", "critical"]),
});
export type SystemGraphNode = z.infer<typeof SystemGraphNode>;

export const SystemGraphEdge = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  label: z.string(),
});
export type SystemGraphEdge = z.infer<typeof SystemGraphEdge>;

export const SystemGraph = z.object({
  nodes: z.array(SystemGraphNode),
  edges: z.array(SystemGraphEdge),
  confidence: z.number().min(0).max(100),
  lastUpdatedAt: z.number(),
});
export type SystemGraph = z.infer<typeof SystemGraph>;

export const FindingSeverity = z.enum(["info", "low", "medium", "high", "critical"]);
export type FindingSeverity = z.infer<typeof FindingSeverity>;

export const FindingConfidence = z.enum(["low", "medium", "high"]);
export type FindingConfidence = z.infer<typeof FindingConfidence>;

export const FindingStatus = z.enum(["open", "in_progress", "ready_for_review", "verified"]);
export type FindingStatus = z.infer<typeof FindingStatus>;

export const Finding = z.object({
  id: z.string(),
  title: z.string(),
  severity: FindingSeverity,
  confidence: FindingConfidence,
  status: FindingStatus,
  owner: z.string(),
  affectedNodeIds: z.array(z.string()),
  evidence: z.array(z.string()),
  businessImpact: z.string(),
  fixPlan: z.string(),
  verificationStep: z.string(),
  cwe: z.string().optional(),
  cve: z.string().optional(),
  kev: z.boolean().default(false),
  asvs: z.string().optional(),
});
export type Finding = z.infer<typeof Finding>;

export const AssessmentLoop = z.object({
  id: z.string(),
  title: z.string(),
  strategy: z.string(),
  agents: z.array(z.string()),
  findingsAdded: z.number().int().min(0),
  graphChanges: z.number().int().min(0),
  nextHypothesis: z.string(),
  status: z.enum(["queued", "running", "complete"]),
});
export type AssessmentLoop = z.infer<typeof AssessmentLoop>;

export interface ScopeGateResult {
  allowed: boolean;
  reasons: string[];
}

export function validateScopeGate(scope: EngagementScope): ScopeGateResult {
  const reasons: string[] = [];
  if (!scope.ownedEnvironment) reasons.push("Target must be an owned or explicitly authorized environment.");
  if (!scope.authorizationConfirmed) reasons.push("Authorization must be confirmed before execution.");
  if (scope.thirdPartyTargets) reasons.push("Third-party targets are outside scope.");
  if (scope.destructiveTesting) reasons.push("Destructive testing is disabled for safe AppSec runs.");
  if (scope.targetType === "staging-url" && scope.allowedHosts.length === 0) {
    reasons.push("Staging URL assessments require at least one allowed host.");
  }
  return { allowed: reasons.length === 0, reasons };
}

const severityWeight: Record<FindingSeverity, number> = {
  info: 1,
  low: 2,
  medium: 4,
  high: 7,
  critical: 10,
};

const confidenceWeight: Record<FindingConfidence, number> = {
  low: 0.6,
  medium: 0.85,
  high: 1,
};

export function findingPriorityScore(finding: Pick<Finding, "severity" | "confidence" | "kev">): number {
  const base = severityWeight[finding.severity] * confidenceWeight[finding.confidence];
  return Math.round((base + (finding.kev ? 2 : 0)) * 10);
}
