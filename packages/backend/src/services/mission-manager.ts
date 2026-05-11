import { nanoid } from "nanoid";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import type {
  Mission,
  MissionAgentState,
  MissionPlan,
  SessionEvent,
  ChatMessage,
  SDKEnvelope,
} from "@northwall/shared";
import {
  ContainerManager,
  ContainerClient,
  SessionStore,
  CostMonitor,
  startSessionTimers,
} from "../sandbox/index.js";
import type { TimerHandle } from "../sandbox/index.js";

// ─── Default Proxy Port ───────────────────────────────────────────────────────
// The credential proxy runs on this port by default.
// Override via CREDENTIAL_PROXY_PORT env var.
const DEFAULT_PROXY_PORT = 9100;

// ─── MissionData ─────────────────────────────────────────────────────────────

interface MissionData {
  engine: null; // Always null — engine now runs inside a container
  containerId: string | null;
  hostPort: number | null;
  authToken: string | null;
  sdkSessionId: string | null; // SDK session ID for resume capability
  disconnectWs: (() => void) | null; // Runtime only — not persisted
  timers: TimerHandle | null; // Runtime only — not persisted
  prompt: string;
  events: SessionEvent[];
  sdkMessages: SDKEnvelope[];
  chat: ChatMessage[];
  status: Mission["status"];
  plan: MissionPlan | null;
  agents: MissionAgentState[];
  workspace: string;
  readinessScore: number | null;
  vncUrl?: string;
  containerStatus?: Mission["containerStatus"];
  userId?: string;
  startedAt: number | null;
  completedAt: number | null;
  createdAt: number;
}

// ─── MissionSnapshot ─────────────────────────────────────────────────────────

interface MissionSnapshot {
  id: string;
  containerId?: string | null;
  hostPort?: number | null;
  authToken?: string | null;
  sdkSessionId?: string | null;
  prompt: string;
  events: SessionEvent[];
  sdkMessages?: SDKEnvelope[];
  chat: ChatMessage[];
  status: Mission["status"];
  plan?: MissionPlan | null;
  agents?: MissionAgentState[];
  workspace: string;
  readinessScore?: number | null;
  vncUrl?: string;
  containerStatus?: Mission["containerStatus"];
  userId?: string;
  startedAt: number | null;
  completedAt: number | null;
  createdAt: number;
}

// ─── MissionManager ───────────────────────────────────────────────────────────

export class MissionManager {
  private missions = new Map<string, MissionData>();
  private eventListeners = new Map<string, Set<(event: SessionEvent) => void>>();
  private sdkMessageListeners = new Map<string, Set<(envelope: SDKEnvelope) => void>>();
  private dataDir: string;
  private saveTimers = new Map<string, NodeJS.Timeout>();

  private containerManager: ContainerManager;
  private containerClient: ContainerClient;
  private sessionStore: SessionStore;
  private costMonitor: CostMonitor;
  private proxyPort: number;

  private constructor(proxyPort: number) {
    this.proxyPort = proxyPort;
    this.dataDir = path.join(os.homedir(), ".Northwall", "missions");
    this.containerManager = new ContainerManager();
    this.containerClient = new ContainerClient();
    this.sessionStore = new SessionStore(path.join(os.homedir(), ".Northwall", "sessions"));
    this.costMonitor = new CostMonitor();
  }

  static async create(proxyPort?: number): Promise<MissionManager> {
    const port =
      proxyPort ??
      (process.env["CREDENTIAL_PROXY_PORT"]
        ? parseInt(process.env["CREDENTIAL_PROXY_PORT"], 10)
        : DEFAULT_PROXY_PORT);

    const mm = new MissionManager(port);
    await fs.mkdir(mm.dataDir, { recursive: true });
    await mm.loadMissions();

    // Sweep any orphan containers from previous crashed backend runs
    const swept = await mm.containerManager.sweepOrphans();
    if (swept > 0) {
      console.log(`MissionManager: swept ${swept} orphan container(s) on startup`);
    }

    console.log(
      `MissionManager initialized (proxyPort: ${port}, data: ${mm.dataDir})`,
    );
    return mm;
  }

  // ── Persistence ─────────────────────────────────────────────────────────────

  private async saveMission(id: string, immediate = false): Promise<void> {
    const existing = this.saveTimers.get(id);
    if (existing) clearTimeout(existing);
    if (immediate) {
      await this.writeMissionSnapshot(id);
    } else {
      const timer = setTimeout(() => {
        this.writeMissionSnapshot(id).catch((err) =>
          console.error(`Save failed ${id}:`, err),
        );
        this.saveTimers.delete(id);
      }, 1000);
      this.saveTimers.set(id, timer);
    }
  }

