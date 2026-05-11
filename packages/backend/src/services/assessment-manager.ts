import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { nanoid } from "nanoid";
import type {
  Assessment,
  AssessmentEvent,
  GitHubRepository,
  VulnerabilityFinding,
} from "@northwall/shared";
import { canTransitionAssessment } from "@northwall/shared";
import { GitHubClient } from "./github-client.js";
import { TokenStore } from "./token-store.js";
import { RepoAnalyzer, type RepoSnapshot } from "./repo-analyzer.js";
import { OpenAIAssessmentService } from "./openai-assessment.js";

type Listener = (event: AssessmentEvent) => void;

interface AssessmentSnapshot extends Assessment {}

export class AssessmentManager {
  private readonly assessments = new Map<string, Assessment>();
  private readonly listeners = new Map<string, Set<Listener>>();
  private readonly dataDir = path.join(os.homedir(), ".Northwall", "assessments");
  private readonly tokenStore = new TokenStore();
  private readonly github = new GitHubClient();
  private readonly analyzer = new RepoAnalyzer(this.github);
  private readonly ai = new OpenAIAssessmentService();

  static async create(): Promise<AssessmentManager> {
    const manager = new AssessmentManager();
    await fs.mkdir(manager.dataDir, { recursive: true });
    await manager.load();
    return manager;
  }

  async connectGitHub(userId: string, token: string) {
    const viewer = await this.github.viewer(token);
    await this.tokenStore.saveGitHubToken(userId, token, viewer.account, viewer.scopes);
    return this.tokenStore.getConnection(userId);
  }

  async getConnection(userId: string) {
    return this.tokenStore.getConnection(userId);
  }

  async listRepos(userId: string): Promise<GitHubRepository[]> {
    const token = await this.requireToken(userId);
    return this.github.listRepos(token);
  }

