import { query, type SDKMessage, type Options, type AgentDefinition } from "@anthropic-ai/claude-agent-sdk";
import { nanoid } from "nanoid";
import fs from "node:fs/promises";
import path from "node:path";
import type { MissionPlan, MissionTask, SessionEvent, SDKEnvelope } from "@northwall/shared";
import { type MissionEnvConfig, buildProcessEnv, getWorkspaceRoot } from "./mission-env.js";

// ─── Orchestrator Prompt ─────────────────────────────────────────────────────

function buildOrchestratorPrompt(plan: MissionPlan): string {
  const taskList = plan.tasks
    .map((t) => {
      const deps = t.dependencies.length > 0 ? ` (depends on: ${t.dependencies.join(", ")})` : "";
      const assignee = t.assignee ? ` [assigned to: ${t.assignee}]` : "";
      return `- [${t.id}] ${t.title}${assignee}${deps}\n  ${t.description}`;
    })
    .join("\n");

  const agentList = plan.agents
    .map((a) => `- **${a.name}** (subagent_type: "${a.name}"): ${a.description}`)
    .join("\n");

  // Compute parallel groups from dependency graph
  const parallelAnalysis = buildParallelAnalysis(plan.tasks);

  return `You are the Assessment Orchestrator for Northwall. You are executing the following authorized defensive AppSec plan.

## Assessment: ${plan.title}
**Objective:** ${plan.objective}

## Available Agents
${agentList}

## Task List
${taskList}

## Execution Strategy — PARALLEL DISPATCH
${parallelAnalysis}

## Instructions
1. **Analyze dependencies first.** Tasks with NO unmet dependencies MUST be dispatched simultaneously.
2. **Use the Task tool** to dispatch work to subagents. Set \`subagent_type\` to the agent name (e.g. "${plan.agents[0]?.name ?? "agent-name"}").
3. **ALWAYS dispatch multiple Task calls in a single response** when multiple tasks have all dependencies met. This runs them in parallel. DO NOT wait for one agent to finish before dispatching the next independent task.
4. After each batch completes, immediately dispatch newly unblocked tasks.
5. When ALL tasks are complete, provide a final summary with findings, evidence, owners, and verification steps.

## Critical Rules
- Delegate ALL work to subagents via the Task tool — do not do the work yourself
- When dispatching, include the task ID in the prompt (e.g. "Complete task t1: ...")
- If a task has no assignee, choose the best-fit agent
- NEVER dispatch tasks sequentially when they could run in parallel
- Only work on owned or explicitly authorized targets in the plan
- Do not run destructive tests, target third-party systems, collect credentials, or provide weaponized exploit output
- Require evidence for every finding and prefer remediation guidance over exploit detail`;
}

function buildParallelAnalysis(tasks: MissionTask[]): string {
  const completed = new Set<string>();
  const waves: string[][] = [];

  // Compute execution waves using topological sort
  const remaining = [...tasks];
  while (remaining.length > 0) {
    const wave = remaining.filter((t) =>
      t.dependencies.every((d) => completed.has(d))
    );
    if (wave.length === 0) break; // circular dependency guard
    waves.push(wave.map((t) => t.id));
    for (const t of wave) {
      completed.add(t.id);
      const idx = remaining.indexOf(t);
      if (idx >= 0) remaining.splice(idx, 1);
    }
  }

  return waves
    .map((ids, i) => {
      const label = ids.length > 1 ? `**Wave ${i + 1} (PARALLEL):**` : `**Wave ${i + 1}:**`;
      return `${label} ${ids.join(", ")}`;
    })
    .join("\n");
}

// ─── Tool Summarization (exported for frontend reuse) ────────────────────────

