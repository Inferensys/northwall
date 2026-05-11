"use client";

import { useState, useEffect } from "react";
import { Playfair_Display } from "next/font/google";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { NorthwallMark } from "./logo";
import type { Mission } from "@northwall/shared";
import type { User } from "@supabase/supabase-js";

const logoFont = Playfair_Display({
  weight: "700",
  subsets: ["latin"],
  style: "italic",
  display: "swap",
});

const STATUS_COLOR: Record<string, string> = {
  exploring: "bg-accent",
  planning: "bg-warning",
  review: "bg-warning",
  launching: "bg-info",
  running: "bg-success",
  paused: "bg-text-muted",
  completed: "bg-info",
  failed: "bg-error",
};
const PORTFOLIO_MODE = process.env.NEXT_PUBLIC_PORTFOLIO_MODE === "true";

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function groupMissions(missions: Mission[]) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterday = today - 86_400_000;
  const week = today - 7 * 86_400_000;

  const groups: { label: string; missions: Mission[] }[] = [
    { label: "Today", missions: [] },
    { label: "Yesterday", missions: [] },
    { label: "Previous 7 days", missions: [] },
    { label: "Older", missions: [] },
  ];

  for (const m of missions) {
    if (m.createdAt >= today) groups[0]!.missions.push(m);
    else if (m.createdAt >= yesterday) groups[1]!.missions.push(m);
    else if (m.createdAt >= week) groups[2]!.missions.push(m);
    else groups[3]!.missions.push(m);
  }

  return groups.filter((g) => g.missions.length > 0);
}

function SidebarIcon({ className }: { className?: string }) {
  return (
    <svg className={cn("w-[18px] h-[18px]", className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 3v18" />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={cn("w-[18px] h-[18px]", className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14" /><path d="M5 12h14" />
    </svg>
  );
}

function LogOutIcon({ className }: { className?: string }) {
  return (
    <svg className={cn("w-4 h-4", className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

interface SidebarProps {
  missions: Mission[];
  activeMissionId: string | null;
  collapsed: boolean;
  user: User | null;
  onToggle: () => void;
  onNewMission: () => void;
  onSelectMission: (mission: Mission) => void;
}

export function Sidebar({
  missions,
  activeMissionId,
  collapsed,
  user,
  onToggle,
  onNewMission,
  onSelectMission,
}: SidebarProps) {
  const router = useRouter();
  const groups = groupMissions(missions);

  // Force re-render every 30s to update relative timestamps
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(timer);
  }, []);

  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined;
  const displayName = PORTFOLIO_MODE
    ? "Northwall"
    : (user?.user_metadata?.full_name as string | undefined) ?? user?.email ?? "";

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <aside
      className="flex h-screen shrink-0 border-r border-white/[0.06] transition-[width] duration-250 ease-[cubic-bezier(0.25,0.1,0.25,1)]"
      style={{
        backgroundColor: "#0e0e16",
        width: collapsed ? 52 : 260,
      }}
    >
      {/* ── Collapsed rail — always rendered, visible when collapsed ── */}
      <div
        className={cn(
          "flex flex-col items-center w-[52px] shrink-0 py-3 gap-2 transition-opacity duration-200",
          collapsed ? "opacity-100" : "opacity-0 pointer-events-none absolute"
        )}
      >
        <button
          onClick={onToggle}
          className="flex items-center justify-center w-9 h-9 rounded-lg text-text-secondary hover:text-text-primary hover:bg-white/[0.08] transition-colors"
          title="Open sidebar"
        >
          <SidebarIcon />
        </button>
        <button
          onClick={onNewMission}
          className="flex items-center justify-center w-9 h-9 rounded-lg text-text-secondary hover:text-text-primary hover:bg-white/[0.08] transition-colors"
          title="New Mission"
        >
          <PlusIcon />
        </button>
        {/* Collapsed avatar */}
        {user && (
          <div className="mt-auto pb-1">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt=""
                className="w-8 h-8 rounded-full border border-white/10"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-xs font-medium text-accent">
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Expanded panel — always rendered, fades in/out ── */}
      <div
        className={cn(
          "flex flex-col w-[260px] h-full transition-opacity duration-200",
          collapsed ? "opacity-0 pointer-events-none" : "opacity-100"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 shrink-0">
          <div className="flex items-center gap-2.5">
            <NorthwallMark size={20} className="text-accent" />
            <span className={cn(logoFont.className, "text-[17px] text-text-primary tracking-tight select-none")}>
              Northwall
            </span>
          </div>
          <button
            onClick={onToggle}
            className="p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-white/[0.06] transition-colors"
            title="Close sidebar"
          >
            <SidebarIcon />
          </button>
        </div>

        {/* New Mission */}
        <div className="px-3 pb-3 shrink-0">
          <button
            onClick={onNewMission}
            className="w-full flex items-center gap-2.5 rounded-lg border border-white/[0.08] px-3.5 py-2.5 text-[13px] text-text-secondary hover:bg-white/[0.06] hover:text-text-primary transition-colors"
          >
            <PlusIcon />
            New Mission
          </button>
        </div>

        {/* Divider */}
        <div className="mx-4 h-px bg-white/[0.06]" />

        {/* Mission list */}
        <div className="flex-1 overflow-y-auto px-2 pt-3 pb-4">
          {groups.map((group) => (
            <div key={group.label} className="mb-3.5">
              <p className="px-2.5 pb-1.5 text-[10px] font-semibold text-text-muted/50 uppercase tracking-widest">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.missions.map((m) => {
                  const isActive = m.id === activeMissionId;
                  return (
                    <button
                      key={m.id}
                      onClick={() => onSelectMission(m)}
                      className={cn(
                        "w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors group",
                        isActive
                          ? "bg-white/[0.08] text-text-primary"
                          : "text-text-secondary hover:bg-white/[0.05] hover:text-text-primary"
                      )}
                    >
                      <span
                        className={cn(
                          "h-[7px] w-[7px] rounded-full shrink-0",
                          STATUS_COLOR[m.status] ?? "bg-text-muted"
                        )}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] truncate leading-tight">
                          {m.plan?.title ?? (m.status === "exploring" || m.status === "planning" ? "New mission" : m.id.slice(0, 12))}
                        </p>
                        <p className="text-[10px] text-text-muted/60 mt-0.5">
                          {m.status} &middot; {formatRelativeTime(m.completedAt ?? m.startedAt ?? m.createdAt)}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {missions.length === 0 && (
            <div className="px-2 py-8 text-center">
              <p className="text-xs text-text-muted/40">No missions yet</p>
            </div>
          )}
        </div>

        {/* User section */}
        {user && (
          <>
            <div className="mx-4 h-px bg-white/[0.06]" />
            <div className="px-3 py-3 shrink-0 flex items-center gap-2.5">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt=""
                  className="w-8 h-8 rounded-full border border-white/10 shrink-0"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-xs font-medium text-accent shrink-0">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-[13px] text-text-primary truncate leading-tight">
                  {displayName}
                </p>
              </div>
              {!PORTFOLIO_MODE && (
                <button
                  onClick={handleSignOut}
                  className="p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-white/[0.06] transition-colors shrink-0"
                  title="Sign out"
                >
                  <LogOutIcon />
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
