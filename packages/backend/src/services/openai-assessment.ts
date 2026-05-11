import OpenAI from "openai";
import type {
  AssessmentPlan,
  GitHubRepository,
  KnowledgeGraph,
  VulnerabilityFinding,
} from "@northwall/shared";
import type { RepoSnapshot } from "./repo-analyzer.js";

interface PlanningInput {
  repo: GitHubRepository;
  branch: string;
  graph: KnowledgeGraph;
  inventory: RepoSnapshot["inventory"];
}

function modelName(): string {
  return process.env.OPENAI_MODEL || "gpt-5.5";
}

function client(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) return null;
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL,
    defaultHeaders: {
      "api-key": process.env.OPENAI_API_KEY,
    },
  });
}

function extractText(response: unknown): string {
  const asRecord = response as Record<string, unknown>;
  if (typeof asRecord.output_text === "string") return asRecord.output_text;
  const output = asRecord.output as Array<Record<string, unknown>> | undefined;
  return output?.flatMap((item) => {
    const content = item.content as Array<Record<string, unknown>> | undefined;
    return content?.map((block) => block.text).filter((text): text is string => typeof text === "string") ?? [];
  }).join("\n") ?? "";
}

export function parseModelJson<T>(text: string): T {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced?.[1]?.trim() ?? trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Model response did not contain JSON");
  }
  return JSON.parse(candidate.slice(start, end + 1)) as T;
}

export class OpenAIAssessmentService {
  private readonly client = client();

  async generatePlan(input: PlanningInput): Promise<AssessmentPlan> {
    if (!this.client) return fallbackPlan(input);

    const prompt = [
      "You are Northwall, a defensive AppSec planning system for owned GitHub repositories.",
      "Return only JSON with keys: summary, agents, tasks, approvalNotes.",
      "Keep all checks static/dependency oriented. Do not include exploit payloads, third-party scanning, credential collection, persistence, or destructive tests.",
      "Agents need id, name, title, focus, status. Tasks need id, title, agentId, dependsOn, status, evidence.",
      "",
      JSON.stringify(input, null, 2),
    ].join("\n");

    try {
      const response = await this.client.responses.create({
        model: modelName(),
        input: prompt,
      });
      const parsed = parseModelJson<{ plan?: AssessmentPlan } | AssessmentPlan>(extractText(response));
      const plan = "plan" in parsed && parsed.plan ? parsed.plan : parsed;
      return normalizePlan(plan as AssessmentPlan, input);
    } catch (error) {
      console.warn("OpenAIAssessmentService.generatePlan fallback:", error);
      return fallbackPlan(input);
    }
  }

  async generateFindings(input: PlanningInput): Promise<VulnerabilityFinding[]> {
    if (!this.client) return fallbackFindings(input);

    const prompt = [
      "You are Northwall, a defensive AppSec evidence reviewer.",
      "Given a repository inventory and knowledge graph, produce likely static/dependency findings only when evidence is concrete.",
      "Return only JSON with key findings. Each finding needs id, title, severity, confidence, status, affectedNodes, evidence, impact, remediation, labels, issueTitle, issueBody.",
      "Evidence items need path, optional line, optional excerpt. Do not reveal secret values; describe config references without copying values.",
      "",
      JSON.stringify(input, null, 2),
    ].join("\n");

    try {
      const response = await this.client.responses.create({
        model: modelName(),
        input: prompt,
      });
      const parsed = parseModelJson<{ findings: VulnerabilityFinding[] }>(extractText(response));
      return normalizeFindings(parsed.findings, input);
    } catch (error) {
      console.warn("OpenAIAssessmentService.generateFindings fallback:", error);
      return fallbackFindings(input);
    }
  }
}

function normalizePlan(plan: AssessmentPlan, input: PlanningInput): AssessmentPlan {
  if (!plan.agents?.length || !plan.tasks?.length) return fallbackPlan(input);
  return {
    summary: plan.summary || `Assess ${input.repo.fullName} for static AppSec and dependency risk.`,
    agents: plan.agents.map((agent) => ({
      ...agent,
      status: agent.status ?? "queued",
    })),
    tasks: plan.tasks.map((task) => ({
      ...task,
      dependsOn: task.dependsOn ?? [],
      status: task.status ?? "queued",
      evidence: task.evidence ?? [],
    })),
    approvalNotes: plan.approvalNotes ?? [],
  };
}

function normalizeFindings(findings: VulnerabilityFinding[], input: PlanningInput): VulnerabilityFinding[] {
  if (!Array.isArray(findings) || findings.length === 0) return fallbackFindings(input);
  return findings.slice(0, 8).map((finding, index) => ({
    ...finding,
    id: finding.id || `BG-${index + 101}`,
    status: finding.status ?? "open",
    labels: finding.labels ?? [],
    affectedNodes: finding.affectedNodes ?? [],
    evidence: finding.evidence ?? [],
    issueTitle: finding.issueTitle || `[Northwall] ${finding.title}`,
    issueBody: finding.issueBody || issueBodyFor(finding),
  }));
}

