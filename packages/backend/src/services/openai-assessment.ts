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
      "You are Northwall, a defensive Agentic SOC planning system for owned environments.",
      "Return only JSON with keys: summary, agents, tasks, approvalNotes.",
      "Treat the GitHub repository as one context source for a security operations run: code ownership, vulnerable paths, response handoff, and evidence.",
      "Keep all checks static, dependency, triage, and investigation oriented. Do not include exploit payloads, third-party scanning, credential collection, persistence, or destructive tests.",
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
      "You are Northwall, a defensive Agentic SOC evidence reviewer.",
      "Given a repository inventory and investigation graph, produce security-operations findings only when evidence is concrete.",
      "Return only JSON with key findings. Each finding needs id, title, severity, confidence, status, affectedNodes, evidence, impact, remediation, labels, issueTitle, issueBody.",
      "Evidence items need path, optional line, optional excerpt. Do not reveal secret values; describe config references without copying values.",
      "Write findings as owner handoffs for alert triage, threat investigation, response planning, or remediation. Keep human approval in the loop.",
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
    summary: plan.summary || `Run an Agentic SOC investigation on ${input.repo.fullName}: map context, triage risk, plan response, and prepare owner handoff.`,
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
    summary: `Run an Agentic SOC investigation on ${input.repo.fullName} (${input.branch}): build context, triage risk, review sensitive paths, and prepare owner-ready work items.`,
    agents: [
      { id: "cartographer", name: "Rhea", title: "Incident Cartographer", focus: "Map services, owners, auth boundaries, config, CI, and dependency surfaces.", status: "queued" },
      { id: "triage-agent", name: "Kade", title: "Alert Triage Agent", focus: "Separate weak signals from issues that need investigation or owner action.", status: "queued" },
      { id: "threat-investigator", name: "Mira", title: "Threat Investigator", focus: "Review sensitive paths, dependency context, and likely blast radius.", status: "queued" },
      { id: "handoff-writer", name: "Nova", title: "Response Handoff Writer", focus: "Convert evidence into owner-ready work item drafts with verification steps.", status: "queued" },
    ],
    tasks: [
      { id: "t1", title: "Build investigation context", agentId: "cartographer", dependsOn: [], status: "queued", evidence: input.inventory.routes.slice(0, 6) },
      { id: "t2", title: "Triage sensitive paths", agentId: "triage-agent", dependsOn: ["t1"], status: "queued", evidence: input.inventory.authFiles.slice(0, 6) },
      { id: "t3", title: "Check dependency and ownership risk", agentId: "threat-investigator", dependsOn: ["t1"], status: "queued", evidence: input.inventory.packageFiles },
      { id: "t4", title: "Prepare owner handoff drafts", agentId: "handoff-writer", dependsOn: ["t2", "t3"], status: "queued", evidence: [] },
    ],
    approvalNotes: [
      "Only safe triage, static, dependency, and owner-handoff checks will run.",
      "No third-party hosts, destructive actions, credential collection, or exploit payload output.",
      "Human approval is required before creating work items.",
    ],
  };
}

function fallbackFindings(input: PlanningInput): VulnerabilityFinding[] {
  const findings: VulnerabilityFinding[] = [];

  if (input.inventory.authFiles.length > 0 && input.inventory.routes.length > 0) {
    findings.push({
      id: "BG-101",
      title: "Auth-sensitive route belongs in the SOC response queue",
      severity: "high",
      confidence: "medium",
      status: "open",
      affectedNodes: ["routes", "auth"],
      evidence: [
        { path: input.inventory.routes[0] ?? "routes", excerpt: "Route surface discovered while building investigation context." },
        { path: input.inventory.authFiles[0] ?? "auth", excerpt: "Auth or tenant-sensitive code path discovered." },
      ],
      impact: "The route and auth-sensitive code sit in the same request path; the owning team should confirm exposure before the case closes.",
      remediation: "Assign the owner, add tests for cross-tenant access, and verify every route derives tenant/workspace from the authenticated session.",
      labels: ["soc", "backend"],
      issueTitle: "[Northwall] SOC handoff: review auth-sensitive route ownership",
      issueBody: "",
    });
  }

  if (input.inventory.packageFiles.length > 0) {
    findings.push({
      id: "BG-102",
      title: "Dependency signal needs SOC triage before release",
      severity: input.inventory.dependencies.length > 50 ? "medium" : "low",
      confidence: "high",
      status: "open",
      affectedNodes: ["dependencies"],
      evidence: input.inventory.packageFiles.map((file) => ({ path: file })).slice(0, 4),
      impact: "Deployable packages should be checked for known advisories and lockfile drift before the change moves into the incident path.",
      remediation: "Run dependency audit in CI, pin patched versions, and fail builds on known vulnerable production dependencies.",
      labels: ["soc", "dependencies"],
      issueTitle: "[Northwall] SOC handoff: review production dependency risk",
      issueBody: "",
    });
  }

  if (input.inventory.configFiles.length > 0) {
    findings.push({
      id: "BG-103",
      title: "Runtime config needs owner review before response closure",
      severity: "medium",
      confidence: "medium",
      status: "open",
      affectedNodes: ["config"],
      evidence: input.inventory.configFiles.map((file) => ({ path: file })).slice(0, 4),
      impact: "Configuration and environment files define sensitive runtime behavior and can change the response path.",
      remediation: "Keep example env files value-free, enforce secret scanning in CI, and document required runtime secrets separately.",
      labels: ["soc", "config"],
      issueTitle: "[Northwall] SOC handoff: review runtime configuration",
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
    evidence || "- Evidence captured while building investigation context.",
    "",
    "### Impact",
    finding.impact,
    "",
    "### Response / Fix",
    finding.remediation,
    "",
    "_Created by Northwall._",
  ].join("\n");
}