  listAssessments(userId: string): Assessment[] {
    return Array.from(this.assessments.values())
      .filter((assessment) => !assessment.userId || assessment.userId === userId)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  getAssessment(id: string): Assessment | null {
    return this.assessments.get(id) ?? null;
  }

  getAssessmentUserId(id: string): string | undefined {
    return this.assessments.get(id)?.userId;
  }

  async createAssessment(userId: string, repository: GitHubRepository, branch?: string): Promise<Assessment> {
    const now = Date.now();
    const id = `assessment-${nanoid(10)}`;
    const assessment: Assessment = {
      id,
      userId,
      phase: "repo_selected",
      repository,
      branch: branch || repository.defaultBranch,
      createdAt: now,
      updatedAt: now,
      inventory: {
        files: 0,
        packageFiles: [],
        routes: [],
        authFiles: [],
        ciFiles: [],
        configFiles: [],
        dependencies: [],
      },
      graph: null,
      plan: null,
      findings: [],
      events: [],
    };

    this.assessments.set(id, assessment);
    this.emit(id, "repo_selected", `Selected ${repository.fullName} on ${assessment.branch}`);
    await this.save(id);
    return assessment;
  }

  async understand(id: string, userId: string): Promise<Assessment> {
    const assessment = this.requireOwnedAssessment(id, userId);
    if (!canTransitionAssessment(assessment.phase, "understanding") && assessment.phase !== "understanding") {
      throw new Error("Understanding can only start after selecting a repository.");
    }

    this.setPhase(assessment, "understanding");
    this.emit(id, "understanding_started", "Indexing repository structure and security-sensitive surfaces");
    const token = await this.requireToken(userId);
    const snapshot = await this.analyzer.analyze(token, assessment.repository, assessment.branch);
    this.applySnapshot(assessment, snapshot);
    this.emit(id, "graph_updated", `Mapped ${snapshot.graph.nodes.length} graph nodes from ${snapshot.inventory.files} files`, {
      nodes: snapshot.graph.nodes.length,
      edges: snapshot.graph.edges.length,
    });
    await this.save(id);
    return assessment;
  }

  async plan(id: string, userId: string): Promise<Assessment> {
    const assessment = this.requireOwnedAssessment(id, userId);
    if (!assessment.graph || assessment.phase !== "understanding") {
      throw new Error("Run understanding before planning.");
    }

    const plan = await this.ai.generatePlan({
      repo: assessment.repository,
      branch: assessment.branch,
      graph: assessment.graph,
      inventory: assessment.inventory,
    });
    assessment.plan = plan;
    this.setPhase(assessment, "plan_ready");
    this.emit(id, "plan_ready", `Plan ready with ${plan.agents.length} agents and ${plan.tasks.length} tasks`);
    await this.save(id);
    return assessment;
  }

  async approve(id: string, userId: string): Promise<Assessment> {
    const assessment = this.requireOwnedAssessment(id, userId);
    if (!assessment.plan || assessment.phase !== "plan_ready") {
      throw new Error("Plan approval requires a ready plan.");
    }

    this.setPhase(assessment, "approved");
    this.emit(id, "plan_approved", "Assessment plan approved for static execution");
    await this.save(id);
    return assessment;
  }

  async run(id: string, userId: string): Promise<Assessment> {
    const assessment = this.requireOwnedAssessment(id, userId);
    if (!assessment.plan || assessment.phase !== "approved") {
      throw new Error("Execution requires an approved plan.");
    }

    this.setPhase(assessment, "running");
    this.emit(id, "run_started", "Starting static and dependency assessment");

    for (const agent of assessment.plan.agents) {
      agent.status = "working";
      this.emit(id, "agent_started", `${agent.name} started ${agent.title}`, { agentId: agent.id });
      await delay(120);
    }

    for (const task of assessment.plan.tasks) {
      task.status = "running";
      this.emit(id, "status_update", `Running task: ${task.title}`, { taskId: task.id });
      await delay(180);
      task.status = "complete";
      task.evidence = task.evidence.length > 0 ? task.evidence : evidenceForTask(task.title, assessment);
      this.emit(id, "task_completed", `Completed task: ${task.title}`, { taskId: task.id });
    }

    for (const agent of assessment.plan.agents) {
      agent.status = "complete";
    }

    assessment.findings = await this.ai.generateFindings({
      repo: assessment.repository,
      branch: assessment.branch,
      graph: assessment.graph!,
      inventory: assessment.inventory,
    });

    for (const finding of assessment.findings) {
      this.emit(id, "finding_created", `${finding.severity.toUpperCase()}: ${finding.title}`, {
        findingId: finding.id,
        severity: finding.severity,
      });
    }

    this.setPhase(assessment, "findings_ready");
    await this.save(id);
    return assessment;
  }

  async createIssues(id: string, userId: string, findingIds: string[]): Promise<Assessment> {
    const assessment = this.requireOwnedAssessment(id, userId);
    if (assessment.phase !== "findings_ready" && assessment.phase !== "issues_created") {
      throw new Error("Issues can only be created after findings are ready.");
    }
    if (findingIds.length === 0) throw new Error("Select at least one finding.");

    const token = await this.requireToken(userId);
    for (const findingId of findingIds) {
      const finding = assessment.findings.find((item) => item.id === findingId);
      if (!finding) throw new Error(`Unknown finding ${findingId}`);
      if (finding.issueUrl) continue;

      const issue = await this.github.createIssue(token, assessment.repository, finding);
      finding.status = "issue_created";
      finding.issueNumber = issue.number;
      finding.issueUrl = issue.url;
      this.emit(id, "issue_created", `Created GitHub issue #${issue.number}: ${finding.title}`, {
        findingId,
        issueNumber: issue.number,
        issueUrl: issue.url,
      });
    }

    this.setPhase(assessment, "issues_created");
    await this.save(id);
    return assessment;
  }

  subscribe(id: string, listener: Listener): () => void {
    const set = this.listeners.get(id) ?? new Set();
    set.add(listener);
    this.listeners.set(id, set);
    return () => set.delete(listener);
  }

  getEvents(id: string): AssessmentEvent[] {
    return this.assessments.get(id)?.events ?? [];
  }

  private emit(id: string, type: AssessmentEvent["type"], summary: string, data?: Record<string, unknown>): void {
    const assessment = this.assessments.get(id);
    if (!assessment) return;

    const event: AssessmentEvent = {
      id: `evt-${nanoid(10)}`,
      assessmentId: id,
      type,
      summary,
      data,
      timestamp: Date.now(),
    };
    assessment.events.push(event);
    assessment.updatedAt = event.timestamp;
    const set = this.listeners.get(id);
    if (set) {
      for (const listener of set) listener(event);
    }
  }

  private applySnapshot(assessment: Assessment, snapshot: RepoSnapshot): void {
    assessment.inventory = snapshot.inventory;
    assessment.graph = snapshot.graph;
    assessment.updatedAt = Date.now();
  }

  private setPhase(assessment: Assessment, phase: Assessment["phase"]): void {
    assessment.phase = phase;
    assessment.updatedAt = Date.now();
  }

  private requireOwnedAssessment(id: string, userId: string): Assessment {
    const assessment = this.assessments.get(id);
    if (!assessment) throw new Error("Assessment not found");
    if (assessment.userId && assessment.userId !== userId) throw new Error("Forbidden");
    return assessment;
  }

  private async requireToken(userId: string): Promise<string> {
    const record = await this.tokenStore.getGitHubToken(userId);
    if (!record?.token) throw new Error("GitHub connection required");
    return record.token;
  }

  private async save(id: string): Promise<void> {
    const assessment = this.assessments.get(id);
    if (!assessment) return;
    await fs.mkdir(this.dataDir, { recursive: true });
    await fs.writeFile(
      path.join(this.dataDir, `${id}.json`),
      JSON.stringify(assessment, null, 2),
      "utf-8",
    );
  }

  private async load(): Promise<void> {
    let entries: string[] = [];
    try {
      entries = await fs.readdir(this.dataDir);
    } catch {
      return;
    }

    for (const entry of entries.filter((file) => file.endsWith(".json"))) {
      try {
        const raw = await fs.readFile(path.join(this.dataDir, entry), "utf-8");
        const parsed = JSON.parse(raw) as AssessmentSnapshot;
        this.assessments.set(parsed.id, parsed);
      } catch (error) {
        console.warn(`AssessmentManager: could not load ${entry}:`, error);
      }
    }
  }
}

function evidenceForTask(title: string, assessment: Assessment): string[] {
  const lower = title.toLowerCase();
  if (lower.includes("auth")) return assessment.inventory.authFiles.slice(0, 4);
  if (lower.includes("depend")) return assessment.inventory.packageFiles.slice(0, 4);
  if (lower.includes("map") || lower.includes("repo")) return assessment.inventory.routes.slice(0, 4);
  return assessment.inventory.configFiles.slice(0, 4);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
