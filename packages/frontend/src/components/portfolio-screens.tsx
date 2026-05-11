"use client";

import Link from "next/link";
import {
  Activity,
  BellRing,
  CheckCircle2,
  CreditCard,
  Database,
  FileClock,
  Fingerprint,
  GitBranch,
  KeyRound,
  Lock,
  PlugZap,
  ReceiptText,
  ShieldCheck,
  TriangleAlert,
  Users,
  WalletCards,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { NorthwallMark } from "@/components/logo";
import { cn } from "@/lib/utils";
import { evidenceTimeline, findings, systemGraph } from "@/lib/northwall-demo";

const nav = [
  { href: "/", label: "Assessment" },
  { href: "/admin", label: "Admin" },
  { href: "/team", label: "Team" },
  { href: "/integrations", label: "Integrations" },
  { href: "/billing", label: "Billing" },
  { href: "/audit", label: "Audit" },
  { href: "/settings", label: "Settings" },
];

export function PortfolioShell({
  active,
  children,
}: {
  active: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-bg bg-grid text-text-primary">
      <aside className="fixed inset-y-0 left-0 w-[260px] border-r border-white/10 bg-[#17262c]">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/8 text-teal-300">
            <NorthwallMark size={22} />
          </div>
          <span className="font-display text-lg font-semibold tracking-tight text-white">Northwall</span>
        </div>
        <nav className="px-3">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "block rounded-lg px-3 py-2.5 text-sm transition-colors",
                active === item.label
                  ? "border border-white/10 bg-teal-500/15 text-white"
                  : "text-slate-400 hover:bg-white/[0.05] hover:text-white",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 border-t border-accent/10 p-4">
          <div className="rounded-lg border border-accent/15 bg-bg-surface p-3">
            <p className="text-xs font-medium text-text-primary">Security workspace</p>
            <p className="mt-1 text-[11px] text-text-muted">SSO, audit logs, scope gates, and approval rules enabled</p>
          </div>
        </div>
      </aside>
      <main className="ml-[260px] min-h-screen">{children}</main>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: string;
}) {
  return (
    <header className="border-b border-accent/10 bg-bg/80 px-8 py-5 backdrop-blur">
      <div className="flex items-center justify-between gap-6">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-text-primary">{title}</h1>
          <p className="mt-1 text-sm text-text-muted">{description}</p>
        </div>
        {action && (
          <button className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm">
            {action}
          </button>
        )}
      </div>
    </header>
  );
}

export function StatCard({
  label,
  value,
  trend,
  icon: Icon,
}: {
  label: string;
  value: string;
  trend: string;
  icon: LucideIcon;
}) {
  return (
    <div className="rounded-lg border border-border bg-bg-surface p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-text-muted">{label}</p>
        <Icon className="h-4 w-4 text-accent" />
      </div>
      <p className="mt-4 font-display text-3xl font-semibold text-text-primary">{value}</p>
      <p className="mt-1 text-xs text-accent">{trend}</p>
    </div>
  );
}

export function AdminScreen() {
  const rows = [
    ["AcmePay AppSec assessment", "Running", "7 agents", "4 findings", "2m ago"],
    ["Customer Portal tenant review", "Review", "5 agents", "3 findings", "18m ago"],
    ["Payments webhook check", "Remediating", "4 agents", "2 findings", "41m ago"],
    ["CI dependency sweep", "Verified", "3 agents", "1 finding", "2h ago"],
  ];

  return (
    <PortfolioShell active="Admin">
      <PageHeader
        title="Admin Console"
        description="Workspace-level view of assessments, agents, risk, policy gates, and remediation health."
        action="Invite Analyst"
      />
      <div className="space-y-6 p-8">
        <div className="grid grid-cols-4 gap-4">
          <StatCard label="Active assessments" value="12" trend="+4 this week" icon={Activity} />
          <StatCard label="Findings open" value="38" trend="11 high confidence" icon={TriangleAlert} />
          <StatCard label="Graph nodes" value="1,284" trend="Across 9 apps" icon={GitBranch} />
          <StatCard label="Verified fixes" value="76%" trend="+18% this month" icon={CheckCircle2} />
        </div>

        <div className="grid grid-cols-12 gap-4">
          <section className="col-span-8 rounded-lg border border-border bg-bg-surface">
            <div className="border-b border-border px-5 py-4">
              <h2 className="font-display text-base font-semibold">Assessment Operations</h2>
            </div>
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.16em] text-text-muted">
                <tr className="border-b border-border">
                  {["Assessment", "Status", "Team", "Risk", "Updated"].map((head) => (
                    <th key={head} className="px-5 py-3 font-medium">{head}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row[0]} className="border-b border-border/60 last:border-0">
                    {row.map((cell, index) => (
                      <td key={cell} className={cn("px-5 py-3", index === 1 ? "text-accent" : "text-text-secondary")}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <section className="col-span-4 rounded-lg border border-border bg-bg-surface p-5">
            <h2 className="font-display text-base font-semibold">Policy Guardrails</h2>
            <div className="mt-4 space-y-3">
              {["Owned scope required", "Rate limits enforced", "Destructive checks disabled", "Owner approval before execution"].map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-lg bg-bg-elevated px-3 py-2">
                  <ShieldCheck className="h-4 w-4 text-accent" />
                  <span className="text-sm text-text-secondary">{item}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </PortfolioShell>
  );
}

export function BillingScreen() {
  const invoices = [
    ["INV-2026-05", "May assessments", "$1,820.00", "Paid"],
    ["INV-2026-04", "April assessments", "$1,395.50", "Paid"],
    ["INV-2026-03", "March assessments", "$1,104.80", "Paid"],
  ];

  return (
    <PortfolioShell active="Billing">
      <PageHeader title="Billing & Usage" description="Assessment minutes, agent runs, evidence retention, invoices, and budget controls." action="Update Plan" />
      <div className="grid grid-cols-12 gap-4 p-8">
        <section className="col-span-5 rounded-lg border border-border bg-bg-surface p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-text-muted">Current plan</p>
              <h2 className="mt-2 font-display text-3xl font-semibold">Security Ops</h2>
              <p className="mt-1 text-sm text-text-muted">For teams running AppSec agent assessments every week.</p>
            </div>
            <WalletCards className="h-5 w-5 text-accent" />
          </div>
          <div className="mt-8 rounded-lg bg-bg-elevated p-4">
            <span className="font-display text-4xl font-semibold">$899</span>
            <span className="text-text-muted"> / month</span>
          </div>
        </section>
        <section className="col-span-7 rounded-lg border border-border bg-bg-surface p-5">
          <h2 className="font-display text-base font-semibold">Invoices</h2>
          <div className="mt-4 space-y-2">
            {invoices.map((invoice) => (
              <div key={invoice[0]} className="grid grid-cols-4 items-center rounded-lg bg-bg-elevated px-4 py-3 text-sm">
                <span className="font-mono text-text-secondary">{invoice[0]}</span>
                <span>{invoice[1]}</span>
                <span>{invoice[2]}</span>
                <span className="text-accent">{invoice[3]}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="col-span-12 grid grid-cols-3 gap-4">
          <StatCard label="Agent minutes" value="1,940" trend="62% of budget" icon={Activity} />
          <StatCard label="Evidence retention" value="365d" trend="Encrypted archive" icon={FileClock} />
          <StatCard label="Payment method" value="4242" trend="Visa on file" icon={CreditCard} />
        </section>
      </div>
    </PortfolioShell>
  );
}

export function TeamScreen() {
  const members = [
    ["Priya Shah", "Security Lead", "Approver", "Active"],
    ["Mateo Ruiz", "Backend Owner", "Remediation", "Active"],
    ["Sarah Chen", "Platform", "Scope Admin", "Active"],
    ["Jordan Lee", "Compliance", "Read-only", "Invited"],
  ];

  return (
    <PortfolioShell active="Team">
      <PageHeader title="Team & Access" description="Assign owners, reviewers, and scope approvers for each assessment." action="Add Member" />
      <div className="grid grid-cols-12 gap-4 p-8">
        <section className="col-span-8 rounded-lg border border-border bg-bg-surface">
          <div className="border-b border-border px-5 py-4">
            <h2 className="font-display text-base font-semibold">Members</h2>
          </div>
          <table className="w-full text-left text-sm">
            <tbody>
              {members.map((member) => (
                <tr key={member[0]} className="border-b border-border/60 last:border-0">
                  {member.map((cell, index) => (
                    <td key={cell} className={cn("px-5 py-3", index === 0 ? "text-text-primary" : "text-text-secondary")}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="col-span-4 rounded-lg border border-border bg-bg-surface p-5">
          <h2 className="font-display text-base font-semibold">Approval Rules</h2>
          <div className="mt-4 space-y-3">
            {["High severity findings require security lead review", "External URL scopes require admin approval", "Fix verification must include test evidence"].map((item) => (
              <p key={item} className="rounded-lg bg-bg-elevated p-3 text-sm text-text-secondary">{item}</p>
            ))}
          </div>
        </section>
      </div>
    </PortfolioShell>
  );
}

export function IntegrationsScreen() {
  const integrations: Array<[string, string, LucideIcon]> = [
    ["GitHub", "Repo import, code search, pull request handoff", GitBranch],
    ["Snyk", "Dependency advisory enrichment", ShieldCheck],
    ["Semgrep", "Static rule packs and custom checks", Fingerprint],
    ["Jira", "Remediation tickets and owner sync", PlugZap],
    ["Postgres", "Schema graph and migration review", Database],
    ["Stripe", "Webhook and billing flow context", ReceiptText],
  ];

  return (
    <PortfolioShell active="Integrations">
      <PageHeader title="Integrations" description="Connect source, scanners, ticketing, evidence stores, and ownership systems." action="Connect Source" />
      <div className="grid grid-cols-3 gap-4 p-8">
        {integrations.map(([name, description, Icon]) => {
          const IntegrationIcon = Icon as LucideIcon;
          return (
            <section key={name as string} className="rounded-lg border border-border bg-bg-surface p-5">
              <IntegrationIcon className="h-5 w-5 text-accent" />
              <h2 className="mt-4 font-display text-lg font-semibold">{name}</h2>
              <p className="mt-2 text-sm leading-6 text-text-secondary">{description}</p>
              <button className="mt-5 rounded-lg border border-accent/20 px-3 py-2 text-sm text-accent">Configure</button>
            </section>
          );
        })}
      </div>
    </PortfolioShell>
  );
}

export function AuditScreen() {
  return (
    <PortfolioShell active="Audit">
      <PageHeader title="Audit Trail" description="Every scope decision, agent action, evidence attachment, and remediation state change." action="Export Evidence" />
      <div className="grid grid-cols-12 gap-4 p-8">
        <section className="col-span-8 rounded-lg border border-border bg-bg-surface p-5">
          <h2 className="font-display text-base font-semibold">Event Stream</h2>
          <div className="mt-4 space-y-3">
            {evidenceTimeline.map((event) => (
              <div key={`${event[0]}-${event[1]}`} className="grid grid-cols-[70px_150px_1fr] rounded-lg bg-bg-elevated px-4 py-3 text-sm">
                <span className="font-mono text-text-muted">{event[0]}</span>
                <span className="text-accent">{event[1]}</span>
                <span className="text-text-secondary">{event[2]}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="col-span-4 rounded-lg border border-border bg-bg-surface p-5">
          <h2 className="font-display text-base font-semibold">Compliance Posture</h2>
          <div className="mt-4 space-y-3">
            {["ASVS mapped findings", "CWE attached where relevant", "KEV enrichment enabled", "Reviewer approval retained"].map((item) => (
              <div key={item} className="flex items-center gap-3 rounded-lg bg-bg-elevated px-3 py-2">
                <CheckCircle2 className="h-4 w-4 text-accent" />
                <span className="text-sm text-text-secondary">{item}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </PortfolioShell>
  );
}

export function SettingsScreen() {
  return (
    <PortfolioShell active="Settings">
      <PageHeader title="Settings" description="Authentication, scope policy, runtime defaults, and evidence retention." action="Save Changes" />
      <div className="grid grid-cols-12 gap-4 p-8">
        <section className="col-span-6 rounded-lg border border-border bg-bg-surface p-5">
          <h2 className="font-display text-base font-semibold">Authentication</h2>
          <div className="mt-4 space-y-3">
            {([
              ["SAML SSO", "Required for all workspace members", Lock],
              ["MFA", "Required for approvers and admins", KeyRound],
              ["Session timeout", "12 hours", BellRing],
            ] as Array<[string, string, LucideIcon]>).map(([title, description, Icon]) => {
              const SettingIcon = Icon as LucideIcon;
              return (
                <div key={title as string} className="flex items-center gap-3 rounded-lg bg-bg-elevated p-3">
                  <SettingIcon className="h-4 w-4 text-accent" />
                  <div>
                    <p className="text-sm font-medium">{title}</p>
                    <p className="text-xs text-text-muted">{description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
        <section className="col-span-6 rounded-lg border border-border bg-bg-surface p-5">
          <h2 className="font-display text-base font-semibold">Runtime Defaults</h2>
          <div className="mt-4 space-y-3 text-sm text-text-secondary">
            <p>Safe AppSec mode is the default for new assessments.</p>
            <p>Request rate is capped at 30 rpm unless an admin lowers it.</p>
            <p>Evidence retention is 365 days for paid workspaces.</p>
            <p>External host assessments require explicit scope approval.</p>
          </div>
        </section>
      </div>
    </PortfolioShell>
  );
}

export function LoginScreen() {
  return (
    <div className="grid min-h-screen grid-cols-1 bg-bg bg-grid text-text-primary lg:grid-cols-2">
      <section className="flex min-h-[48vh] flex-col justify-between border-b border-accent/10 p-6 lg:min-h-screen lg:border-b-0 lg:border-r lg:p-10">
        <div className="flex items-center gap-3">
          <NorthwallMark size={28} className="text-accent" />
          <span className="font-display text-xl font-semibold">Northwall</span>
        </div>
        <div>
          <h1 className="mt-10 max-w-xl font-display text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
            Security work needs a graph, not another scanner dump.
          </h1>
          <p className="mt-5 max-w-lg text-sm leading-6 text-text-secondary">
            Coordinate AppSec agents, evidence, risk owners, and remediation from one approved assessment workspace.
          </p>
        </div>
        <p className="mt-8 text-xs text-text-muted">Owned environments only. Scope gates enforced before execution.</p>
      </section>
      <section className="flex items-center justify-center p-6 lg:p-10">
        <div className="w-full max-w-md rounded-xl border border-border bg-bg-surface p-8 risk-shadow">
          <h2 className="font-display text-2xl font-semibold">Sign in</h2>
          <p className="mt-2 text-sm text-text-muted">Use your workspace identity provider.</p>
          <div className="mt-8 space-y-3">
            <button className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-white">
              Continue with SSO
            </button>
            <button className="flex w-full items-center justify-center gap-2 rounded-lg border border-border px-4 py-3 text-sm text-text-secondary">
              Continue with email
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