  private async writeMissionSnapshot(id: string): Promise<void> {
    const data = this.missions.get(id);
    if (!data) return;
    const snapshot: MissionSnapshot = {
      id,
      containerId: data.containerId,
      hostPort: data.hostPort,
      authToken: data.authToken,
      sdkSessionId: data.sdkSessionId,
      prompt: data.prompt,
      events: data.events,
      sdkMessages: data.sdkMessages.length > 0 ? data.sdkMessages : undefined,
      chat: data.chat,
      status: data.status,
      plan: data.plan,
      agents: data.agents,
      workspace: data.workspace,
      readinessScore: data.readinessScore,
      vncUrl: data.vncUrl,
      containerStatus: data.containerStatus,
      userId: data.userId,
      startedAt: data.startedAt,
      completedAt: data.completedAt,
      createdAt: data.createdAt,
    };
    await fs.writeFile(
      path.join(this.dataDir, `${id}.json`),
      JSON.stringify(snapshot),
      "utf-8",
    );
  }

  private async loadMissions(): Promise<void> {
    let entries: string[];
    try {
      entries = await fs.readdir(this.dataDir);
    } catch {
      return;
    }

    for (const file of entries.filter((e) => e.endsWith(".json"))) {
      try {
        const raw = await fs.readFile(path.join(this.dataDir, file), "utf-8");
        const s = JSON.parse(raw) as MissionSnapshot;
        let status = s.status;
        let completedAt = s.completedAt;
        if (status === "running") {
          status = "failed";
          completedAt = Date.now();
        }
        if (!["exploring", "planning", "review", "launching", "running", "paused", "completed", "failed"].includes(status)) {
          status = "failed";
          completedAt = completedAt ?? Date.now();
        }
        this.missions.set(s.id, {
          engine: null,
          containerId: s.containerId ?? null,
          hostPort: s.hostPort ?? null,
          authToken: s.authToken ?? null,
          sdkSessionId: s.sdkSessionId ?? null,
          disconnectWs: null,
          timers: null,
          prompt: s.prompt ?? "",
          events: s.events ?? [],
          sdkMessages: s.sdkMessages ?? [],
          chat: s.chat ?? [],
          status: status as Mission["status"],
          plan: s.plan ?? null,
          agents: s.agents ?? [],
          workspace: s.workspace ?? "",
          readinessScore: s.readinessScore ?? null,
          vncUrl: s.vncUrl,
          containerStatus: s.containerStatus,
          userId: s.userId,
          startedAt: s.startedAt,
          completedAt,
          createdAt: s.createdAt,
        });
        if (status !== s.status) await this.writeMissionSnapshot(s.id);
      } catch (err) {
        console.error(`Failed to load ${file}:`, err);
      }
    }
    console.log(`Loaded ${this.missions.size} missions from disk`);
  }

  // ── Mission lifecycle ────────────────────────────────────────────────────────

  createMission(userId?: string): Mission {
    const id = `mission-${nanoid(10)}`;
    const data: MissionData = {
      engine: null,
      containerId: null,
      hostPort: null,
      authToken: null,
      sdkSessionId: null,
      disconnectWs: null,
      timers: null,
      prompt: "",
      events: [],
      sdkMessages: [],
      chat: [],
      status: "exploring",
      plan: null,
      agents: [],
      workspace: "",
      readinessScore: null,
      vncUrl: undefined,
      containerStatus: undefined,
      userId,
      startedAt: null,
      completedAt: null,
      createdAt: Date.now(),
    };
    this.missions.set(id, data);
    this.saveMission(id);
    return this.toMission(id, data);
  }

  async startMission(id: string, prompt: string): Promise<void> {
    const data = this.missions.get(id);
    if (!data) throw new Error(`Mission ${id} not found`);

    data.prompt = prompt;
    data.status = "running";
    data.startedAt = Date.now();
    data.chat.push({
      id: `msg-${nanoid(8)}`,
      sessionId: id,
      role: "user",
      content: prompt,
      timestamp: Date.now(),
    });

    // ── Step 1: Create container ─────────────────────────────────────────────
    const sandboxConfig = {
      sessionId: id,
      workspaceDir: `/workspace/${id}`,
      controlPort: 3001,
      memoryBytes: 4 * 1024 * 1024 * 1024,
      nanoCpus: 2_000_000_000,
      diskSizeGb: 10,
      wallClockTimeoutMs: 30 * 60 * 1000,
      idleTimeoutMs: 30 * 60 * 1000,
      costBudgetUsd: 5,
    };

    const containerInfo = await this.containerManager.createSessionContainer(
      sandboxConfig,
      this.proxyPort,
    );

    data.containerId = containerInfo.containerId;
    data.hostPort = containerInfo.hostPort;
    data.authToken = containerInfo.authToken;
    data.workspace = sandboxConfig.workspaceDir;
    await this.saveMission(id, true);

    // ── Step 2: Wait for control server to be ready ──────────────────────────
    await this.containerManager.waitForReady(containerInfo.hostPort, containerInfo.authToken);

    // ── Step 3: Start session timers ─────────────────────────────────────────
    data.timers = startSessionTimers(id, (sid, reason) =>
      this.handleTimeout(sid, reason),
    );

    // ── Step 4: Connect to event stream ─────────────────────────────────────
    data.disconnectWs = this.containerClient.connectEvents(
      containerInfo.hostPort,
      containerInfo.authToken,
      (rawData) => this.handleContainerEvent(id, rawData, sandboxConfig.costBudgetUsd),
      (err) => this.handleSessionError(id, { error: err.message }),
    );

    // ── Step 5: Send prompt to container ────────────────────────────────────
    await this.containerClient.startSession(containerInfo.hostPort, containerInfo.authToken, {
      prompt,
      sessionId: id,
    });
  }