function fallbackPlan(input: PlanningInput): AssessmentPlan {
  return {
    summary: `Assess ${input.repo.fullName} on ${input.branch}: understand app structure, review auth-sensitive paths, inspect dependencies, and prepare owner-ready findings.`,
    agents: [
      { id: "cartographer", name: "Rhea", title: "System Cartographer", focus: "Map routes, auth boundaries, config, CI, and dependency surfaces.", status: "queued" },
      { id: "auth-reviewer", name: "Kade", title: "Auth Reviewer", focus: "Review auth, tenant, session, middleware, and permission-sensitive files.", status: "queued" },
      { id: "dependency-analyst", name: "Mira", title: "Dependency Analyst", focus: "Review package manifests and lockfiles for risky dependency patterns.", status: "queued" },
      { id: "issue-writer", name: "Nova", title: "Issue Writer", focus: "Convert evidence into GitHub-ready issue drafts with remediation steps.", status: "queued" },
    ],
    tasks: [
      { id: "t1", title: "Map repo surfaces", agentId: "cartographer", dependsOn: [], status: "queued", evidence: input.inventory.routes.slice(0, 6) },
      { id: "t2", title: "Review auth-sensitive code", agentId: "auth-reviewer", dependsOn: ["t1"], status: "queued", evidence: input.inventory.authFiles.slice(0, 6) },
      { id: "t3", title: "Review dependency graph", agentId: "dependency-analyst", dependsOn: ["t1"], status: "queued", evidence: input.inventory.packageFiles },
      { id: "t4", title: "Prepare GitHub issue drafts", agentId: "issue-writer", dependsOn: ["t2", "t3"], status: "queued", evidence: [] },
    ],
    approvalNotes: [
      "Only static and dependency checks will run.",
      "No third-party hosts, destructive tests, credential collection, or exploit payload output.",
    ],
  };
}

function fallbackFindings(input: PlanningInput): VulnerabilityFinding[] {
  const findings: VulnerabilityFinding[] = [];

  if (input.inventory.authFiles.length > 0 && input.inventory.routes.length > 0) {
    findings.push({
      id: "BG-101",
      title: "Auth-sensitive routes need ownership checks reviewed",
      severity: "high",
      confidence: "medium",
      status: "open",
      affectedNodes: ["routes", "auth"],
      evidence: [
        { path: input.inventory.routes[0] ?? "routes", excerpt: "Route surface discovered during repository understanding." },
        { path: input.inventory.authFiles[0] ?? "auth", excerpt: "Auth or tenant-sensitive code path discovered." },
      ],
      impact: "Route handlers and auth-sensitive code sit in the same request path; missing ownership checks could expose tenant data.",
      remediation: "Add tests for cross-tenant access and verify every route derives tenant/workspace from the authenticated session.",
      labels: ["backend"],
      issueTitle: "[Northwall] Review ownership checks on auth-sensitive routes",
      issueBody: "",
    });
  }

  if (input.inventory.packageFiles.length > 0) {
    findings.push({
      id: "BG-102",
      title: "Dependency risk review required for deployable package graph",
      severity: input.inventory.dependencies.length > 50 ? "medium" : "low",
      confidence: "high",
      status: "open",
      affectedNodes: ["dependencies"],
      evidence: input.inventory.packageFiles.map((file) => ({ path: file })).slice(0, 4),
      impact: "Deployable packages should be checked for known advisories and lockfile drift before release.",
      remediation: "Run dependency audit in CI, pin patched versions, and fail builds on known vulnerable production dependencies.",
      labels: ["dependencies"],
      issueTitle: "[Northwall] Review production dependency risk",
      issueBody: "",
    });
  }

  if (input.inventory.configFiles.length > 0) {
    findings.push({
      id: "BG-103",
      title: "Runtime configuration contains secret-sensitive surfaces",
      severity: "medium",
      confidence: "medium",
      status: "open",
      affectedNodes: ["config"],
      evidence: input.inventory.configFiles.map((file) => ({ path: file })).slice(0, 4),
      impact: "Configuration and environment files define sensitive runtime behavior and should be reviewed for secret handling.",
      remediation: "Keep example env files value-free, enforce secret scanning in CI, and document required runtime secrets separately.",
      labels: ["config"],
      issueTitle: "[Northwall] Review secret-sensitive runtime configuration",
      issueBody: "",
    });
  }

  return findings.map((finding) => ({
    ...finding,
    issueBody: issueBodyFor(finding),
  }));
}

function issueBodyFor(finding: Pick<VulnerabilityFinding, "title" | "severity" | "confidence" | "impact" | "remediation" | "evidence">): string {
  const evidence = finding.evidence
    .map((item) => `- \`${item.path}${item.line ? `:${item.line}` : ""}\`${item.excerpt ? ` — ${item.excerpt}` : ""}`)
    .join("\n");

  return [
    `## ${finding.title}`,
    "",
    `**Severity:** ${finding.severity}`,
    `**Confidence:** ${finding.confidence}`,
    "",
    "### Evidence",
    evidence || "- Evidence captured during repository understanding.",
    "",
    "### Impact",
    finding.impact,
    "",
    "### Remediation",
    finding.remediation,
    "",
    "_Created by Northwall._",
  ].join("\n");
}
