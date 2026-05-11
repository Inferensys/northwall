"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useMissionStore, buildDisplayNameMap } from "@/store/mission-store";
import { Markdown } from "@/components/markdown";
import { cn, formatTime, formatDuration } from "@/lib/utils";
import { ChevronRight, ChevronDown } from "lucide-react";
import type { SessionEvent, EventType } from "@northwall/shared";

// ─── Filters ─────────────────────────────────────────────────────────────────

const FILTERS = ["all", "agents", "tools", "system"] as const;
type Filter = (typeof FILTERS)[number];

const FILTER_TYPES: Record<Filter, EventType[] | null> = {
  all: null,
  agents: [
    "agent_working",
    "agent_completed",
    "agent_message",
    "agent_thinking",
    "agent_created",
    "agent_spawned",
    "agent_idle",
    "agent_error",
  ],
  tools: ["tool_executed"],
  system: [
    "session_started",
    "session_completed",
    "session_error",
    "status_update",
    "mission_planned",
    "task_status_changed",
  ],
};

// In "all" mode, hide noisy status_update events (they're just "agent: processing" pings)
const HIDDEN_IN_ALL: Set<EventType> = new Set(["status_update"]);

// ─── Narrative Blocks ────────────────────────────────────────────────────────

type NarrativeBlock =
  | { kind: "event"; event: SessionEvent }
  | { kind: "team_assembled"; events: SessionEvent[] }
  | { kind: "tool_group"; agent: string | undefined; events: SessionEvent[] };

function groupIntoBlocks(events: SessionEvent[]): NarrativeBlock[] {
  const blocks: NarrativeBlock[] = [];
  let i = 0;
  while (i < events.length) {
    const event = events[i]!;

    // Group consecutive agent_created events into "Team Assembled"
    if (event.type === "agent_created") {
      const group: SessionEvent[] = [event];
      while (i + 1 < events.length && events[i + 1]!.type === "agent_created") {
        i++;
        group.push(events[i]!);
      }
      if (group.length > 1) {
        blocks.push({ kind: "team_assembled", events: group });
      } else {
        blocks.push({ kind: "event", event });
      }
      i++;
      continue;
    }

    // Group consecutive tool_executed events from the same agent
    if (event.type === "tool_executed") {
      const agent = event.agent;
      const group: SessionEvent[] = [event];
      while (
        i + 1 < events.length &&
        events[i + 1]!.type === "tool_executed" &&
        events[i + 1]!.agent === agent
      ) {
        i++;
        group.push(events[i]!);
      }
      if (group.length >= 3) {
        blocks.push({ kind: "tool_group", agent, events: group });
      } else {
        for (const e of group) {
          blocks.push({ kind: "event", event: e });
        }
      }
      i++;
      continue;
    }

    blocks.push({ kind: "event", event });
    i++;
  }
  return blocks;
}

// ─── Agent Badge ─────────────────────────────────────────────────────────────

const AGENT_COLORS = [
  "bg-accent/20 text-accent",
  "bg-success/20 text-success",
  "bg-warning/20 text-warning",
  "bg-info/20 text-info",
  "bg-error/20 text-error",
  "bg-[#ec4899]/20 text-[#ec4899]",
  "bg-[#8b5cf6]/20 text-[#8b5cf6]",
];

function agentColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return AGENT_COLORS[Math.abs(hash) % AGENT_COLORS.length]!;
}

function AgentBadge({ name, displayName }: { name: string; displayName?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
        agentColor(name)
      )}
    >
      {displayName ?? name}
    </span>
  );
}

// ─── Thinking Indicator ──────────────────────────────────────────────────────

function ThinkingIndicator({ displayName }: { displayName: string }) {
  return (
    <div className="flex items-center gap-2 px-4 py-2">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
      </span>
      <span className="text-xs text-text-muted italic">
        {displayName} thinking...
      </span>
    </div>
  );
}

// ─── Team Assembled Block ────────────────────────────────────────────────────

