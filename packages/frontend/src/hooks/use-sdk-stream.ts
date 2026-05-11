"use client";

import { useMemo } from "react";
import { useMissionStore } from "@/store/mission-store";
import type { SDKEnvelope, MissionPlan, MissionAgentStatus, MissionTaskStatus } from "@northwall/shared";

// ─── Feed Entry Types ─────────────────────────────────────────────────────────

export type SDKFeedEntry =
  | { kind: "text"; agent?: string; content: string; timestamp: number }
  | { kind: "tool"; agent?: string; tool: string; summary: string; timestamp: number }
  | { kind: "agent_dispatch"; agent: string; displayName?: string; task?: string; timestamp: number }
  | { kind: "agent_complete"; agent: string; displayName?: string; durationMs?: number; summary?: string; timestamp: number }
  | { kind: "task_change"; taskId: string; title?: string; status: string; agent?: string; timestamp: number }
  | { kind: "result"; status: "success" | "error"; summary: string; costUsd?: number; durationMs?: number; turns?: number; timestamp: number }
  | { kind: "thinking"; agent?: string; timestamp: number }
  | { kind: "tool_summary"; agent?: string; summary: string; timestamp: number };

// ─── SDK Message Types (minimal shapes for type-safe casting) ─────────────────

interface SDKAssistantMsg {
  type: "assistant";
  parent_tool_use_id?: string | null;
  message: {
    content: Array<
      | { type: "text"; text: string }
      | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
    >;
  };
}

interface SDKResultMsg {
  type: "result";
  subtype: string;
  result?: string;
  total_cost_usd?: number;
  duration_ms?: number;
  num_turns?: number;
}

interface SDKSystemMsg {
  type: "system";
  subtype?: string;
  task_id?: string;
  tool_use_id?: string;
  description?: string;
  status?: string;
  summary?: string;
  usage?: Record<string, unknown>;
  last_tool_name?: string;
}

interface SDKToolProgressMsg {
  type: "tool_progress";
  tool_name: string;
  elapsed_time_seconds: number;
  tool_use_id?: string;
  parent_tool_use_id?: string | null;
  task_id?: string;
}

interface SDKToolUseSummaryMsg {
  type: "tool_use_summary";
  summary: string;
  preceding_tool_use_ids?: string[];
}

type AnySDKMsg = SDKAssistantMsg | SDKResultMsg | SDKSystemMsg | SDKToolProgressMsg | SDKToolUseSummaryMsg | { type: string };

// ─── Tool Summarization (duplicated from agent-runtime for client-side use) ───

function summarizeToolUse(toolName: string, input: Record<string, unknown>): string {
  switch (toolName) {
    case "Read":
      return `Reading ${shortenPath(input.file_path ?? input.path)}`;
    case "Write":
      return `Writing ${shortenPath(input.file_path ?? input.path)}`;
    case "Edit":
      return `Editing ${shortenPath(input.file_path ?? input.path)}`;
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
      return `Editing notebook ${shortenPath(input.notebook_path)}`;
    default:
      return `Using ${toolName}`;
  }
}

function shortenPath(p: unknown): string {
  const s = String(p ?? "file");
  // Take last 2 path components
  const parts = s.split("/");
  return parts.length > 2 ? parts.slice(-2).join("/") : s;
}

// ─── Core Processing ──────────────────────────────────────────────────────────

interface ProcessState {
  toolUseToAgent: Map<string, string>;
  taskIdToAgent: Map<string, string>;
  agentToTask: Map<string, string>;
  agentStatuses: Map<string, MissionAgentStatus>;
  agentStartTimes: Map<string, number>;
  taskStatuses: Map<string, MissionTaskStatus>;
  feed: SDKFeedEntry[];
  totalCostUsd: number | null;
  totalTurns: number | null;
  durationMs: number | null;
}

function createState(): ProcessState {
  return {
    toolUseToAgent: new Map(),
    taskIdToAgent: new Map(),
    agentToTask: new Map(),
    agentStatuses: new Map(),
    agentStartTimes: new Map(),
    taskStatuses: new Map(),
    feed: [],
    totalCostUsd: null,
    totalTurns: null,
    durationMs: null,
  };
}

function processEnvelope(
  envelope: SDKEnvelope,
  state: ProcessState,
  plan: MissionPlan | null,
): void {
  const msg = envelope.msg as AnySDKMsg;
  if (!msg || !msg.type) return;

  if (msg.type === "assistant") {
    processAssistant(msg as SDKAssistantMsg, envelope.timestamp, state, plan);
  } else if (msg.type === "result") {
    processResult(msg as SDKResultMsg, envelope.timestamp, state, plan);
  } else if (msg.type === "system") {
    processSystem(msg as SDKSystemMsg, envelope.timestamp, state);
  } else if (msg.type === "tool_progress") {
    processToolProgress(msg as SDKToolProgressMsg, envelope.timestamp, state);
  } else if (msg.type === "tool_use_summary") {
    processToolSummary(msg as SDKToolUseSummaryMsg, envelope.timestamp, state);
  }
}