  async exploreMission(
    id: string,
    content: string,
    onActivity?: (activity: { type: "tool_start" | "tool_progress" | "tool_summary"; summary: string; tool?: string; timestamp: number }) => void,
  ): Promise<{ text: string; readiness: number }> {
    const data = this.missions.get(id);
    if (!data) throw new Error(`Mission ${id} not found`);

    data.status = "exploring";
    data.prompt = data.prompt || content;
    data.readinessScore = 8;
    data.chat.push({
      id: `msg-${nanoid(8)}`,
      sessionId: id,
      role: "user",
      content,
      timestamp: Date.now(),
    });

    const activities = [
      { summary: "Confirmed owned application scope and safe AppSec limits", tool: "Read" },
      { summary: "Mapped target routes, auth boundaries, packages, and data stores", tool: "Task" },
      { summary: "Prepared an agent assessment strategy with evidence requirements", tool: "Plan" },
    ];
    for (const activity of activities) {
      const event: SessionEvent = {
        id: nanoid(),
        sessionId: id,
        type: "exploration_activity",
        summary: activity.summary,
        data: { tool: activity.tool },
        timestamp: Date.now(),
      };
      data.events.push(event);
      this.notifyEvent(id, event);
      onActivity?.({ type: "tool_summary", ...activity, timestamp: event.timestamp });
    }

    const text =
      "I have enough context to plan this as an authorized AppSec assessment. I would map the system first, form a specialist security team, run safe code and dependency checks, verify only approved local routes, and turn high-confidence evidence into a remediation queue.";
    const assistant: ChatMessage = {
      id: `msg-${nanoid(8)}`,
      sessionId: id,
      role: "assistant",
      content: text,
      agentRole: "orchestrator",
      timestamp: Date.now(),
    };
    data.chat.push(assistant);

    const done: SessionEvent = {
      id: nanoid(),
      sessionId: id,
      type: "exploration_done",
      summary: text,
      data: { readiness: data.readinessScore },
      timestamp: Date.now(),
    };
    data.events.push(done);
    this.notifyEvent(id, done);
    await this.saveMission(id, true);
    return { text, readiness: data.readinessScore };
  }

  async beginPlanning(id: string): Promise<Mission> {
    const data = this.missions.get(id);
    if (!data) throw new Error(`Mission ${id} not found`);

    data.status = "review";
    data.plan = createPortfolioPlan();
    data.agents = data.plan.agents.map((agent) => ({
      name: agent.name,
      displayName: agent.displayName,
      specialization: agent.specialization,
      status: "idle",
      currentAction: null,
      messagesProcessed: 0,
    }));
    data.chat.push({
      id: `msg-${nanoid(8)}`,
      sessionId: id,
      role: "assistant",
      agentRole: "orchestrator",
      content:
        "Plan ready. I assembled a specialist AppSec team and a dependency graph that covers system mapping, code review, dependency analysis, auth review, runtime verification, and risk triage.",
      timestamp: Date.now(),
    });

    const events: SessionEvent[] = [
      {
        id: nanoid(),
        sessionId: id,
        type: "mission_planned",
        summary: "Mission plan created",
        data: { title: data.plan.title },
        timestamp: Date.now(),
      },
      ...data.plan.agents.map((agent) => ({
        id: nanoid(),
        sessionId: id,
        type: "agent_created" as const,
        agent: agent.name,
        summary: `${agent.displayName ?? agent.name} created: ${agent.description}`,
        timestamp: Date.now(),
      })),
    ];
    data.events.push(...events);
    for (const event of events) this.notifyEvent(id, event);
    await this.saveMission(id, true);
    return this.toMission(id, data);
  }

  async planMission(id: string, content: string): Promise<{ message: ChatMessage; mission: Mission }> {
    const data = this.missions.get(id);
    if (!data) throw new Error(`Mission ${id} not found`);
    const message: ChatMessage = {
      id: `msg-${nanoid(8)}`,
      sessionId: id,
      role: "assistant",
      agentRole: "orchestrator",
      content: `Noted. I will incorporate this into the mission plan: ${content}`,
      timestamp: Date.now(),
    };
    data.chat.push({
      id: `msg-${nanoid(8)}`,
      sessionId: id,
      role: "user",
      content,
      timestamp: Date.now(),
    }, message);
    await this.saveMission(id, true);
    return { message, mission: this.toMission(id, data) };
  }

