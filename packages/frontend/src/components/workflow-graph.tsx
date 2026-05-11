"use client";

import { useMemo, useCallback } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  Handle,
  Position,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { cn } from "@/lib/utils";
import type {
  MissionPlan,
  MissionAgentState,
  MissionAgentStatus,
  MissionTaskStatus,
} from "@northwall/shared";

// ─── Status Colors ───────────────────────────────────────────────────────────

const AGENT_STATUS_COLORS: Record<MissionAgentStatus, string> = {
  idle: "var(--color-node-idle)",
  working: "var(--color-node-working)",
  completed: "var(--color-node-completed)",
  error: "var(--color-node-error)",
};

const TASK_STATUS_COLORS: Record<MissionTaskStatus, string> = {
  pending: "var(--color-node-idle)",
  in_progress: "var(--color-node-working)",
  completed: "var(--color-node-completed)",
  failed: "var(--color-node-error)",
};

// ─── Custom Nodes ────────────────────────────────────────────────────────────

type AgentNodeData = {
  label: string;
  displayName?: string;
  specialization?: string;
  status: MissionAgentStatus;
};

function AgentNode({ data }: NodeProps<Node<AgentNodeData>>) {
  const statusColor = AGENT_STATUS_COLORS[data.status];
  const isWorking = data.status === "working";

  return (
    <div
      className={cn(
        "rounded-xl border-2 bg-bg-elevated px-4 py-3 min-w-[180px] shadow-lg",
        isWorking && "shadow-[0_0_12px_rgba(34,197,94,0.3)]"
      )}
      style={{ borderColor: statusColor }}
    >
      <Handle type="target" position={Position.Top} className="!bg-border !w-2 !h-2" />
      <div className="flex items-center gap-2 mb-1">
        <span
          className={cn("h-2.5 w-2.5 rounded-full shrink-0", isWorking && "animate-pulse")}
          style={{ backgroundColor: statusColor }}
        />
        <span className="text-sm font-semibold text-text-primary">
          {data.displayName ?? data.label}
        </span>
      </div>
      {data.displayName && (
        <p className="text-[10px] text-text-muted font-mono mb-0.5">{data.label}</p>
      )}
      {data.specialization && (
        <p className="text-[10px] text-accent">{data.specialization}</p>
      )}
      <div
        className="mt-1.5 text-[10px] font-medium capitalize"
        style={{ color: statusColor }}
      >
        {data.status}
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-border !w-2 !h-2" />
    </div>
  );
}

type TaskNodeData = {
  label: string;
  status: MissionTaskStatus;
};

function TaskNode({ data }: NodeProps<Node<TaskNodeData>>) {
  const statusColor = TASK_STATUS_COLORS[data.status];

  return (
    <div
      className="rounded-lg border bg-bg-surface px-3 py-2 min-w-[160px]"
      style={{ borderColor: statusColor }}
    >
      <Handle type="target" position={Position.Top} className="!bg-border !w-1.5 !h-1.5" />
      <p className="text-xs text-text-primary truncate">{data.label}</p>
      <div
        className="mt-1 text-[10px] font-medium capitalize"
        style={{ color: statusColor }}
      >
        {data.status}
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-border !w-1.5 !h-1.5" />
    </div>
  );
}

const nodeTypes = {
  agent: AgentNode,
  task: TaskNode,
};

// ─── Graph Builder ───────────────────────────────────────────────────────────

function buildGraph(
  plan: MissionPlan,
  agentStates: MissionAgentState[],
  missionStatus?: string,
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  const stateMap = new Map(agentStates.map((a) => [a.name, a]));

  // Agent nodes — horizontal row at y=0
  const agentSpacing = 220;
  const totalWidth = (plan.agents.length - 1) * agentSpacing;
  const startX = -totalWidth / 2;

  const agentXMap = new Map<string, number>();

  plan.agents.forEach((agent, idx) => {
    const x = startX + idx * agentSpacing;
    agentXMap.set(agent.name, x);
    const state = stateMap.get(agent.name);

    nodes.push({
      id: `agent-${agent.name}`,
      type: "agent",
      position: { x, y: 0 },
      data: {
        label: agent.name,
        displayName: agent.displayName,
        specialization: agent.specialization,
        status: state?.status === "idle" && missionStatus === "completed"
          ? "completed"
          : state?.status === "idle" && missionStatus === "failed"
          ? "error"
          : state?.status ?? "idle",
      } satisfies AgentNodeData,
    });
  });

  // Tasks — below assigned agent
  const agentTaskCount = new Map<string, number>();

  for (const task of plan.tasks) {
    const assignee = task.assignee ?? plan.agents[0]?.name ?? "unassigned";
    const count = agentTaskCount.get(assignee) ?? 0;
    agentTaskCount.set(assignee, count + 1);

    const agentX = agentXMap.get(assignee) ?? 0;
    const taskY = 150 + count * 70;

    nodes.push({
      id: `task-${task.id}`,
      type: "task",
      position: { x: agentX + 10, y: taskY },
      data: {
        label: task.title,
        status: task.status,
      } satisfies TaskNodeData,
    });

    // Edge: agent -> task
    edges.push({
      id: `edge-${assignee}-${task.id}`,
      source: `agent-${assignee}`,
      target: `task-${task.id}`,
      style: { stroke: "var(--color-edge-default)" },
    });

    // Dependency edges: task -> task
    for (const depId of task.dependencies) {
      edges.push({
        id: `dep-${depId}-${task.id}`,
        source: `task-${depId}`,
        target: `task-${task.id}`,
        animated: true,
        style: { stroke: "var(--color-edge-active)" },
        markerEnd: { type: "arrowclosed" as const, color: "var(--color-edge-active)" },
      });
    }
  }

  return { nodes, edges };
}

// ─── Component ───────────────────────────────────────────────────────────────

export function WorkflowGraph({
  plan,
  agentStates,
  missionStatus,
}: {
  plan: MissionPlan;
  agentStates: MissionAgentState[];
  missionStatus?: string;
}) {
  const { nodes, edges } = useMemo(
    () => buildGraph(plan, agentStates, missionStatus),
    [plan, agentStates, missionStatus]
  );

  const onInit = useCallback((instance: { fitView: () => void }) => {
    setTimeout(() => instance.fitView(), 50);
  }, []);

  return (
    <div className="h-full w-full" style={{ backgroundColor: "var(--color-bg)" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onInit={onInit}
        fitView
        proOptions={{ hideAttribution: true }}
        minZoom={0.3}
        maxZoom={1.5}
      >
        <Background color="var(--color-border)" gap={20} />
        <Controls
          className="!bg-bg-elevated !border-border !rounded-lg [&>button]:!bg-bg-elevated [&>button]:!border-border [&>button]:!text-text-muted [&>button:hover]:!bg-bg-hover"
        />
      </ReactFlow>
    </div>
  );
}
