"use client";

import { useState, useMemo } from "react";
import { useMissionStore } from "@/store/mission-store";
import { cn } from "@/lib/utils";
import { AgentDetailTab } from "./inspector/agent-detail-tab";
import { WorkspaceTab } from "./inspector/workspace-tab";
import type { MissionAgentStatus } from "@northwall/shared";

type TabId = "files" | string;

const STATUS_TAB_DOTS: Record<MissionAgentStatus, { color: string; pulse?: boolean }> = {
  idle: { color: "bg-text-muted" },
  working: { color: "bg-success", pulse: true },
  completed: { color: "bg-info" },
  error: { color: "bg-error" },
};

export function WorkspaceInspector({
  missionId,
}: {
  missionId: string;
}) {
  const [activeTab, setActiveTab] = useState<TabId>("files");
  const mission = useMissionStore((s) => s.mission);
  const planAgents = mission?.plan?.agents ?? [];
  const liveAgents = mission?.agents ?? [];

  const tabs = useMemo(() => {
    const base: { id: TabId; label: string }[] = [];
    for (const agent of planAgents) {
      base.push({ id: agent.name, label: agent.displayName ?? agent.name });
    }
    base.push({ id: "files", label: "Files" });
    return base;
  }, [planAgents]);

  const agentNames = new Set(planAgents.map((a) => a.name));
  const agentStatusMap = new Map(
    liveAgents.map((a) => [a.name, a.status])
  );

  return (
    <div className="flex h-full flex-col">
      {/* Tab bar */}
      <div className="border-b border-border overflow-x-auto shrink-0">
        <div className="flex">
          {tabs.map((tab) => {
            const isAgent = agentNames.has(tab.id);
            const agentStatus = isAgent ? agentStatusMap.get(tab.id) : undefined;
            const dot = agentStatus ? STATUS_TAB_DOTS[agentStatus] : undefined;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "relative whitespace-nowrap px-2.5 py-2 text-[10px] font-medium transition-colors flex items-center gap-1.5",
                  activeTab === tab.id
                    ? "text-accent border-b-2 border-accent"
                    : "text-text-muted hover:text-text-secondary"
                )}
              >
                {dot && (
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full shrink-0",
                      dot.color,
                      dot.pulse && "animate-pulse"
                    )}
                  />
                )}
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "files" && <WorkspaceTab missionId={missionId} />}
        {agentNames.has(activeTab) && (
          <AgentDetailTab agentName={activeTab} />
        )}
      </div>
    </div>
  );
}