  async approvePlan(id: string): Promise<void> {
    const data = this.missions.get(id);
    if (!data) throw new Error(`Mission ${id} not found`);
    if (!data.plan) data.plan = createPortfolioPlan();

    const workspace = path.join(os.homedir(), ".Northwall", "sessions", id, "workspace");
    data.workspace = workspace;
    data.status = "running";
    data.startedAt = Date.now();
    data.containerStatus = "creating";
    data.vncUrl = createDesktopPreviewUrl("Booting agent VM", "Preparing safe AppSec workspace, SBOM tooling, and local browser probe...");
    await this.writeSampleWorkspace(workspace, data.prompt || data.plan.objective);
    await this.saveMission(id, true);

    this.emitEvent(id, "container_creating", "Agent VM is starting", { vncUrl: data.vncUrl });
    setTimeout(() => {
      const d = this.missions.get(id);
      if (!d) return;
      d.containerStatus = "running";
      d.vncUrl = createDesktopPreviewUrl("Agent desktop live", "Assessment cockpit and local target app running at localhost:3000");
      this.emitEvent(id, "container_running", "Agent VM ready", { vncUrl: d.vncUrl });
      this.runSampleExecution(id);
    }, 900);
  }

  async sendMessage(id: string, content: string): Promise<ChatMessage> {
    const data = this.missions.get(id);
    if (!data) throw new Error(`Mission ${id} not found`);
    const user: ChatMessage = {
      id: `msg-${nanoid(8)}`,
      sessionId: id,
      role: "user",
      content,
      timestamp: Date.now(),
    };
    data.chat.push(user);
    this.emitEvent(id, "user_message", content, { text: content });
    await this.saveMission(id, true);
    return user;
  }

  getContainerInfo(id: string): { vncUrl?: string; status?: Mission["containerStatus"] } {
    const data = this.missions.get(id);
    return { vncUrl: data?.vncUrl, status: data?.containerStatus };
  }

  async relayCredential(
    id: string,
    payload: { requestId: string; credentials: Record<string, string> },
  ): Promise<void> {
    this.emitEvent(id, "credential_provided", "Credential relayed to agent VM", {
      requestId: payload.requestId,
      fields: Object.keys(payload.credentials),
    });
  }

  private async writeSampleWorkspace(workspace: string, prompt: string): Promise<void> {
    await fs.mkdir(path.join(workspace, "src", "components"), { recursive: true });
    await fs.mkdir(path.join(workspace, "docs"), { recursive: true });
    await fs.writeFile(
      path.join(workspace, "README.md"),
      `# AcmePay AppSec Assessment\n\nAssessment prompt:\n\n${prompt}\n\n## Delivered\n\n- System graph of routes, auth boundaries, dependencies, and data stores\n- Prioritized findings with evidence, owners, and verification steps\n- Safe local probe notes\n- Remediation handoff for engineering review\n`,
      "utf-8",
    );
    await fs.writeFile(
      path.join(workspace, "src", "components", "AssessmentCockpit.tsx"),
      `export function AssessmentCockpit() {\n  return <main>Northwall assessment cockpit with findings, graph, and remediation queue</main>;\n}\n`,
      "utf-8",
    );
    await fs.writeFile(
      path.join(workspace, "docs", "remediation-notes.md"),
      "# Remediation Notes\n\nResolve tenant ownership from the authenticated session, return immediately on invalid webhook signatures, and add CI checks for vulnerable production dependencies.\n",
      "utf-8",
    );
  }

  private runSampleExecution(id: string): void {
    const steps: Array<() => void> = [
      () => this.updateAgent(id, "system-cartographer", "working", "Mapping routes, services, data stores, and trust boundaries"),
      () => this.completeTask(id, "t1", "system-cartographer", "Created the initial system graph and risk paths"),
      () => this.updateAgent(id, "dependency-analyst", "working", "Checking SBOM, advisories, and deployable package graph"),
      () => this.completeTask(id, "t2", "dependency-analyst", "Raised dependency risk with KEV enrichment and fix guidance"),
      () => this.updateAgent(id, "auth-analyst", "working", "Reviewing session, tenant, and role boundaries"),
      () => this.completeTask(id, "t3", "auth-analyst", "Verified tenant export finding with safe local fixtures"),
      () => this.updateAgent(id, "runtime-verifier", "working", "Running approved local probes under scope rate limit"),
      () => this.completeTask(id, "t4", "runtime-verifier", "Attached runtime evidence to webhook and session findings"),
      () => this.updateAgent(id, "risk-reviewer", "working", "Ranking findings and writing remediation handoff"),
      () => this.completeTask(id, "t5", "risk-reviewer", "Prepared owner-ready remediation queue and verification steps"),
      () => this.finishSampleMission(id),
    ];
    steps.forEach((step, index) => setTimeout(step, 900 + index * 900));
  }

