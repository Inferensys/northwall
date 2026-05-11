"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { useMissionStore, buildDisplayNameMap } from "@/store/mission-store";
import { cn } from "@/lib/utils";
import type { MissionTaskStatus } from "@northwall/shared";

const WorkflowGraph = dynamic(
  () => import("./workflow-graph").then((m) => ({ default: m.WorkflowGraph })),
  { ssr: false }
);

const STATUS_STYLES: Record<
  MissionTaskStatus,
  { bg: string; text: string; dot: string }
> = {
  pending: {
    bg: "bg-bg-elevated",
    text: "text-text-muted",
    dot: "bg-text-muted",
  },
  in_progress: {
    bg: "bg-info/10",
    text: "text-info",
    dot: "bg-info animate-pulse",
  },
  completed: {
    bg: "bg-success/10",
    text: "text-success",
    dot: "bg-success",
  },
  failed: {
    bg: "bg-error/10",
    text: "text-error",
    dot: "bg-error",
  },
};

type View = "tasks" | "graph";

export function ProgressPanel() {
  const [view, setView] = useState<View>("tasks");
  const mission = useMissionStore((s) => s.mission);
  const plan = mission?.plan;
  const displayNameMap = useMemo(() => buildDisplayNameMap(plan), [plan]);

  if (!plan) {
    return (
      <div className="flex h-full flex-col">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-text-primary">Progress</h2>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-text-muted text-sm">
            Waiting for mission plan...
          </p>
        </div>
      </div>
    );
  }

  const tasks = plan.tasks;
  const completed = tasks.filter((t) => t.status === "completed").length;
  const total = tasks.length;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-text-primary">Progress</h2>
          <div className="flex gap-0.5 rounded-md bg-bg-elevated p-0.5">
            {(["tasks", "graph"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  "px-2 py-0.5 rounded text-[10px] font-medium capitalize transition-colors",
                  view === v
                    ? "bg-accent text-white"
                    : "text-text-muted hover:text-text-secondary"
                )}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
        <span className="text-xs text-text-secondary">
          {completed}/{total} tasks ({percent}%)
        </span>
      </div>

      {view === "graph" ? (
        <div className="flex-1 overflow-hidden">
          <WorkflowGraph plan={plan} agentStates={mission?.agents ?? []} missionStatus={mission?.status} />
        </div>
      ) : (
        <>
          {/* Progress bar */}
          <div className="px-4 pt-3">
            <div className="h-2 rounded-full bg-bg-elevated overflow-hidden">
              <div
                className="h-full rounded-full bg-accent transition-all duration-500"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>

          {/* Mission info */}
          <div className="px-4 pt-3 pb-2">
            <h3 className="text-sm font-medium text-text-primary">{plan.title}</h3>
            <p className="text-xs text-text-muted mt-1">{plan.objective}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[10px] text-text-muted">Complexity:</span>
              <span
                className={cn(
                  "text-[10px] font-medium px-1.5 py-0.5 rounded",
                  plan.estimatedComplexity === "simple" &&
                    "bg-success/10 text-success",
                  plan.estimatedComplexity === "moderate" &&
                    "bg-warning/10 text-warning",
                  plan.estimatedComplexity === "complex" &&
                    "bg-error/10 text-error"
                )}
              >
                {plan.estimatedComplexity}
              </span>
            </div>
          </div>

          {/* Task list */}
          <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-1.5">
            {tasks.map((task, idx) => {
              // On failed missions, show incomplete tasks as failed
              const effectiveStatus =
                mission?.status === "failed" && task.status !== "completed"
                  ? "failed"
                  : task.status;
              const style = STATUS_STYLES[effectiveStatus] ?? STATUS_STYLES.pending;
              const assigneeDisplay = task.assignee
                ? displayNameMap[task.assignee] ?? task.assignee
                : null;
              return (
                <div
                  key={task.id}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2",
                    style.bg
                  )}
                >
                  <span className="text-[10px] font-mono text-text-muted w-5 shrink-0">
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  <span
                    className={cn("h-2 w-2 rounded-full shrink-0", style.dot)}
                  />
                  <span className={cn("text-xs flex-1", style.text)}>
                    {task.title}
                  </span>
                  {assigneeDisplay && (
                    <span className="text-[10px] text-text-muted">
                      {assigneeDisplay}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
