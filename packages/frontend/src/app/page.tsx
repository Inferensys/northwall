"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { io, type Socket } from "socket.io-client";
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  CircleDot,
  GitBranch,
  Github,
  GitPullRequest,
  Loader2,
  Network,
  Play,
  Search,
  ShieldCheck,
  SquareKanban,
  Workflow,
} from "lucide-react";
import type {
  Assessment,
  AssessmentEvent,
  AssessmentPhase,
  GitHubRepository,
  RepositoryConnection,
  VulnerabilityFinding,
} from "@northwall/shared";
import { NorthwallLogo } from "@/components/logo";
import { authFetch } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";
const DEV_BYPASS = process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === "true";

const phases: Array<{ id: AssessmentPhase; label: string }> = [
  { id: "connect_repo", label: "Connect source" },
  { id: "repo_selected", label: "Source selected" },
  { id: "understanding", label: "Context built" },
  { id: "plan_ready", label: "Plan approval" },
  { id: "approved", label: "Approved" },
  { id: "running", label: "Execution" },
  { id: "findings_ready", label: "Findings" },
  { id: "issues_created", label: "Issues" },
];

const severityStyles: Record<VulnerabilityFinding["severity"], string> = {
  low: "border-[#b8d8c7] bg-[#ecf6f0] text-[#0b6b49]",
  medium: "border-[#ead39a] bg-[#fff8e7] text-[#7a520e]",
  high: "border-[#efb3aa] bg-[#fff0ee] text-[#9f271c]",
  critical: "border-[#d28d84] bg-[#ffe8e4] text-[#7d1c14]",
};

function phaseIndex(phase: AssessmentPhase | null): number {
  if (!phase) return 0;
  return Math.max(0, phases.findIndex((item) => item.id === phase));
}

function phaseComplete(current: AssessmentPhase | null, phase: AssessmentPhase): boolean {
  return phaseIndex(current) >= phaseIndex(phase);
}

function Panel({
  title,
  icon: Icon,
  children,
  className,
}: {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-md border border-border bg-bg-surface", className)}>
      <div className="flex h-12 items-center gap-2 border-b border-border px-4">
        {Icon && <Icon className="h-4 w-4 text-text-muted" />}
        <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-[180px] place-items-center px-6 py-8 text-center text-sm leading-6 text-text-muted">
      {children}
    </div>
  );
}