  private updateAgent(
    id: string,
    agentName: string,
    status: MissionAgentState["status"],
    currentAction: string | null,
  ): void {
    const data = this.missions.get(id);
    if (!data) return;
    data.agents = data.agents.map((agent) =>
      agent.name === agentName
        ? {
            ...agent,
            status,
            currentAction,
            messagesProcessed: agent.messagesProcessed + 1,
            startedAt: agent.startedAt ?? Date.now(),
          }
        : agent,
    );
    this.emitEvent(id, status === "working" ? "agent_working" : "agent_completed", currentAction ?? "Agent updated", {
      action: currentAction,
    }, agentName);
  }

  private completeTask(id: string, taskId: string, agentName: string, summary: string): void {
    const data = this.missions.get(id);
    if (!data?.plan) return;
    data.plan = {
      ...data.plan,
      tasks: data.plan.tasks.map((task) =>
        task.id === taskId ? { ...task, status: "completed" } : task,
      ),
    };
    data.agents = data.agents.map((agent) =>
      agent.name === agentName
        ? { ...agent, status: "completed", currentAction: null, messagesProcessed: agent.messagesProcessed + 1 }
        : agent,
    );
    this.emitEvent(id, "task_status_changed", summary, { taskId, status: "completed" }, agentName);
    this.emitEvent(id, "tool_executed", summary, {
      tool: taskId === "t3" ? "Edit" : taskId === "t4" ? "Bash" : "Write",
      summary,
      elapsedSeconds: 1.2,
      input: { taskId, agent: agentName },
    }, agentName);
  }

  private finishSampleMission(id: string): void {
    const data = this.missions.get(id);
    if (!data) return;
    data.status = "completed";
    data.completedAt = Date.now();
    data.containerStatus = "running";
    data.vncUrl = createDesktopPreviewUrl("Assessment completed", "Findings, evidence, and remediation notes are ready.");
    data.agents = data.agents.map((agent) => ({ ...agent, status: "completed", currentAction: null }));
    this.emitEvent(id, "agent_message", "Delivered system graph, evidence-backed findings, and remediation handoff.", {
      text: "Delivered system graph, evidence-backed findings, and remediation handoff.",
    }, "orchestrator");
    this.emitEvent(id, "session_completed", "Assessment completed");
    this.saveMission(id, true).catch((err) => console.error(`Save failed ${id}:`, err));
  }

  private emitEvent(
    id: string,
    type: SessionEvent["type"],
    summary: string,
    data?: Record<string, unknown>,
    agent?: string,
  ): void {
    const mission = this.missions.get(id);
    if (!mission) return;
    const event: SessionEvent = {
      id: nanoid(),
      sessionId: id,
      type,
      agent,
      summary,
      data,
      timestamp: Date.now(),
    };
    mission.events.push(event);
    this.notifyEvent(id, event);
    this.saveMission(id);
  }

  // ── Event relay ──────────────────────────────────────────────────────────────

  private handleContainerEvent(
    id: string,
    rawData: unknown,
    costBudgetUsd: number,
  ): void {
    const data = this.missions.get(id);
    if (!data) return;

    // Reset idle timer on any message from the container
    data.timers?.resetActivity();

    const message = rawData as Record<string, unknown>;
    const msgType = message["type"];

    if (msgType === "session_completed") {
      this.handleSessionComplete(id, message);
    } else if (msgType === "session_error") {
      this.handleSessionError(id, message);
    } else if (msgType === "session_started") {
      // session_started event from agent-control — emit to frontend
      const event: SessionEvent = {
        id: nanoid(),
        sessionId: id,
        type: "session_started",
        summary: "Session started",
        data: message as Record<string, unknown>,
        timestamp: Date.now(),
      };
      data.events.push(event);
      this.notifyEvent(id, event);
      this.saveMission(id);
    } else {
      // SDK envelope — relay to existing pipeline
      const envelope = rawData as SDKEnvelope;

      // Capture SDK session ID for resume if present
      if (
        typeof envelope.msg === "object" &&
        envelope.msg !== null &&
        "session_id" in (envelope.msg as object)
      ) {
        const msgRecord = envelope.msg as Record<string, unknown>;
        if (typeof msgRecord["session_id"] === "string") {
          data.sdkSessionId = msgRecord["session_id"];
        }
      }

      data.sdkMessages.push(envelope);
      this.notifySDK(id, envelope);

      // Cost monitoring — process message and check budget
      this.costMonitor.processSDKMessage(id, envelope.msg);
      const budgetResult = this.costMonitor.checkBudget(id, costBudgetUsd);
      if (budgetResult.exceeded) {
        const warningEvent: SessionEvent = {
          id: nanoid(),
          sessionId: id,
          type: "session_error" as SessionEvent["type"],
          summary: `Cost budget exceeded: $${budgetResult.total.toFixed(4)} of $${budgetResult.budget} used`,
          data: {
            costUsd: budgetResult.total,
            budgetUsd: budgetResult.budget,
            exceeded: true,
          },
          timestamp: Date.now(),
        };
        // Emit as a status_update-style event (we use session_error type which is in the enum)
        // Since the EventType enum only has session_started/completed/error, use session_error
        // but add a data.kind field to distinguish budget warnings from actual errors.
        (warningEvent.data as Record<string, unknown>)["kind"] = "budget_warning";
        data.events.push(warningEvent);
        this.notifyEvent(id, warningEvent);
      }

      this.saveMission(id);
    }
  }