function resolveAgent(parentToolUseId: string | null | undefined, state: ProcessState): string | undefined {
  if (parentToolUseId) return state.toolUseToAgent.get(parentToolUseId);
  return undefined;
}

function findAgentInPlan(name: string, plan: MissionPlan | null): { displayName?: string; specialization?: string } {
  if (!plan) return {};
  const a = plan.agents.find((ag) => ag.name === name);
  return a ? { displayName: a.displayName, specialization: a.specialization } : {};
}

function extractTaskId(text: string, plan: MissionPlan | null): string | undefined {
  if (!plan) return undefined;
  for (const t of plan.tasks) {
    const pattern = new RegExp(`\\b${t.id}\\b`, "i");
    if (pattern.test(text)) return t.id;
  }
  return undefined;
}

function processAssistant(
  msg: SDKAssistantMsg,
  timestamp: number,
  state: ProcessState,
  plan: MissionPlan | null,
): void {
  const agent = resolveAgent(msg.parent_tool_use_id, state) ?? (msg.parent_tool_use_id ? undefined : "orchestrator");

  for (const block of msg.message.content) {
    if (block.type === "text" && block.text.trim()) {
      state.feed.push({ kind: "text", agent, content: block.text, timestamp });
    } else if (block.type === "tool_use") {
      const isDispatch = block.name === "Task" || block.name === "Agent";

      if (isDispatch) {
        const input = block.input;
        const agentType = input.subagent_type as string | undefined;
        const agentName = agentType ?? findAgentByDescription(String(input.description ?? ""), plan);

        if (agentName) {
          state.toolUseToAgent.set(block.id, agentName);
          const info = findAgentInPlan(agentName, plan);

          // Auto-complete previous task if agent is being re-dispatched
          const prevStatus = state.agentStatuses.get(agentName);
          if (prevStatus === "working") {
            const startTime = state.agentStartTimes.get(agentName);
            state.feed.push({
              kind: "agent_complete",
              agent: agentName,
              displayName: info.displayName,
              durationMs: startTime ? timestamp - startTime : undefined,
              timestamp,
            });

            // Auto-complete the previous task
            const prevTaskId = state.agentToTask.get(agentName);
            if (prevTaskId && state.taskStatuses.get(prevTaskId) === "in_progress") {
              state.taskStatuses.set(prevTaskId, "completed");
              const taskInfo = plan?.tasks.find((t) => t.id === prevTaskId);
              state.feed.push({
                kind: "task_change",
                taskId: prevTaskId,
                title: taskInfo?.title,
                status: "completed",
                agent: agentName,
                timestamp,
              });
            }
          }

          state.agentStatuses.set(agentName, "working");
          state.agentStartTimes.set(agentName, timestamp);

          // Try to find which task this dispatch is for
          const promptText = input.prompt as string | undefined;
          const taskId = promptText ? extractTaskId(promptText, plan) : undefined;
          if (taskId) {
            state.agentToTask.set(agentName, taskId);
            if (state.taskStatuses.get(taskId) !== "completed") {
              state.taskStatuses.set(taskId, "in_progress");
              const taskInfo = plan?.tasks.find((t) => t.id === taskId);
              state.feed.push({
                kind: "task_change",
                taskId,
                title: taskInfo?.title,
                status: "in_progress",
                agent: agentName,
                timestamp,
              });
            }
          }

          state.feed.push({
            kind: "agent_dispatch",
            agent: agentName,
            displayName: info.displayName,
            task: taskId,
            timestamp,
          });
        }
      } else {
        // Regular tool use
        if (agent) state.toolUseToAgent.set(block.id, agent);
        state.feed.push({
          kind: "tool",
          agent,
          tool: block.name,
          summary: summarizeToolUse(block.name, block.input),
          timestamp,
        });
      }
    }
  }
}