export function shortenPath(fullPath: unknown, workspace: string): string {
  const p = String(fullPath ?? "file");
  if (workspace && p.startsWith(workspace)) {
    return p.slice(workspace.length).replace(/^\//, "") || ".";
  }
  return p;
}

export function summarizeToolUse(toolName: string, input: Record<string, unknown>, workspace: string): string {
  switch (toolName) {
    case "Read":
      return `Reading ${shortenPath(input.file_path ?? input.path, workspace)}`;
    case "Write":
      return `Writing ${shortenPath(input.file_path ?? input.path, workspace)}`;
    case "Edit":
      return `Editing ${shortenPath(input.file_path ?? input.path, workspace)}`;
    case "Bash":
      return `Running: ${String(input.command ?? "").slice(0, 80)}`;
    case "Grep":
      return `Searching for '${input.pattern ?? ""}'`;
    case "Glob":
      return `Finding files: ${input.pattern ?? ""}`;
    case "WebFetch":
      return `Fetching ${input.url ?? "URL"}`;
    case "WebSearch":
      return `Searching: ${input.query ?? ""}`;
    case "Task":
    case "Agent":
      return `Dispatching agent: ${String(input.description ?? "").slice(0, 60)}`;
    case "NotebookEdit":
      return `Editing notebook ${shortenPath(input.notebook_path, workspace)}`;
    default:
      return `Using ${toolName}`;
  }
}

// ─── Mission Engine (thin SDK relay) ─────────────────────────────────────────

export class MissionEngine {
  private envConfig: MissionEnvConfig;
  private abortController: AbortController | null = null;
  private pendingMessage: string | null = null;

  constructor(envConfig: MissionEnvConfig) {
    this.envConfig = envConfig;
  }

  async initWorkspace(missionId: string): Promise<string> {
    const root = getWorkspaceRoot(this.envConfig);
    const workspace = path.join(root, missionId);
    await fs.mkdir(workspace, { recursive: true });
    // Resolve symlinks so paths match SDK output (macOS: /var → /private/var)
    return fs.realpath(workspace);
  }

  async executePlan(
    plan: MissionPlan,
    workspace: string,
    onSDKMessage: (envelope: SDKEnvelope) => void,
    onLifecycle: (event: SessionEvent) => void,
  ): Promise<void> {
    this.abortController = new AbortController();

    // Build AgentDefinition objects from plan
    const agents: Record<string, AgentDefinition> = {};
    for (const agent of plan.agents) {
      agents[agent.name] = {
        description: agent.description,
        prompt: agent.prompt,
        ...(agent.tools && { tools: agent.tools }),
        ...(agent.model && agent.model !== "inherit" && { model: agent.model as "sonnet" | "opus" | "haiku" }),
      };
    }

    const options: Options = {
      systemPrompt: buildOrchestratorPrompt(plan),
      agents,
      cwd: workspace,
      env: buildProcessEnv(this.envConfig),
      permissionMode: "bypassPermissions",
      allowDangerouslySkipPermissions: true,
      abortController: this.abortController,
    };

    const prompt = `Execute the authorized AppSec assessment plan now. Analyze the dependency graph and dispatch the first wave of tasks immediately. Remember: dispatch ALL independent tasks in PARALLEL by making multiple Task tool calls in a single response. Stay within safe owned-environment boundaries and record evidence for every finding.`;

    onLifecycle({
      id: nanoid(),
      sessionId: plan.id,
      type: "session_started",
      summary: `Assessment "${plan.title}" execution started`,
      timestamp: Date.now(),
    });

    try {
      const queryResult = query({ prompt, options });

      for await (const msg of queryResult) {
        onSDKMessage({
          id: nanoid(),
          sessionId: plan.id,
          timestamp: Date.now(),
          msg,
        });
      }

      onLifecycle({
        id: nanoid(),
        sessionId: plan.id,
        type: "session_completed",
        summary: `Assessment "${plan.title}" completed successfully`,
        timestamp: Date.now(),
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      onLifecycle({
        id: nanoid(),
        sessionId: plan.id,
        type: "session_error",
        summary: `Assessment failed: ${errorMsg}`,
        data: { error: errorMsg },
        timestamp: Date.now(),
      });
      throw err;
    }
  }

  async sendMessage(content: string): Promise<void> {
    this.pendingMessage = content;
  }

  abort(): void {
    this.abortController?.abort();
  }
}
