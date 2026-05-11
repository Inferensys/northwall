import { query, type Options, type AgentDefinition } from "@anthropic-ai/claude-agent-sdk";
import { nanoid } from "nanoid";
import fs from "node:fs/promises";
import path from "node:path";

interface MissionPlan {
  id: string;
  title: string;
  objective: string;
  agents: Array<{
    name: string;
    displayName?: string;
    specialization?: string;
    description: string;
    prompt: string;
    tools?: string[];
    model?: string;
    mcpServers?: string[];
  }>;
  tasks: Array<{
    id: string;
    title: string;
    description: string;
    assignee: string | null;
    dependencies: string[];
    status: string;
  }>;
  mcpServers?: Record<string, unknown>;
  estimatedComplexity: string;
  createdAt: number;
}

interface EnvConfig {
  foundryResource: string;
  foundryApiKey: string;
  defaultModel?: string;
  capableModel?: string;
  imageGenEndpoint?: string;
  imageGenApiKey?: string;
}

interface SessionEvent {
  id: string;
  sessionId: string;
  type: string;
  agent?: string;
  summary: string;
  data?: Record<string, unknown>;
  timestamp: number;
}

type EventCallback = (event: SessionEvent) => void;

const WORKSPACE = "/workspace";

// ─── Orchestrator Prompt (copied from mission-engine.ts) ─────────────────────

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

  const parallelAnalysis = buildParallelAnalysis(plan.tasks);

  return `You are the Mission Orchestrator for Northwall. You are executing the following mission plan.

## Mission: ${plan.title}
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
5. When ALL tasks are complete, provide a final summary.

## Critical Rules
- Delegate ALL work to subagents via the Task tool — do not do the work yourself
- When dispatching, include the task ID in the prompt (e.g. "Complete task t1: ...")
- If a task has no assignee, choose the best-fit agent
- NEVER dispatch tasks sequentially when they could run in parallel
- You have a full desktop environment available (DISPLAY=:99) with Chromium browser
- Agents can use browser tools (Playwright MCP) for web interaction`;
}