  // ── Session completion and cleanup ───────────────────────────────────────────

  private handleSessionComplete(id: string, _rawData: unknown): void {
    const data = this.missions.get(id);
    if (!data) return;

    const event: SessionEvent = {
      id: nanoid(),
      sessionId: id,
      type: "session_completed",
      summary: "Session completed",
      timestamp: Date.now(),
    };
    data.events.push(event);
    this.notifyEvent(id, event);

    data.status = "completed";
    data.completedAt = Date.now();

    this.cleanup(id).catch((err) =>
      console.error(`MissionManager: cleanup failed for ${id}:`, err),
    );
  }

  private handleSessionError(id: string, rawData: unknown): void {
    const data = this.missions.get(id);
    if (!data) return;

    const errData = rawData as Record<string, unknown>;
    const event: SessionEvent = {
      id: nanoid(),
      sessionId: id,
      type: "session_error",
      summary: typeof errData["error"] === "string" ? errData["error"] : "Session error",
      data: errData as Record<string, unknown>,
      timestamp: Date.now(),
    };
    data.events.push(event);
    this.notifyEvent(id, event);

    data.status = "failed";
    data.completedAt = Date.now();

    this.cleanup(id).catch((err) =>
      console.error(`MissionManager: cleanup failed for ${id}:`, err),
    );
  }

  private handleTimeout(id: string, reason: "idle" | "wall_clock"): void {
    console.warn(`MissionManager: session ${id} timed out (${reason})`);
    const data = this.missions.get(id);
    if (!data || data.status !== "running") return;

    // Attempt to abort the session in the container
    if (data.hostPort && data.authToken) {
      this.containerClient
        .abortSession(data.hostPort, data.authToken)
        .catch((err) =>
          console.warn(`MissionManager: abort request failed for ${id}:`, err),
        );
    }

    this.handleSessionError(id, { error: `Session terminated: ${reason} timeout` });
  }

  private async cleanup(id: string): Promise<void> {
    const data = this.missions.get(id);
    if (!data) return;

    // 1. Disconnect WebSocket
    if (data.disconnectWs) {
      data.disconnectWs();
      data.disconnectWs = null;
    }

    // 2. Clear timers
    if (data.timers) {
      data.timers.clearAll();
      data.timers = null;
    }

    // 3. Copy workspace files from container before destruction
    if (data.containerId && data.workspace) {
      try {
        const workspaceStream =
          await this.containerManager.copyWorkspaceFromContainer(
            data.containerId,
            data.workspace,
            path.join(os.homedir(), ".Northwall", "sessions", id),
          );
        void workspaceStream; // copyWorkspaceFromContainer writes to disk internally
      } catch (err) {
        console.warn(`MissionManager: failed to copy workspace for ${id}:`, err);
      }
    }

    // 4. Destroy container
    if (data.containerId) {
      await this.containerManager.destroySessionContainer(data.containerId);
      data.containerId = null;
    }

    // 5. Reset cost tracker
    this.costMonitor.reset(id);

    // 6. Save final state
    await this.saveMission(id, true);
  }

  // ── Read-only accessors ──────────────────────────────────────────────────────

  getMission(id: string): Mission | null {
    const d = this.missions.get(id);
    return d ? this.toMission(id, d) : null;
  }

  listMissions(userId?: string): Mission[] {
    return Array.from(this.missions.entries())
      .filter(([, d]) => !userId || d.userId === userId)
      .map(([id, d]) => this.toMission(id, d));
  }

  getEvents(id: string, since?: number, limit?: number): SessionEvent[] {
    let events = this.missions.get(id)?.events ?? [];
    if (since != null) events = events.filter((event) => event.timestamp > since);
    if (limit != null) events = events.slice(-limit);
    return events;
  }

  getSDKMessages(id: string): SDKEnvelope[] {
    return this.missions.get(id)?.sdkMessages ?? [];
  }

  getChat(id: string): ChatMessage[] {
    return this.missions.get(id)?.chat ?? [];
  }

