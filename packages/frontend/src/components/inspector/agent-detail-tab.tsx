"use client";

import { useMemo, useRef, useEffect } from "react";
import { useMissionStore } from "@/store/mission-store";
import { cn, formatTime } from "@/lib/utils";
import type { MissionAgentStatus, EventType } from "@northwall/shared";

const STATUS_DOTS: Record<MissionAgentStatus, string> = {
  idle: "bg-text-muted",
  working: "bg-success animate-pulse",
  error: "bg-error",
  completed: "bg-info",
};

const EVENT_ICONS: Partial<Record<EventType, string>> = {
  task_assigned: "📋",
  task_started: "▶️",
  task_completed: "✅",
  task_failed: "❌",
  agent_spawned: "🤖",
  agent_working: "⚡",
  agent_idle: "💤",
  agent_error: "⚠️",
  agent_created: "🔧",
  agent_message_streamed: "💬",
  tool_executed: "🔧",
  context_share: "📤",
};

export function AgentDetailTab({ agentName }: { agentName: string }) {
  const mission = useMissionStore((s) => s.mission);
  const events = useMissionStore((s) => s.events);
  const bottomRef = useRef<HTMLDivElement>(null);

  const agent = mission?.agents.find((a) => a.name === agentName);
  const planAgent = mission?.plan?.agents.find((a) => a.name === agentName);

  const agentEvents = useMemo(
    () => events.filter((e) => e.agent === agentName),
    [events.length, agentName]
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [agentEvents.length]);

  return (
    <div className="flex h-full flex-col">
      {/* Agent header card */}
      <div className="border-b border-border px-4 py-3 space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {agent && (
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  STATUS_DOTS[agent.status]
                )}
              />
            )}
            <span className="text-sm font-semibold text-text-primary">
              {agent?.displayName ?? agentName}
            </span>
            {agent?.displayName && (
              <span className="text-[10px] font-mono text-text-muted">
                ({agentName})
              </span>
            )}
          </div>
          {agent && (
            <span className="text-xs text-text-muted capitalize">
              {agent.status}
            </span>
          )}
        </div>
        {agent?.specialization && (
          <p className="text-[10px] text-accent">{agent.specialization}</p>
        )}
        {planAgent?.description && (
          <p className="text-[10px] text-text-muted">{planAgent.description}</p>
        )}
        {agent?.currentAction && (
          <p className="text-xs text-accent truncate">
            {agent.currentAction}
          </p>
        )}
      </div>

      {/* Event stream */}
      <div className="flex-1 overflow-y-auto">
        {agentEvents.length === 0 && (
          <p className="text-text-muted text-sm text-center py-8">
            No events from {agentName}
          </p>
        )}

        <div className="divide-y divide-border/50">
          {agentEvents.map((event) => (
            <div
              key={event.id}
              className="px-4 py-2 hover:bg-bg-hover/50 transition-colors"
            >
              <div className="flex items-start gap-2">
                <span className="text-xs shrink-0 mt-0.5">
                  {EVENT_ICONS[event.type] ?? "·"}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-text-primary">
                    {event.summary}
                  </p>
                  <span className="text-[10px] text-text-muted">
                    {formatTime(event.timestamp)}
                  </span>

                  {/* Expanded tool_executed details */}
                  {event.type === "tool_executed" && event.data && (() => {
                    const d = event.data as Record<string, unknown>;
                    const toolName = d.tool ? String(d.tool) : null;
                    const argsStr = d.args
                      ? typeof d.args === "string"
                        ? d.args
                        : JSON.stringify(d.args, null, 2)
                      : null;
                    return (
                      <div className="mt-1.5 rounded bg-bg border border-border p-2">
                        {toolName && (
                          <p className="text-[10px] font-medium text-accent mb-1">
                            {toolName}
                          </p>
                        )}
                        {argsStr && (
                          <pre className="text-[10px] text-text-secondary overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
                            {argsStr}
                          </pre>
                        )}
                      </div>
                    );
                  })()}

                  {/* Context share details */}
                  {event.type === "context_share" && event.data && (() => {
                    const d = event.data as Record<string, unknown>;
                    const text = String(d.finding ?? d.summary ?? "");
                    return text ? (
                      <div className="mt-1 text-[10px] text-text-secondary italic">
                        {text}
                      </div>
                    ) : null;
                  })()}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