function TeamAssembledBlock({
  events,
  displayNameMap,
}: {
  events: SessionEvent[];
  displayNameMap: Record<string, string>;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-l-2 border-l-accent bg-accent/5">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left hover:bg-accent/10 transition-colors"
      >
        {expanded ? (
          <ChevronDown className="h-3 w-3 text-accent shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 text-accent shrink-0" />
        )}
        <span className="text-xs font-medium text-accent">
          Team assembled
        </span>
        <span className="text-[10px] text-text-muted">
          {events.length} agents ready
        </span>
      </button>
      {expanded && (
        <div className="px-4 pb-2.5 space-y-1.5">
          {events.map((e) => {
            const name = e.agent ?? "unknown";
            const display = displayNameMap[name] ?? name;
            // Extract description from summary (after "created: ")
            const desc = e.summary.includes(": ")
              ? e.summary.slice(e.summary.indexOf(": ") + 2)
              : e.summary;
            return (
              <div key={e.id} className="flex items-center gap-2">
                <AgentBadge name={name} displayName={display} />
                <span className="text-[10px] text-text-secondary truncate">
                  {desc}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Tool Use Entry (compact, collapsible) ───────────────────────────────────

function ToolUseEntry({ event, compact }: { event: SessionEvent; compact?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const data = event.data as Record<string, unknown> | undefined;
  const toolName = data?.tool as string | undefined;
  const summary = data?.summary as string | undefined;
  const elapsed = data?.elapsedSeconds as number | undefined;
  const input = data?.input as Record<string, unknown> | undefined;
  const hasDetails = !!input;

  return (
    <div>
      <button
        onClick={() => hasDetails && setExpanded(!expanded)}
        className={cn(
          "flex w-full items-center gap-2 text-left transition-colors",
          compact ? "px-6 py-1" : "px-4 py-1.5",
          hasDetails && "hover:bg-bg-hover/50 cursor-pointer",
          !hasDetails && "cursor-default"
        )}
      >
        {hasDetails ? (
          <ChevronRight
            className={cn(
              "h-3 w-3 text-text-muted transition-transform shrink-0",
              expanded && "rotate-90"
            )}
          />
        ) : (
          <span className="w-3 shrink-0" />
        )}
        <span className="text-[10px] font-mono font-medium text-accent shrink-0">
          {toolName ?? "Tool"}
        </span>
        <span className="text-xs text-text-secondary truncate flex-1">
          {summary ?? event.summary}
        </span>
        {elapsed != null && (
          <span className="text-[10px] text-text-muted font-mono shrink-0">
            {elapsed.toFixed(1)}s
          </span>
        )}
      </button>
      {expanded && input && (
        <div className="ml-8 mr-4 mb-1.5 rounded bg-bg border border-border p-2">
          <pre className="text-[10px] text-text-secondary overflow-x-auto whitespace-pre-wrap break-all leading-relaxed max-h-40 overflow-y-auto">
            {JSON.stringify(input, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

// ─── Tool Group (collapsed consecutive tools from same agent) ────────────────

function ToolGroupBlock({
  agent,
  events,
  displayNameMap,
  showBadge,
}: {
  agent: string | undefined;
  events: SessionEvent[];
  displayNameMap: Record<string, string>;
  showBadge: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const agentDisplay = agent ? displayNameMap[agent] ?? agent : undefined;

  // Show the last tool's summary as a preview
  const lastData = events[events.length - 1]?.data as Record<string, unknown> | undefined;
  const lastSummary = lastData?.summary as string | undefined;

  return (
    <div>
      {showBadge && agent && (
        <div className="px-4 pt-2 pb-0.5">
          <AgentBadge name={agent} displayName={agentDisplay} />
        </div>
      )}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-4 py-1.5 text-left hover:bg-bg-hover/50 transition-colors"
      >
        {expanded ? (
          <ChevronDown className="h-3 w-3 text-text-muted shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 text-text-muted shrink-0" />
        )}
        <span className="text-[10px] font-mono font-medium text-text-muted shrink-0">
          {events.length} actions
        </span>
        {!expanded && lastSummary && (
          <span className="text-xs text-text-secondary truncate flex-1 italic">
            ...{lastSummary}
          </span>
        )}
      </button>
      {expanded && (
        <div className="border-l-2 border-l-border/50 ml-4">
          {events.map((e) => (
            <ToolUseEntry key={e.id} event={e} compact />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Collapsible Message ─────────────────────────────────────────────────────

const MESSAGE_TRUNCATE_LEN = 200;

function CollapsibleMessage({ text, className, useMarkdown }: { text: string; className?: string; useMarkdown?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const needsTruncation = text.length > MESSAGE_TRUNCATE_LEN;
  const displayText = needsTruncation && !expanded
    ? text.slice(0, MESSAGE_TRUNCATE_LEN) + "..."
    : text;

  return (
    <div>
      {useMarkdown ? (
        <Markdown content={displayText} className={cn("text-xs leading-relaxed", className)} />
      ) : (
        <p className={cn("text-xs leading-relaxed whitespace-pre-wrap", className)}>
          {displayText}
        </p>
      )}
      {needsTruncation && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-[10px] text-accent hover:text-accent-hover mt-0.5"
        >
          {expanded ? "show less" : "show more"}
        </button>
      )}
    </div>
  );
}

// ─── System Banner ───────────────────────────────────────────────────────────

function SystemBanner({ event }: { event: SessionEvent }) {
  const data = event.data as Record<string, unknown> | undefined;
  const isCompleted = event.type === "session_completed";
  const isError = event.type === "session_error";
  const isStarted = event.type === "session_started";
  const costUsd = data?.costUsd as number | undefined;
  const durationMs = data?.durationMs as number | undefined;
  const turns = data?.turns as number | undefined;

  return (
    <div
      className={cn(
        "px-4 py-2.5 text-xs font-medium border-l-2",
        isStarted && "border-l-success bg-success/5 text-success",
        isCompleted && "border-l-info bg-info/5 text-info",
        isError && "border-l-error bg-error/5 text-error",
        !isStarted && !isCompleted && !isError && "border-l-text-muted bg-bg-elevated text-text-secondary"
      )}
    >
      <div>{event.summary}</div>
      {(costUsd != null || durationMs != null || turns != null) && (
        <div className="flex gap-3 mt-1 text-[10px] text-text-muted">
          {durationMs != null && <span>{formatDuration(durationMs)}</span>}
          {turns != null && <span>{turns} turns</span>}
          {costUsd != null && <span>${costUsd.toFixed(4)}</span>}
        </div>
      )}
    </div>
  );
}

// ─── Activity Entry (single event) ──────────────────────────────────────────

function ActivityEntry({
  event,
  showBadge,
  displayNameMap,
}: {
  event: SessionEvent;
  showBadge: boolean;
  displayNameMap: Record<string, string>;
}) {
  const agentDisplay = event.agent ? displayNameMap[event.agent] ?? event.agent : undefined;
  const data = event.data as Record<string, unknown> | undefined;
  const isSummary = data?.isSummary === true;

  // System banners
  if (
    event.type === "session_started" ||
    event.type === "session_completed" ||
    event.type === "session_error"
  ) {
    return <SystemBanner event={event} />;
  }

  // Tool executed — collapsible
  if (event.type === "tool_executed") {
    return (
      <div>
        {showBadge && event.agent && (
          <div className="px-4 pt-2 pb-0.5">
            <AgentBadge name={event.agent} displayName={agentDisplay} />
          </div>
        )}
        <ToolUseEntry event={event} />
      </div>
    );
  }

  // Agent working / completed banners
  if (event.type === "agent_working" || event.type === "agent_completed") {
    const isCompleted = event.type === "agent_completed";
    const durationMs = (data?.durationMs as number) ?? undefined;
    return (
      <div
        className={cn(
          "px-4 py-2 flex items-center gap-2 text-xs",
          isCompleted ? "bg-info/5" : "bg-success/5"
        )}
      >
        <span
          className={cn(
            "h-2 w-2 rounded-full shrink-0",
            isCompleted ? "bg-info" : "bg-success animate-pulse"
          )}
        />
        <AgentBadge
          name={event.agent ?? "agent"}
          displayName={agentDisplay}
        />
        <span className={cn("flex-1", isCompleted ? "text-info" : "text-success")}>
          {isCompleted ? "completed" : "started"}
        </span>
        {durationMs != null && (
          <span className="text-[10px] text-text-muted ml-auto font-mono">
            {formatDuration(durationMs)}
          </span>
        )}
      </div>
    );
  }

  // Agent created (standalone, not grouped)
  if (event.type === "agent_created") {
    return (
      <div className="px-4 py-1.5 flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-accent shrink-0" />
        <AgentBadge
          name={event.agent ?? "agent"}
          displayName={agentDisplay}
        />
        <span className="text-[10px] text-text-muted">ready</span>
      </div>
    );
  }

  // Agent message / summary — with collapsible long text + markdown
  if (event.type === "agent_message") {
    const fullText = (event.data as Record<string, unknown> | undefined)?.text as string | undefined;
    return (
      <div className="px-4 py-1.5">
        {showBadge && event.agent && (
          <div className="mb-1">
            <AgentBadge name={event.agent} displayName={agentDisplay} />
          </div>
        )}
        <CollapsibleMessage
          text={fullText ?? event.summary}
          className={isSummary ? "text-text-muted italic" : "text-text-primary"}
          useMarkdown={!isSummary}
        />
      </div>
    );
  }

  // Status update — show full result text with markdown if available
  if (event.type === "status_update") {
    const resultText = (event.data as Record<string, unknown> | undefined)?.text as string | undefined;
    if (resultText || event.summary.length > 100) {
      return (
        <div className="px-4 py-1.5">
          <CollapsibleMessage
            text={resultText ?? event.summary}
            className="text-text-muted"
            useMarkdown
          />
        </div>
      );
    }
    return (
      <div className="px-4 py-1 flex items-center gap-2">
        {event.agent && (
          <AgentBadge
            name={event.agent}
            displayName={agentDisplay}
          />
        )}
        <span className="text-[10px] text-text-muted truncate">{event.summary}</span>
        <span className="text-[10px] text-text-muted ml-auto shrink-0">{formatTime(event.timestamp)}</span>
      </div>
    );
  }

  // Default fallback
  return (
    <div className="px-4 py-1.5">
      {showBadge && event.agent && (
        <div className="mb-1">
          <AgentBadge name={event.agent} displayName={agentDisplay} />
        </div>
      )}
      <p className="text-xs text-text-secondary">{event.summary}</p>
      <span className="text-[10px] text-text-muted">{formatTime(event.timestamp)}</span>
    </div>
  );
}

// ─── Narrative Block Renderer ────────────────────────────────────────────────

function NarrativeBlockEntry({
  block,
  prevAgent,
  displayNameMap,
}: {
  block: NarrativeBlock;
  prevAgent: string | null;
  displayNameMap: Record<string, string>;
}) {
  if (block.kind === "team_assembled") {
    return (
      <TeamAssembledBlock
        events={block.events}
        displayNameMap={displayNameMap}
      />
    );
  }

  if (block.kind === "tool_group") {
    const showBadge = !!block.agent && block.agent !== prevAgent;
    return (
      <ToolGroupBlock
        agent={block.agent}
        events={block.events}
        displayNameMap={displayNameMap}
        showBadge={showBadge}
      />
    );
  }

  const event = block.event;
  const showBadge = !!event.agent && event.agent !== prevAgent;
  return (
    <ActivityEntry
      event={event}
      showBadge={showBadge}
      displayNameMap={displayNameMap}
    />
  );
}

// ─── Activity Log ────────────────────────────────────────────────────────────

export function ActivityLog() {
  const [filter, setFilter] = useState<Filter>("all");
  const events = useMissionStore((s) => s.events);
  const mission = useMissionStore((s) => s.mission);
  const plan = useMissionStore((s) => s.mission?.plan);
  const displayNameMap = useMemo(() => buildDisplayNameMap(plan), [plan]);
  const bottomRef = useRef<HTMLDivElement>(null);

  const filteredEvents = useMemo(() => {
    let filtered = events;
    const types = FILTER_TYPES[filter];
    if (types) {
      filtered = filtered.filter((e) => types.includes(e.type));
    }
    // In "all" mode, hide noisy event types
    if (filter === "all") {
      filtered = filtered.filter((e) => !HIDDEN_IN_ALL.has(e.type));
    }
    return filtered;
  }, [events, filter]);

  // Group into narrative blocks
  const blocks = useMemo(() => groupIntoBlocks(filteredEvents), [filteredEvents]);

  // Determine which agents are "thinking" (working with no event for 3s)
  const thinkingAgents = useMemo(() => {
    if (!mission || mission.status !== "running") return [];
    const working = mission.agents.filter((a) => a.status === "working");
    const now = Date.now();
    return working.filter((a) => {
      const lastEvent = [...events].reverse().find((e) => e.agent === a.name);
      return !lastEvent || now - lastEvent.timestamp > 3000;
    });
  }, [mission, events]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [blocks.length]);

  // Helper to get the last agent in a block (for badge grouping across blocks)
  function blockAgent(b: NarrativeBlock): string | null {
    if (b.kind === "team_assembled") return null;
    if (b.kind === "tool_group") return b.agent ?? null;
    return b.event.agent ?? null;
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-text-primary">Activity</h2>
        <div className="flex gap-1">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-2 py-0.5 rounded text-[10px] font-medium capitalize transition-colors",
                filter === f
                  ? "bg-accent text-white"
                  : "text-text-muted hover:text-text-secondary hover:bg-bg-hover"
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {blocks.length === 0 && thinkingAgents.length === 0 && (
          <p className="text-text-muted text-sm text-center py-8">
            No activity yet
          </p>
        )}

        <div className="divide-y divide-border/30">
          {blocks.map((block, idx) => {
            const prevAgent = idx > 0 ? blockAgent(blocks[idx - 1]!) : null;
            const key =
              block.kind === "event"
                ? block.event.id
                : block.kind === "team_assembled"
                  ? `team-${block.events[0]?.id}`
                  : `tools-${block.events[0]?.id}`;

            return (
              <NarrativeBlockEntry
                key={key}
                block={block}
                prevAgent={prevAgent}
                displayNameMap={displayNameMap}
              />
            );
          })}
        </div>

        {/* Thinking indicators for working agents */}
        {thinkingAgents.map((a) => (
          <ThinkingIndicator
            key={a.name}
            displayName={displayNameMap[a.name] ?? a.name}
          />
        ))}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
