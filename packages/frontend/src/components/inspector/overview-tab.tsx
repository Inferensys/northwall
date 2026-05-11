"use client";

import { useMissionStore } from "@/store/mission-store";
import { cn } from "@/lib/utils";
import type { MissionAgentStatus } from "@northwall/shared";

const STATUS_COLORS: Record<MissionAgentStatus, string> = {
  idle: "text-text-muted",
  working: "text-success",
  error: "text-error",
  completed: "text-info",
};

const STATUS_DOTS: Record<MissionAgentStatus, string> = {
  idle: "bg-text-muted",
  working: "bg-success animate-pulse",
  error: "bg-error",
  completed: "bg-info",
};

export function OverviewTab() {
  const mission = useMissionStore((s) => s.mission);
  const agents = mission?.agents ?? [];
  const planAgents = mission?.plan?.agents ?? [];

  const agentDescriptions = new Map(
    planAgents.map((a) => [a.name, a.description])
  );

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-3 space-y-2">
        <h2 className="text-sm font-semibold text-text-primary">
          Agent Status
        </h2>
        {mission?.status && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted">Mission:</span>
            <span className="text-xs font-medium text-text-secondary capitalize">
              {mission.status}
            </span>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {agents.length === 0 && (
          <p className="text-text-muted text-sm text-center py-4">
            No agents active
          </p>
        )}

        {agents.map((agent) => (
          <div
            key={agent.name}
            className="rounded-lg bg-bg-elevated border border-border p-3 space-y-1.5"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "h-2 w-2 rounded-full",
                    STATUS_DOTS[agent.status]
                  )}
                />
                <span className="text-sm font-medium text-text-primary">
                  {agent.displayName ?? agent.name}
                </span>
                {agent.displayName && (
                  <span className="text-[10px] font-mono text-text-muted">
                    ({agent.name})
                  </span>
                )}
              </div>
              <span
                className={cn(
                  "text-xs capitalize",
                  STATUS_COLORS[agent.status]
                )}
              >
                {agent.status}
              </span>
            </div>

            {agent.specialization && (
              <p className="text-[10px] text-accent">
                {agent.specialization}
              </p>
            )}

            {agentDescriptions.get(agent.name) && (
              <p className="text-[10px] text-text-muted">
                {agentDescriptions.get(agent.name)}
              </p>
            )}

            {agent.currentAction && (
              <p className="text-xs text-text-secondary truncate">
                {agent.currentAction}
              </p>
            )}

            <div className="flex items-center gap-3 text-[10px] text-text-muted">
              <span>{agent.messagesProcessed} messages</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