  getMissionUserId(id: string): string | undefined {
    return this.missions.get(id)?.userId;
  }

  async listWorkspaceFiles(id: string, dir?: string): Promise<string[]> {
    const d = this.missions.get(id);
    if (!d?.workspace) return [];

    // For running sessions, proxy through ContainerClient
    if (d.status === "running" && d.hostPort && d.authToken) {
      try {
        const url = dir
          ? `http://localhost:${d.hostPort}/files?dir=${encodeURIComponent(dir)}`
          : `http://localhost:${d.hostPort}/files`;
        const res = await fetch(url, { headers: { "x-control-token": d.authToken } });
        if (res.ok) {
          const json = (await res.json()) as { files: string[] };
          return json.files ?? [];
        }
      } catch {
        // Fall through to local read
      }
    }

    // For completed sessions (or when container not reachable), read from host storage
    const target = dir ? path.resolve(d.workspace, dir) : d.workspace;
    if (!target.startsWith(d.workspace)) return [];
    try {
      return await walkDir(target, d.workspace);
    } catch {
      return [];
    }
  }

  async readWorkspaceFile(id: string, filePath: string): Promise<string | null> {
    const d = this.missions.get(id);
    if (!d?.workspace) return null;

    // For running sessions, proxy through ContainerClient
    if (d.status === "running" && d.hostPort && d.authToken) {
      try {
        const url = `http://localhost:${d.hostPort}/files/read?path=${encodeURIComponent(filePath)}`;
        const res = await fetch(url, { headers: { "x-control-token": d.authToken } });
        if (res.ok) return res.text();
      } catch {
        // Fall through to local read
      }
    }

    // For completed sessions, read from host workspace
    const target = path.resolve(d.workspace, filePath);
    if (!target.startsWith(d.workspace)) return null;
    try {
      return await fs.readFile(target, "utf-8");
    } catch {
      return null;
    }
  }

  // ── Subscriptions ─────────────────────────────────────────────────────────────

  subscribe(id: string, listener: (e: SessionEvent) => void): () => void {
    if (!this.eventListeners.has(id)) this.eventListeners.set(id, new Set());
    this.eventListeners.get(id)!.add(listener);
    return () => {
      this.eventListeners.get(id)?.delete(listener);
    };
  }

  subscribeSDK(id: string, listener: (e: SDKEnvelope) => void): () => void {
    if (!this.sdkMessageListeners.has(id)) this.sdkMessageListeners.set(id, new Set());
    this.sdkMessageListeners.get(id)!.add(listener);
    return () => {
      this.sdkMessageListeners.get(id)?.delete(listener);
    };
  }

  private notifyEvent(id: string, event: SessionEvent): void {
    for (const l of this.eventListeners.get(id) ?? []) l(event);
  }

  private notifySDK(id: string, envelope: SDKEnvelope): void {
    for (const l of this.sdkMessageListeners.get(id) ?? []) l(envelope);
  }