function buildParallelAnalysis(tasks: MissionPlan["tasks"]): string {
  const completed = new Set<string>();
  const waves: string[][] = [];

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

// ─── Executor ────────────────────────────────────────────────────────────────

export class Executor {
  private status: "idle" | "running" | "completed" | "error" = "idle";
  private eventCallbacks: EventCallback[] = [];
  private abortController: AbortController | null = null;
  private missionId: string | null = null;

  onEvent(cb: EventCallback) {
    this.eventCallbacks.push(cb);
  }

  private emit(event: SessionEvent) {
    for (const cb of this.eventCallbacks) {
      try {
        cb(event);
      } catch (err) {
        console.error("[executor] Event callback error:", err);
      }
    }
  }

  getStatus() {
    return this.status;
  }

  async execute(plan: MissionPlan, envConfig: EnvConfig, missionId: string) {
    if (this.status === "running") {
      throw new Error("Already executing a mission");
    }

    this.missionId = missionId;
    this.status = "running";
    this.abortController = new AbortController();

    // Build environment variables for Claude Code
    const env: Record<string, string> = {
      ...(process.env as Record<string, string>),
      CLAUDE_CODE_USE_FOUNDRY: "1",
      ANTHROPIC_FOUNDRY_RESOURCE: envConfig.foundryResource,
      ANTHROPIC_FOUNDRY_API_KEY: envConfig.foundryApiKey,
      DISPLAY: ":99",
    };

    if (envConfig.defaultModel) {
      env.ANTHROPIC_DEFAULT_SONNET_MODEL = envConfig.defaultModel;
    }
    if (envConfig.capableModel) {
      env.ANTHROPIC_DEFAULT_OPUS_MODEL = envConfig.capableModel;
    }
    if (envConfig.imageGenEndpoint) {
      env.AZURE_IMAGE_GEN_ENDPOINT = envConfig.imageGenEndpoint;
    }
    if (envConfig.imageGenApiKey) {
      env.AZURE_IMAGE_GEN_KEY = envConfig.imageGenApiKey;
    }

    // Remove nesting guard
    delete env.CLAUDECODE;

    this.emit({
      id: nanoid(),
      sessionId: missionId,
      type: "session_started",
      summary: `Mission started: ${plan.title}`,
      timestamp: Date.now(),
    });

    // Build AgentDefinition objects as Record<string, AgentDefinition>
    // (NOT an array — the SDK expects a record keyed by agent name)
    const agents: Record<string, AgentDefinition> = {};
    for (const agent of plan.agents) {
      agents[agent.name] = {
        description: agent.description,
        prompt: agent.prompt,
        ...(agent.tools && { tools: agent.tools }),
        ...(agent.model && agent.model !== "inherit" && { model: agent.model as "sonnet" | "opus" | "haiku" }),
      };
    }

    // Build orchestrator prompt (same as mission-engine.ts)
    const systemPrompt = buildOrchestratorPrompt(plan);

    // Options object — systemPrompt, env, abortController go INSIDE options
    const options: Options = {
      systemPrompt,
      agents,
      cwd: WORKSPACE,
      env,
      permissionMode: "bypassPermissions",
      allowDangerouslySkipPermissions: true,
      abortController: this.abortController,
    };

    // prompt is a string, not an array of messages
    const prompt = `Execute the mission plan now. Analyze the dependency graph and dispatch the first wave of tasks immediately. Remember: dispatch ALL independent tasks in PARALLEL by making multiple Task tool calls in a single response.`;

    try {
      const queryResult = query({ prompt, options });

      for await (const message of queryResult) {
        this.processMessage(message, missionId);
      }

      this.status = "completed";
      this.emit({
        id: nanoid(),
        sessionId: missionId,
        type: "session_completed",
        summary: "Assessment completed successfully",
        timestamp: Date.now(),
      });
    } catch (err) {
      this.status = "error";
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error("[executor] Mission execution error:", errMsg);
      this.emit({
        id: nanoid(),
        sessionId: missionId,
        type: "session_error",
        summary: `Mission failed: ${errMsg}`,
        timestamp: Date.now(),
      });
    }
  }

  private processMessage(msg: unknown, sessionId: string) {
    // Duck-type SDK messages — same logic as MissionEngine.processMessage
    const message = msg as Record<string, unknown>;

    if (message.type === "assistant") {
      const content = message.content as Array<Record<string, unknown>> | undefined;
      // SDK wraps content in message.message.content
      const msgObj = message.message as Record<string, unknown> | undefined;
      const contentArr = content ?? (msgObj?.content as Array<Record<string, unknown>> | undefined);
      if (!contentArr) return;

      for (const block of contentArr) {
        if (block.type === "text" && block.text) {
          this.emit({
            id: nanoid(),
            sessionId,
            type: "agent_message",
            agent: "orchestrator",
            summary: String(block.text).slice(0, 500),
            data: { text: block.text },
            timestamp: Date.now(),
          });
        }

        if (block.type === "tool_use") {
          const toolName = String(block.name ?? "unknown");
          const input = block.input as Record<string, unknown> | undefined;

          // Detect agent dispatches (Task or Agent tool)
          if ((toolName === "Task" || toolName === "Agent") && input?.subagent_type) {
            const agentName = String(input.subagent_type);
            this.emit({
              id: nanoid(),
              sessionId,
              type: "agent_working",
              agent: agentName,
              summary: `Agent ${agentName} started working`,
              data: { prompt: input.prompt },
              timestamp: Date.now(),
            });
          }

          this.emit({
            id: nanoid(),
            sessionId,
            type: "tool_executed",
            agent: "orchestrator",
            summary: `Tool: ${toolName}`,
            data: {
              tool: toolName,
              input: input ?? {},
              toolUseId: block.id,
            },
            timestamp: Date.now(),
          });
        }
      }
    }

    if (message.type === "result") {
      const subtype = message.subtype as string | undefined;
      if (subtype === "success") {
        this.emit({
          id: nanoid(),
          sessionId,
          type: "status_update",
          summary: `Mission result: ${String(message.result ?? "completed").slice(0, 200)}`,
          data: {
            costUsd: message.total_cost_usd,
            turns: message.num_turns,
            durationMs: message.duration_ms,
          },
          timestamp: Date.now(),
        });
      } else if (subtype === "error") {
        this.emit({
          id: nanoid(),
          sessionId,
          type: "session_error",
          summary: `Error: ${message.error ?? "unknown"}`,
          data: { error: message.error },
          timestamp: Date.now(),
        });
      }
    }

    // Tool progress messages
    if (message.tool_name && message.elapsed_time_seconds != null) {
      this.emit({
        id: nanoid(),
        sessionId,
        type: "tool_executed",
        agent: "orchestrator",
        summary: `Tool: ${message.tool_name} (${message.elapsed_time_seconds}s)`,
        data: {
          tool: message.tool_name,
          elapsed: message.elapsed_time_seconds,
        },
        timestamp: Date.now(),
      });
    }

    // Tool use summary messages
    if (message.summary && message.preceding_tool_use_ids) {
      this.emit({
        id: nanoid(),
        sessionId,
        type: "agent_message",
        agent: "orchestrator",
        summary: String(message.summary),
        data: { isSummary: true },
        timestamp: Date.now(),
      });
    }
  }

  async sendMessage(content: string) {
    // In the current SDK model, we can't inject messages mid-stream.
    // This is a placeholder for future SDK support.
    console.log("[executor] sendMessage:", content);
  }

  abort() {
    if (this.abortController) {
      this.abortController.abort();
      this.status = "error";
    }
  }

  async listFiles(dir?: string): Promise<string[]> {
    const target = dir ? path.resolve(WORKSPACE, dir) : WORKSPACE;
    if (!target.startsWith(WORKSPACE)) return [];
    try {
      return await walkDir(target, WORKSPACE);
    } catch {
      return [];
    }
  }

  async readFile(filePath: string): Promise<string | null> {
    const target = path.resolve(WORKSPACE, filePath);
    if (!target.startsWith(WORKSPACE)) return null;
    try {
      return await fs.readFile(target, "utf-8");
    } catch {
      return null;
    }
  }
}

async function walkDir(dir: string, root: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkDir(full, root)));
    } else {
      files.push(path.relative(root, full));
    }
  }
  return files;
}