function processResult(
  msg: SDKResultMsg,
  timestamp: number,
  state: ProcessState,
  plan: MissionPlan | null,
): void {
  if (msg.subtype === "success") {
    // Mark all working agents as completed
    for (const [name, status] of state.agentStatuses) {
      if (status === "working") {
        state.agentStatuses.set(name, "completed");
        const startTime = state.agentStartTimes.get(name);
        const info = findAgentInPlan(name, plan);
        state.feed.push({
          kind: "agent_complete",
          agent: name,
          displayName: info.displayName,
          durationMs: startTime ? timestamp - startTime : undefined,
          timestamp,
        });
        // Complete their tasks too
        const taskId = state.agentToTask.get(name);
        if (taskId && state.taskStatuses.get(taskId) === "in_progress") {
          state.taskStatuses.set(taskId, "completed");
          const taskInfo = plan?.tasks.find((t) => t.id === taskId);
          state.feed.push({
            kind: "task_change",
            taskId,
            title: taskInfo?.title,
            status: "completed",
            agent: name,
            timestamp,
          });
        }
      }
    }

    // Mark ALL remaining tasks as completed
    if (plan) {
      for (const task of plan.tasks) {
        if (!state.taskStatuses.has(task.id) || state.taskStatuses.get(task.id) !== "completed") {
          state.taskStatuses.set(task.id, "completed");
          state.feed.push({
            kind: "task_change",
            taskId: task.id,
            title: task.title,
            status: "completed",
            timestamp,
          });
        }
      }
    }

    state.totalCostUsd = msg.total_cost_usd ?? null;
    state.totalTurns = msg.num_turns ?? null;
    state.durationMs = msg.duration_ms ?? null;

    state.feed.push({
      kind: "result",
      status: "success",
      summary: msg.result?.slice(0, 200) ?? "Assessment completed",
      costUsd: msg.total_cost_usd,
      durationMs: msg.duration_ms,
      turns: msg.num_turns,
      timestamp,
    });
  } else {
    state.feed.push({
      kind: "result",
      status: "error",
      summary: `Mission error: ${msg.subtype}`,
      timestamp,
    });
  }
}

function processSystem(
  msg: SDKSystemMsg,
  timestamp: number,
  state: ProcessState,
): void {
  if (msg.subtype === "task_started") {
    let agentName: string | undefined;
    if (msg.tool_use_id) agentName = state.toolUseToAgent.get(msg.tool_use_id);
    if (agentName && msg.task_id) state.taskIdToAgent.set(msg.task_id, agentName);
    if (agentName && msg.tool_use_id) state.toolUseToAgent.set(msg.tool_use_id, agentName);
  } else if (msg.subtype === "task_notification") {
    const agentName = msg.task_id ? state.taskIdToAgent.get(msg.task_id) : undefined;
    if (agentName) {
      if (msg.status === "completed") {
        state.agentStatuses.set(agentName, "completed");
        // Task completion
        const taskId = state.agentToTask.get(agentName);
        if (taskId && state.taskStatuses.get(taskId) === "in_progress") {
          state.taskStatuses.set(taskId, "completed");
        }
      } else if (msg.status === "failed") {
        state.agentStatuses.set(agentName, "error");
        const taskId = state.agentToTask.get(agentName);
        if (taskId && state.taskStatuses.get(taskId) === "in_progress") {
          state.taskStatuses.set(taskId, "failed");
        }
      }
    }
  }
  // task_progress — just a heartbeat, no feed entry needed
}

function processToolProgress(
  msg: SDKToolProgressMsg,
  timestamp: number,
  state: ProcessState,
): void {
  const agent = resolveAgent(msg.parent_tool_use_id, state)
    ?? (msg.task_id ? state.taskIdToAgent.get(msg.task_id) : undefined);
  state.feed.push({
    kind: "tool",
    agent,
    tool: msg.tool_name,
    summary: `${msg.tool_name} (${msg.elapsed_time_seconds.toFixed(1)}s)`,
    timestamp,
  });
}

function processToolSummary(
  msg: SDKToolUseSummaryMsg,
  timestamp: number,
  state: ProcessState,
): void {
  const agent = msg.preceding_tool_use_ids?.length
    ? state.toolUseToAgent.get(msg.preceding_tool_use_ids[0]!)
    : undefined;
  state.feed.push({
    kind: "tool_summary",
    agent,
    summary: msg.summary,
    timestamp,
  });
}

function findAgentByDescription(description: string, plan: MissionPlan | null): string | undefined {
  if (!plan) return undefined;
  const lower = description.toLowerCase();
  for (const a of plan.agents) {
    if (lower.includes(a.name.toLowerCase())) return a.name;
  }
  return undefined;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface SDKStreamResult {
  feed: SDKFeedEntry[];
  agentStatuses: Map<string, MissionAgentStatus>;
  taskStatuses: Map<string, MissionTaskStatus>;
  totalCostUsd: number | null;
  totalTurns: number | null;
  durationMs: number | null;
}

export function useSDKStream(): SDKStreamResult {
  const sdkMessages = useMissionStore((s) => s.sdkMessages);
  const plan = useMissionStore((s) => s.mission?.plan ?? null);

  return useMemo(() => {
    const state = createState();

    // Initialize task statuses from plan
    if (plan) {
      for (const task of plan.tasks) {
        state.taskStatuses.set(task.id, "pending");
      }
      for (const agent of plan.agents) {
        state.agentStatuses.set(agent.name, "idle");
      }
    }

    // Process all messages in order
    for (const envelope of sdkMessages) {
      processEnvelope(envelope, state, plan);
    }

    return {
      feed: state.feed,
      agentStatuses: state.agentStatuses,
      taskStatuses: state.taskStatuses,
      totalCostUsd: state.totalCostUsd,
      totalTurns: state.totalTurns,
      durationMs: state.durationMs,
    };
  }, [sdkMessages, plan]);
}