export default function Home() {
  const [connection, setConnection] = useState<RepositoryConnection | null>(null);
  const [repos, setRepos] = useState<GitHubRepository[]>([]);
  const [selectedRepoId, setSelectedRepoId] = useState<number | null>(null);
  const [branch, setBranch] = useState("main");
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [events, setEvents] = useState<AssessmentEvent[]>([]);
  const [selectedFindingIds, setSelectedFindingIds] = useState<Set<string>>(new Set());
  const [previewFindingId, setPreviewFindingId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedRepo = useMemo(
    () => repos.find((repo) => repo.id === selectedRepoId) ?? null,
    [repos, selectedRepoId],
  );

  const previewFinding = useMemo(
    () => assessment?.findings.find((finding) => finding.id === previewFindingId) ?? assessment?.findings[0] ?? null,
    [assessment?.findings, previewFindingId],
  );

  const refreshConnection = useCallback(async () => {
    const res = await authFetch("/api/github/connection");
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Could not read GitHub connection");
    setConnection(data.connection);
    return data.connection as RepositoryConnection;
  }, []);

  const loadRepos = useCallback(async () => {
    const res = await authFetch("/api/github/repos");
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Could not list GitHub repos");
    const nextRepos = (data.repos ?? []) as GitHubRepository[];
    setRepos(nextRepos);
    if (!selectedRepoId && nextRepos[0]) {
      setSelectedRepoId(nextRepos[0].id);
      setBranch(nextRepos[0].defaultBranch);
    }
  }, [selectedRepoId]);

  useEffect(() => {
    refreshConnection()
      .then((next) => {
        if (next.connected) return loadRepos();
        return null;
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, [loadRepos, refreshConnection]);

  useEffect(() => {
    if (!selectedRepo) return;
    setBranch(selectedRepo.defaultBranch);
  }, [selectedRepo]);

  useEffect(() => {
    if (!assessment?.id) return;

    let socket: Socket | null = null;
    let cancelled = false;
    const assessmentId = assessment.id;

    async function connect() {
      let token: string | undefined;
      if (!DEV_BYPASS) {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        token = session?.access_token;
      }
      if (cancelled) return;

      socket = io(BACKEND_URL, {
        transports: ["websocket"],
        auth: DEV_BYPASS ? { devBypass: true } : { token },
      });
      socket.on("connect", () => socket?.emit("join_assessment", assessmentId));
      socket.on("assessment_state", (next: Assessment) => {
        setAssessment(next);
        setEvents(next.events ?? []);
      });
      socket.on("assessment_events_batch", (batch: AssessmentEvent[]) => setEvents(batch));
      socket.on("assessment_event", (event: AssessmentEvent) => {
        setEvents((current) => [...current, event].slice(-80));
      });
      socket.on("error", (payload: { message?: string } | string) => {
        setError(typeof payload === "string" ? payload : payload.message ?? "Socket error");
      });
    }

    connect();
    return () => {
      cancelled = true;
      socket?.emit("leave_assessment", assessmentId);
      socket?.disconnect();
    };
  }, [assessment?.id]);

  async function connectGitHub() {
    setBusy("connect");
    setError(null);
    try {
      if (DEV_BYPASS) {
        const next = await refreshConnection();
        if (!next.connected) throw new Error("GitHub is not connected for this session.");
      } else {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        const providerToken = session?.provider_token;
        if (!providerToken) throw new Error("GitHub OAuth token missing. Sign out and continue with GitHub again.");
        const res = await authFetch("/api/github/connect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: providerToken }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Could not connect GitHub");
        setConnection(data.connection);
      }
      await loadRepos();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  async function createAssessment() {
    if (!selectedRepo) return;
    setBusy("create");
    setError(null);
    try {
      const res = await authFetch("/api/assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repository: selectedRepo, branch }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not start review");
      setAssessment(data.assessment);
      setEvents(data.assessment.events ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  async function runStep(step: "understand" | "plan" | "approve" | "run") {
    if (!assessment) return;
    setBusy(step);
    setError(null);
    try {
      const res = await authFetch(`/api/assessments/${assessment.id}/${step}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Could not ${step}`);
      setAssessment(data.assessment);
      setEvents(data.assessment.events ?? []);
      if (step === "run") {
        const findings = (data.assessment.findings ?? []) as VulnerabilityFinding[];
        setSelectedFindingIds(new Set(findings.map((finding) => finding.id)));
        setPreviewFindingId(findings[0]?.id ?? null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  async function createIssues() {
    if (!assessment || selectedFindingIds.size === 0) return;
    setBusy("issues");
    setError(null);
    try {
      const res = await authFetch(`/api/assessments/${assessment.id}/issues`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ findingIds: Array.from(selectedFindingIds) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not create issues");
      setAssessment(data.assessment);
      setEvents(data.assessment.events ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  const currentPhase = assessment?.phase ?? (connection?.connected ? "repo_selected" : "connect_repo");

  return (
    <div className="min-h-screen bg-bg text-text-primary">
      <header className="flex h-14 items-center justify-between border-b border-border bg-white px-5">
        <div className="flex items-center gap-3">
          <NorthwallLogo className="text-xl" />
          <div className="hidden h-6 w-px bg-border sm:block" />
          <div className="hidden text-xs text-text-muted sm:block">
            Agentic SOC workspace
          </div>
        </div>
        <div className="hidden w-full max-w-lg items-center gap-2 rounded-md border border-border bg-bg-elevated px-3 py-1.5 text-sm text-text-muted md:flex">
          <Search className="h-4 w-4" />
          Search alerts, entities, code paths, findings
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className={cn("rounded-md border px-2.5 py-1 font-medium", connection?.connected ? "border-[#b8d8c7] bg-[#ecf6f0] text-[#0b6b49]" : "border-border bg-bg-elevated text-text-secondary")}>
            {connection?.connected ? `GitHub: ${connection.account}` : "Source not connected"}
          </span>
        </div>
      </header>

      <div className="grid min-h-[calc(100vh-56px)] lg:grid-cols-[52px_320px_1fr]">
        <nav className="hidden border-r border-[#102a22] bg-[#051914] py-3 lg:flex lg:flex-col lg:items-center lg:gap-2">
          {[
            { label: "Sources", icon: Github },
            { label: "Investigation graph", icon: Network },
            { label: "Plan", icon: ShieldCheck },
            { label: "Run log", icon: SquareKanban },
            { label: "Work items", icon: GitPullRequest },
          ].map(({ label, icon: Icon }, index) => (
            <button
              key={label}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-md text-white/55 transition-colors hover:bg-white/10 hover:text-white",
                index === 0 && "bg-white/10 text-white",
              )}
              title={label}
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
        </nav>
        <aside className="border-r border-border bg-white">
          <div className="border-b border-border p-4">
            <button
              onClick={connectGitHub}
              disabled={busy === "connect"}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-accent px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {busy === "connect" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Github className="h-4 w-4" />}
              {connection?.connected ? "Refresh GitHub source" : "Connect GitHub source"}
            </button>
            {connection?.connected && (
              <button
                onClick={loadRepos}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium text-text-secondary"
              >
                Sync repositories
              </button>
            )}
          </div>

          <div className="border-b border-border p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-text-muted">Signal source</h2>
              <span className="text-xs text-text-muted">{repos.length} repos</span>
            </div>
            <div className="max-h-64 space-y-1 overflow-auto">
              {repos.length === 0 ? (
                <p className="rounded-md bg-bg-elevated p-3 text-sm leading-5 text-text-muted">
                  Connect GitHub to load source context.
                </p>
              ) : repos.map((repo) => (
                <button
                  key={repo.id}
                  onClick={() => setSelectedRepoId(repo.id)}
                  className={cn(
                    "w-full rounded-md px-3 py-2 text-left text-sm",
                    selectedRepoId === repo.id ? "bg-[#eef4ef] text-[#051914]" : "text-text-secondary hover:bg-bg-elevated",
                  )}
                >
                  <span className="block font-medium">{repo.fullName}</span>
                  <span className="text-xs text-text-muted">{repo.private ? "private" : "public"} · {repo.defaultBranch}</span>
                </button>
              ))}
            </div>

            {selectedRepo && (
              <div className="mt-4 space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-text-muted">Branch</label>
                <div className="flex items-center gap-2 rounded-md border border-border bg-white px-3 py-2">
                  <GitBranch className="h-4 w-4 text-text-muted" />
                  <input
                    value={branch}
                    onChange={(event) => setBranch(event.target.value)}
                    className="w-full bg-transparent text-sm outline-none"
                  />
                </div>
                <button
                  onClick={createAssessment}
                  disabled={busy === "create"}
                  className="flex w-full items-center justify-center gap-2 rounded-md bg-accent px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {busy === "create" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                  Start SOC run
                </button>
              </div>
            )}
          </div>

          <div className="p-4">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-muted">Setup checklist</h2>
            <div className="space-y-2">
              {phases.map((phase) => {
                const complete = phaseComplete(currentPhase, phase.id);
                const active = currentPhase === phase.id;
                return (
                  <div key={phase.id} className={cn("flex items-center gap-3 rounded-md px-3 py-2 text-sm", active ? "bg-[#eef4ef] text-[#051914]" : "text-text-secondary")}>
                    {complete ? <CheckCircle2 className="h-4 w-4 text-success" /> : <CircleDot className="h-4 w-4 text-text-muted/45" />}
                    {phase.label}
                  </div>
                );
              })}
            </div>
          </div>
        </aside>

        <main className="min-w-0 p-5">
          {error && (
            <div className="mb-4 flex items-start gap-2 rounded-md border border-[#ead39a] bg-[#fff8e7] px-4 py-3 text-sm text-[#7a520e]">
              <AlertCircle className="mt-0.5 h-4 w-4" />
              <span>{error}</span>
            </div>
          )}

          <div className="mb-5 flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm text-text-muted">
                <Github className="h-4 w-4" />
                {assessment?.repository.fullName ?? selectedRepo?.fullName ?? "No source selected"}
              </div>
              <h1 className="text-2xl font-semibold tracking-normal text-text-primary">
                Agentic SOC run
              </h1>
              <p className="mt-1 text-sm text-text-secondary">
                Build context, assign agents, approve the response plan, then send the work to owners.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <ActionButton label="Build context" busy={busy === "understand"} disabled={!assessment || assessment.phase !== "repo_selected"} onClick={() => runStep("understand")} />
              <ActionButton label="Draft plan" busy={busy === "plan"} disabled={!assessment || assessment.phase !== "understanding"} onClick={() => runStep("plan")} />
              <ActionButton label="Approve" busy={busy === "approve"} disabled={!assessment || assessment.phase !== "plan_ready"} onClick={() => runStep("approve")} />
              <ActionButton label="Run" icon={Play} busy={busy === "run"} disabled={!assessment || assessment.phase !== "approved"} onClick={() => runStep("run")} />
              <ActionButton label="Create work items" icon={GitPullRequest} busy={busy === "issues"} disabled={!assessment || selectedFindingIds.size === 0 || !["findings_ready", "issues_created"].includes(assessment.phase)} onClick={createIssues} />
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <Panel title="Investigation graph" icon={Network}>
              <KnowledgeGraphView assessment={assessment} />
            </Panel>
            <Panel title="Agent task map" icon={Workflow}>
              <TaskMap assessment={assessment} />
            </Panel>
            <Panel title="Response plan" icon={ShieldCheck}>
              <PlanReview assessment={assessment} />
            </Panel>
            <Panel title="Live SOC run" icon={SquareKanban}>
              <EventStream events={events} />
            </Panel>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_420px]">
            <Panel title="Findings and work items" icon={GitPullRequest}>
              <FindingsTable
                findings={assessment?.findings ?? []}
                selected={selectedFindingIds}
                setSelected={setSelectedFindingIds}
                previewFindingId={previewFinding?.id ?? null}
                onPreview={setPreviewFindingId}
              />
            </Panel>
            <Panel title="Owner handoff preview" icon={GitPullRequest}>
              <IssuePreview finding={previewFinding} />
            </Panel>
          </div>
        </main>
      </div>
    </div>
  );
}

function ActionButton({
  label,
  icon: Icon = Check,
  busy,
  disabled,
  onClick,
}: {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  busy: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || busy}
      className="inline-flex items-center gap-2 rounded-md border border-border bg-white px-3 py-2 text-sm font-semibold text-text-secondary shadow-sm disabled:cursor-not-allowed disabled:opacity-45 enabled:hover:bg-bg-elevated enabled:hover:text-text-primary"
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
      {label}
    </button>
  );
}

function KnowledgeGraphView({ assessment }: { assessment: Assessment | null }) {
  const graph = assessment?.graph;
  if (!graph) {
    return <EmptyState>Select a source and build context to map alerts, code paths, identities, services, and owners.</EmptyState>;
  }

  return (
    <div className="p-4">
      <p className="mb-4 text-sm leading-6 text-text-secondary">{graph.summary}</p>
      <div className="grid gap-3 md:grid-cols-2">
        {graph.nodes.map((node) => (
          <div key={node.id} className="rounded-md border border-border bg-bg-elevated p-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">{node.kind}</span>
              <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-semibold", severityStyles[node.risk === "low" ? "low" : node.risk])}>
                {node.risk}
              </span>
            </div>
            <h3 className="mt-2 text-sm font-semibold text-text-primary">{node.label}</h3>
            {node.evidence[0] && <p className="mt-1 truncate text-xs text-text-muted">{node.evidence[0]}</p>}
          </div>
        ))}
      </div>
      {graph.edges.length > 0 && (
        <div className="mt-4 rounded-md border border-border">
          {graph.edges.map((edge) => (
            <div key={edge.id} className="flex items-center gap-2 border-b border-border px-3 py-2 text-xs font-mono text-text-secondary last:border-0">
              <span>{edge.source}</span>
              <ArrowRight className="h-3 w-3" />
              <span>{edge.target}</span>
              <span className="text-text-muted">({edge.label})</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TaskMap({ assessment }: { assessment: Assessment | null }) {
  const plan = assessment?.plan;
  if (!plan) return <EmptyState>Draft a plan to see the agents, owners, and task order before the SOC run starts.</EmptyState>;

  return (
    <div className="p-4">
      <div className="space-y-3">
        {plan.agents.map((agent) => (
          <div key={agent.id} className="rounded-md border border-border p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-text-primary">{agent.name}</h3>
                <p className="text-xs text-text-muted">{agent.title}</p>
              </div>
              <span className="rounded-md bg-bg-elevated px-2 py-1 text-xs font-medium text-text-secondary">{agent.status}</span>
            </div>
            <p className="mt-2 text-sm leading-5 text-text-secondary">{agent.focus}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 space-y-2">
        {plan.tasks.map((task) => (
          <div key={task.id} className="rounded-md bg-bg-elevated px-3 py-2 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="font-medium text-text-primary">{task.title}</span>
              <span className="text-xs text-text-muted">{task.status}</span>
            </div>
            <p className="mt-1 text-xs text-text-muted">
              {task.agentId}{task.dependsOn.length > 0 ? ` · after ${task.dependsOn.join(", ")}` : ""}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function PlanReview({ assessment }: { assessment: Assessment | null }) {
  if (!assessment?.plan) return <EmptyState>The response plan appears here after Northwall builds the source context.</EmptyState>;

  return (
    <div className="p-4">
      <p className="text-sm leading-6 text-text-secondary">{assessment.plan.summary}</p>
      <div className="mt-4 rounded-md border border-border">
        {assessment.plan.approvalNotes.map((note) => (
          <div key={note} className="flex items-start gap-2 border-b border-border px-3 py-2 text-sm text-text-secondary last:border-0">
            <ShieldCheck className="mt-0.5 h-4 w-4 text-success" />
            {note}
          </div>
        ))}
      </div>
    </div>
  );
}

function EventStream({ events }: { events: AssessmentEvent[] }) {
  if (events.length === 0) return <EmptyState>Run events appear here as agents triage signals, inspect context, and write findings.</EmptyState>;

  return (
    <div className="max-h-[360px] overflow-auto p-4">
      <div className="space-y-2">
        {events.slice().reverse().map((event) => (
          <div key={event.id} className="rounded-md border border-border bg-bg-elevated px-3 py-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">{event.type.replaceAll("_", " ")}</span>
              <span className="text-xs text-text-muted">{new Date(event.timestamp).toLocaleTimeString()}</span>
            </div>
            <p className="mt-1 text-sm text-text-secondary">{event.summary}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function FindingsTable({
  findings,
  selected,
  setSelected,
  previewFindingId,
  onPreview,
}: {
  findings: VulnerabilityFinding[];
  selected: Set<string>;
  setSelected: (next: Set<string>) => void;
  previewFindingId: string | null;
  onPreview: (id: string) => void;
}) {
  if (findings.length === 0) {
    return <EmptyState>Run the approved plan to get findings and owner-ready work item drafts.</EmptyState>;
  }

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1020px] text-left text-sm">
        <thead className="border-b border-border bg-bg-elevated text-xs font-semibold uppercase tracking-wide text-text-muted">
          <tr>
            <th className="w-10 px-4 py-3" />
            <th className="px-4 py-3">Finding</th>
            <th className="px-4 py-3">Severity</th>
            <th className="px-4 py-3">Confidence</th>
            <th className="px-4 py-3">Evidence</th>
            <th className="px-4 py-3">Work item</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {findings.map((finding) => (
            <tr
              key={finding.id}
              className={cn(
                "border-b border-border last:border-0",
                previewFindingId === finding.id ? "bg-[#eef4ef]" : "bg-white",
              )}
            >
              <td className="px-4 py-4">
                <input
                  type="checkbox"
                  checked={selected.has(finding.id)}
                  onChange={() => toggle(finding.id)}
                />
              </td>
              <td className="px-4 py-4">
                <div className="font-semibold text-text-primary">{finding.title}</div>
                <div className="mt-1 max-w-xl text-sm leading-5 text-text-secondary">{finding.impact}</div>
              </td>
              <td className="px-4 py-4">
                <span className={cn("rounded-full border px-2 py-1 text-xs font-semibold capitalize", severityStyles[finding.severity])}>
                  {finding.severity}
                </span>
              </td>
              <td className="px-4 py-4 capitalize text-text-secondary">{finding.confidence}</td>
              <td className="px-4 py-4 font-mono text-xs text-text-secondary">
                {finding.evidence.slice(0, 2).map((item) => (
                  <div key={`${finding.id}-${item.path}-${item.line ?? ""}`}>{item.path}{item.line ? `:${item.line}` : ""}</div>
                ))}
              </td>
              <td className="px-4 py-4">
                {finding.issueUrl ? (
                  <a className="font-medium text-[#315e80] hover:underline" href={finding.issueUrl} target="_blank" rel="noreferrer">
                    #{finding.issueNumber}
                  </a>
                ) : (
                  <span className="text-text-muted">Ready</span>
                )}
              </td>
              <td className="px-4 py-4 text-right">
                <button
                  onClick={() => onPreview(finding.id)}
                  className="rounded-md border border-border px-2.5 py-1.5 text-xs font-semibold text-text-secondary hover:bg-bg-elevated hover:text-text-primary"
                >
                  Preview
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function IssuePreview({ finding }: { finding: VulnerabilityFinding | null }) {
  if (!finding) {
    return <EmptyState>Select a finding to read the owner handoff before Northwall creates it.</EmptyState>;
  }

  return (
    <div className="p-4">
      <div className="mb-4 flex flex-wrap gap-2">
        {["northwall", "security", finding.severity, finding.confidence, ...finding.labels].filter(Boolean).map((label) => (
          <span key={label} className="rounded-md border border-border bg-bg-elevated px-2 py-1 text-xs font-medium text-text-secondary">
            {label}
          </span>
        ))}
      </div>
      <h3 className="text-base font-semibold leading-6 text-text-primary">{finding.issueTitle}</h3>
      <div className="mt-4 rounded-md border border-[#102a22] bg-[#051914] p-4 font-mono text-xs leading-6 text-white/90">
        <pre className="whitespace-pre-wrap">{finding.issueBody}</pre>
      </div>
    </div>
  );
}