  private toMission(id: string, d: MissionData): Mission {
    return {
      id,
      userId: d.userId,
      status: d.status,
      plan: d.plan,
      agents: d.agents,
      workspace: d.workspace,
      readinessScore: d.readinessScore,
      startedAt: d.startedAt,
      completedAt: d.completedAt,
      createdAt: d.createdAt,
      vncUrl: d.vncUrl,
      containerStatus: d.containerStatus,
    };
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function createPortfolioPlan(): MissionPlan {
  const now = Date.now();
  return {
    id: `plan-${nanoid(8)}`,
    title: "AcmePay AppSec Assessment",
    objective:
      "Map the owned AcmePay SaaS application, run a safe AppSec assessment, and produce evidence-backed findings with remediation steps.",
    estimatedComplexity: "complex",
    createdAt: now,
    agents: [
      {
        name: "system-cartographer",
        displayName: "System Cartographer",
        specialization: "Application graph mapping",
        description: "Maps routes, services, auth boundaries, data stores, packages, and integrations.",
        prompt: "Create a system graph first. Identify trust boundaries and risky paths. Do not run destructive checks.",
        tools: ["Read", "Glob", "Grep", "Write"],
        model: "sonnet",
      },
      {
        name: "dependency-analyst",
        displayName: "Dependency Analyst",
        specialization: "SBOM and advisory triage",
        description: "Checks package manifests, lockfiles, advisories, and exploitability signals.",
        prompt: "Review dependency risk, prioritize deployable packages, and cite evidence. Do not produce exploit instructions.",
        tools: ["Read", "Bash", "Write"],
        model: "sonnet",
      },
      {
        name: "auth-analyst",
        displayName: "Auth Analyst",
        specialization: "Tenant isolation and access control",
        description: "Reviews auth flows, session behavior, role checks, and tenant boundaries.",
        prompt: "Assess authorization logic using owned fixtures only. Record evidence, confidence, and remediation steps.",
        tools: ["Read", "Grep", "Bash", "Write"],
        model: "sonnet",
      },
      {
        name: "runtime-verifier",
        displayName: "Runtime Verifier",
        specialization: "Safe local verification",
        description: "Runs approved local probes against in-scope routes and records runtime evidence.",
        prompt: "Verify findings only against approved local targets under rate limits. Stop before side effects.",
        tools: ["Read", "Bash", "Write"],
        model: "sonnet",
      },
      {
        name: "risk-reviewer",
        displayName: "Risk Reviewer",
        specialization: "Evidence and remediation triage",
        description: "Deduplicates weak signals, ranks risk, assigns owners, and writes verification steps.",
        prompt: "Turn evidence into a prioritized remediation queue mapped to ASVS, CWE, and owner workflows.",
        tools: ["Read", "Write"],
        model: "sonnet",
      },
    ],
    tasks: [
      {
        id: "t1",
        title: "Map system graph",
        description: "Identify routes, services, packages, secrets, data stores, auth flows, and external integrations.",
        assignee: "system-cartographer",
        dependencies: [],
        status: "pending",
      },
      {
        id: "t2",
        title: "Analyze dependency risk",
        description: "Review SBOM and lockfile risk, prioritize deployable packages, and flag exploited-vulnerability signals.",
        assignee: "dependency-analyst",
        dependencies: ["t1"],
        status: "pending",
      },
      {
        id: "t3",
        title: "Review authorization paths",
        description: "Check tenant ownership, role boundaries, session behavior, and protected data access.",
        assignee: "auth-analyst",
        dependencies: ["t1"],
        status: "pending",
      },
      {
        id: "t4",
        title: "Verify safe runtime evidence",
        description: "Run approved local probes against scoped routes and attach runtime evidence without side effects.",
        assignee: "runtime-verifier",
        dependencies: ["t2", "t3"],
        status: "pending",
      },
      {
        id: "t5",
        title: "Prioritize remediation queue",
        description: "Deduplicate findings, map evidence to ASVS/CWE, assign owners, and write verification steps.",
        assignee: "risk-reviewer",
        dependencies: ["t3", "t4"],
        status: "pending",
      },
    ],
  };
}

function createDesktopPreviewUrl(title: string, subtitle: string): string {
  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      body { margin: 0; background: #050707; color: #ecfff8; font-family: Inter, ui-sans-serif, system-ui; }
      .bar { height: 28px; background: #07110f; display: flex; align-items: center; gap: 8px; padding: 0 10px; border-bottom: 1px solid #1f3330; }
      .dot { width: 9px; height: 9px; border-radius: 50%; background: #22c55e; }
      .dot:nth-child(1) { background: #ef4444; }
      .dot:nth-child(2) { background: #f59e0b; }
      main { height: calc(100vh - 29px); display: grid; grid-template-columns: 1fr 1fr; gap: 16px; padding: 18px; box-sizing: border-box; }
      section { border: 1px solid #1f3330; background: #0c1110; border-radius: 10px; padding: 16px; }
      h1 { margin: 0 0 8px; font-size: 20px; }
      p { margin: 0; color: #9eb7b0; font-size: 13px; }
      .metric { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-top: 18px; }
      .card { background: #111a18; border: 1px solid #1f3330; border-radius: 8px; padding: 12px; }
      .value { font-size: 22px; font-weight: 700; color: #00e5a8; }
      .chart { height: 140px; margin-top: 18px; border-radius: 8px; background: linear-gradient(135deg, #102622, #07110f); position: relative; overflow: hidden; }
      .chart:after { content: ""; position: absolute; inset: 28px 20px; border: 2px solid #00e5a8; border-left: 0; border-bottom: 0; transform: skew(-18deg); }
      code { color: #00e5a8; }
    </style>
  </head>
  <body>
    <div class="bar"><span class="dot"></span><span class="dot"></span><span class="dot"></span><span style="margin-left:8px;color:#9eb7b0;font-size:12px">agent-vm / localhost:3000</span></div>
    <main>
      <section>
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(subtitle)}</p>
        <div class="metric">
          <div class="card"><p>Graph confidence</p><div class="value">94%</div></div>
          <div class="card"><p>Findings</p><div class="value">4</div></div>
          <div class="card"><p>High confidence</p><div class="value">3</div></div>
          <div class="card"><p>Owners</p><div class="value">4</div></div>
        </div>
      </section>
      <section>
        <h1>Live Assessment Preview</h1>
        <p><code>npm run dev</code> completed. Findings, graph, and remediation queue are visible for review.</p>
        <div class="chart"></div>
      </section>
    </main>
  </body>
</html>`;
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function walkDir(dir: string, root: string): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.name === ".claude" || entry.name === "node_modules") continue;
    if (entry.isDirectory()) files.push(...(await walkDir(full, root)));
    else files.push(path.relative(root, full));
  }
  return files;
}
