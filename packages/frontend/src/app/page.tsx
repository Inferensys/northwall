import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  ArrowUpRight,
  Braces,
  BrainCircuit,
  CheckCircle2,
  GitBranch,
  LockKeyhole,
  Network,
  PackageCheck,
  Route,
  SearchCheck,
  Settings2,
  ShieldCheck,
  Split,
  UserCheck,
  Workflow,
} from "lucide-react";
import { NorthwallLogo, NorthwallMark } from "@/components/logo";

type Step = {
  number: string;
  title: string;
  body: string;
  icon: LucideIcon;
};

type Detail = {
  title: string;
  body: string;
  icon?: LucideIcon;
};

const steps: Step[] = [
  {
    number: "01",
    title: "Connect GitHub context",
    body: "Start with a repo, branch, owners, routes, packages, auth boundaries, config, and CI/CD evidence.",
    icon: GitBranch,
  },
  {
    number: "02",
    title: "Build the AppSec graph",
    body: "Map services, files, dependencies, routes, controls, owners, risks, and remediation work as linked context.",
    icon: Network,
  },
  {
    number: "03",
    title: "Approve the agent mission",
    body: "Review the agent team, task DAG, evidence goals, policy limits, and approval notes before execution starts.",
    icon: Workflow,
  },
  {
    number: "04",
    title: "Run parallel specialists",
    body: "Dispatch MoE-style agents for auth, dependencies, ownership, config, CI, and threat context in parallel.",
    icon: Split,
  },
  {
    number: "05",
    title: "Send owner handoffs",
    body: "Turn approved evidence into concise remediation work with owner context, verification steps, and GitHub handoff.",
    icon: CheckCircle2,
  },
];

const missionMetrics = [
  ["Context", "Repo, branch, owners, routes, packages"],
  ["Planner", "Task DAG, approval gates, evidence goals"],
  ["Specialists", "Auth, dependency, config, CI/CD, threat"],
  ["Output", "Owner handoff with verification steps"],
];

const advantages: Detail[] = [
  {
    title: "Agentic execution",
    body: "Northwall runs governed AppSec missions. It plans work, executes with tools, gathers evidence, and pauses for approval where human judgment matters.",
    icon: BrainCircuit,
  },
  {
    title: "Multi-agent orchestration",
    body: "Security work is split across named agents with clear responsibilities, dependencies, task order, and status visible during the run.",
    icon: Workflow,
  },
  {
    title: "Parallel MoE specialists",
    body: "The mission planner routes work to focused agents instead of asking one general model to reason through every risk surface sequentially.",
    icon: Split,
  },
  {
    title: "AppSec knowledge graph",
    body: "A living graph links code, services, owners, routes, packages, controls, findings, and handoffs so every action has context.",
    icon: Network,
  },
];

const technicalLayers: Detail[] = [
  {
    title: "Graph-first context",
    body: "Entity resolution, graph traversal, and relationship-aware retrieval help agents reason about routes, packages, owners, controls, and blast radius together.",
  },
  {
    title: "MoE-style agent routing",
    body: "A planner breaks missions into specialist tracks for authentication, dependency reachability, CI/CD policy, configuration exposure, and owner routing.",
  },
  {
    title: "Task DAGs and approval gates",
    body: "Northwall turns AppSec work into an execution graph with ordered tasks, dependencies, human review points, and auditable decisions.",
  },
  {
    title: "Evidence-grounded RAG",
    body: "Agents should ground reasoning in repo inventory, code paths, package metadata, runtime notes, and prior decisions instead of producing generic advice.",
  },
  {
    title: "Bounded ReAct-style loops",
    body: "Specialists inspect, reason, call tools, summarize evidence, and stop at safe AppSec outputs rather than drifting into open-ended investigation.",
  },
  {
    title: "Security vocabulary built in",
    body: "The workflow can speak in terms of CWE, CVE, CVSS, EPSS, OWASP ASVS, SLSA, OSSF Scorecard, SBOM, SAST, SCA, and dependency reachability.",
  },
];

const useCases: Detail[] = [
  {
    title: "Auth and tenant-boundary review",
    body: "Trace session handling, middleware, role checks, route guards, and permission-sensitive code paths before owners receive remediation work.",
    icon: LockKeyhole,
  },
  {
    title: "Dependency and package exposure",
    body: "Connect package findings to lockfiles, reachable code paths, owners, release context, and practical fix guidance.",
    icon: PackageCheck,
  },
  {
    title: "CI/CD and configuration checks",
    body: "Review pipeline defaults, secret handling, branch controls, deploy gates, and environment-sensitive configuration with specialist context.",
    icon: Settings2,
  },
  {
    title: "Application route and API context",
    body: "Map routes, handlers, edge functions, webhooks, and service boundaries so risk is tied to the system surface security teams care about.",
    icon: Route,
  },
  {
    title: "Owner-ready remediation",
    body: "Create handoffs that include evidence, priority, affected area, suggested action, and verification steps for the responsible owner.",
    icon: UserCheck,
  },
  {
    title: "Security leader review",
    body: "Give AppSec leaders one place to inspect mission scope, agent behavior, evidence quality, approvals, and handoff status.",
    icon: SearchCheck,
  },
];

const agents: Detail[] = [
  {
    title: "System Cartographer",
    body: "Builds the AppSec graph across source, routes, packages, owners, controls, and CI/CD context.",
  },
  {
    title: "Auth Boundary Agent",
    body: "Reviews session, tenant, middleware, and permission-sensitive paths with OWASP ASVS-style framing.",
  },
  {
    title: "Dependency Analyst",
    body: "Connects package risk to lockfiles, reachable code paths, release notes, and owner context.",
  },
  {
    title: "CI/Config Analyst",
    body: "Inspects branch rules, workflow defaults, secret handling, deploy gates, and configuration drift.",
  },
  {
    title: "Threat Context Agent",
    body: "Adds CWE, CVE, CVSS, EPSS, exploit maturity, and business exposure context where it is useful.",
  },
  {
    title: "Response Handoff Agent",
    body: "Turns approved evidence into remediation work with owner, priority, rationale, and verification steps.",
  },
];

const comparisons = [
  {
    alternative: "Scanners",
    usefulFor: "Detecting known patterns and producing raw finding queues.",
    northwall: "Organizing evidence into graph-backed missions and owner-ready action.",
  },
  {
    alternative: "AI code review bots",
    usefulFor: "Commenting on diffs, pull requests, or narrow code snippets.",
    northwall: "Coordinating specialist agents across source, dependencies, owners, controls, and handoff.",
  },
  {
    alternative: "Ticket queues",
    usefulFor: "Tracking work after someone has already translated the risk.",
    northwall: "Producing the translation: evidence, owner, action, priority, and verification path.",
  },
  {
    alternative: "Manual AppSec triage",
    usefulFor: "Expert judgment, exception handling, and final approval.",
    northwall: "Doing the repeatable investigation work before the reviewer makes the decision.",
  },
];

const faqs = [
  {
    question: "What is agentic AppSec orchestration?",
    answer:
      "Agentic AppSec orchestration is a way to run application security work through planned AI missions. The system builds context, assigns work to specialist agents, runs evidence gathering, and keeps humans in control before remediation is sent to owners.",
  },
  {
    question: "Is Northwall just an AI code review tool?",
    answer:
      "No. GitHub is the first execution surface, but the product is positioned as an AppSec operations layer. Code review is one input. Northwall also focuses on graph context, owner mapping, dependency context, approval-gated missions, and remediation handoff.",
  },
  {
    question: "Does Northwall replace SAST, SCA, DAST, or cloud security tools?",
    answer:
      "No. Northwall is designed to work around those security signals, not replace them. The current product starts with GitHub application context, while SAST, SCA, DAST, SBOM, SIEM, EDR, cloud, Jira, and evidence-store connectors are extension paths.",
  },
  {
    question: "What are parallel MoE security agents?",
    answer:
      "MoE means mixture of experts. In Northwall, it means routing a mission to focused security agents such as an auth boundary agent, dependency analyst, CI/config analyst, system cartographer, and response handoff agent instead of relying on one generic agent.",
  },
  {
    question: "Why does the AppSec knowledge graph matter?",
    answer:
      "Security findings are easier to act on when they are connected to services, routes, packages, owners, controls, and prior decisions. The graph helps agents and reviewers understand impact, ownership, and remediation sequence.",
  },
  {
    question: "How does Northwall keep humans in control?",
    answer:
      "Northwall shows the mission plan before execution, uses approval gates, streams agent activity, and drafts owner handoffs for review. The goal is governed execution, not a black-box security bot.",
  },
];

const schema = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://inferensys.com/#organization",
      name: "Inferensys",
      url: "https://inferensys.com/",
    },
    {
      "@type": "SoftwareApplication",
      "@id": "https://github.com/Inferensys/northwall#software",
      name: "Northwall",
      applicationCategory: "SecurityApplication",
      operatingSystem: "Web",
      publisher: { "@id": "https://inferensys.com/#organization" },
      description:
        "Northwall is Agentic AppSec orchestration for security teams. It builds application graph context, dispatches specialist AI agents, and turns approved evidence into owner-ready remediation work.",
      featureList: [
        "Agentic AppSec missions",
        "AppSec knowledge graph",
        "Multi-agent orchestration",
        "Parallel MoE security agents",
        "Human approval gates",
        "Owner-ready remediation handoff",
      ],
      sameAs: ["https://github.com/Inferensys/northwall"],
    },
    {
      "@type": "FAQPage",
      "@id": "https://github.com/Inferensys/northwall#faq",
      mainEntity: faqs.map((faq) => ({
        "@type": "Question",
        name: faq.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: faq.answer,
        },
      })),
    },
  ],
};

function SignalField() {
  return (
    <div className="relative h-[100px] overflow-hidden border-b border-[#dfe4dd] bg-[#fbfcfa] sm:h-[115px] lg:h-[120px]">
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,25,20,0.055)_1px,transparent_1px)] bg-[length:18px_18px]" />
      <div className="absolute inset-x-7 bottom-7 h-32">
        {Array.from({ length: 64 }).map((_, index) => {
          const isActive = index >= 27 && index <= 36;
          const slope = Math.max(22, 122 - Math.abs(index - 24) * 3.3);
          const lower = Math.max(16, 100 - Math.abs(index - 33) * 5);

          return (
            <span
              key={index}
              className="absolute bottom-0 w-px"
              style={{
                left: `${index * 1.58}%`,
                height: `${slope}px`,
                background: isActive ? "#10bfa3" : "rgba(5,25,20,0.13)",
                boxShadow: isActive ? "0 -38px 0 rgba(16,191,163,0.28)" : undefined,
              }}
            >
              <span
                className="absolute bottom-0 block w-[3px]"
                style={{
                  height: `${lower}px`,
                  background: isActive ? "#079b84" : "rgba(5,25,20,0.055)",
                }}
              />
            </span>
          );
        })}
      </div>
    </div>
  );
}

function SectionIntro({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: string;
  body?: string;
}) {
  return (
    <div>
      <p className="font-display text-xs uppercase tracking-[0.18em] text-[#68736d]">{eyebrow}</p>
      <h2 className="mt-4 max-w-2xl font-serif text-4xl font-normal leading-tight text-[#051914] sm:text-5xl">
        {title}
      </h2>
      {body && <p className="mt-5 max-w-xl text-sm leading-6 text-[#53615b] sm:text-base sm:leading-7">{body}</p>}
    </div>
  );
}

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-white text-[#051914]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      <section>
        <div className="grid bg-white">
          <header className="flex h-16 items-center justify-between border-b border-[#dfe4dd] px-5 sm:px-10 lg:px-14">
            <Link href="/" className="flex items-center gap-3">
              <NorthwallMark size={26} className="text-[#051914]" />
              <NorthwallLogo className="text-lg" />
            </Link>
            <Link
              href="/login"
              className="font-display text-xs uppercase text-[#051914] underline-offset-4 hover:underline"
            >
              Sign in
            </Link>
          </header>

          <SignalField />

          <div className="grid min-h-0 md:grid-cols-[1fr_390px] xl:grid-cols-[1fr_460px]">
            <section className="px-5 py-8 sm:px-10 sm:py-10 lg:px-14 lg:py-10">
              <p className="font-display text-xs uppercase tracking-[0.18em] text-[#68736d]">
                Agentic AppSec orchestration
              </p>
              <h1 className="mt-5 max-w-5xl font-serif text-[2.65rem] font-normal leading-[0.96] text-[#051914] sm:text-[3.7rem] lg:text-[4.35rem] xl:text-[5rem]">
                Run security missions with specialist AI agents.
              </h1>
              <p className="mt-7 max-w-3xl text-base leading-7 text-[#31413b] sm:text-lg lg:text-xl lg:leading-8">
                Northwall turns GitHub application context into approved AppSec work by building a knowledge graph, planning governed agent missions, and dispatching parallel MoE specialists across auth, dependencies, CI/CD, config, ownership, and threat context.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/workspace"
                  className="inline-flex min-h-11 items-center justify-center gap-2 border border-[#051914] bg-[#051914] px-4 py-3 font-display text-xs uppercase text-white transition-colors hover:bg-[#102a22]"
                >
                  See the mission workflow
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <a
                  href="#architecture"
                  className="inline-flex min-h-11 items-center justify-center gap-2 border border-[#dfe4dd] bg-white px-4 py-3 font-display text-xs uppercase text-[#051914] transition-colors hover:border-[#051914]"
                >
                  Read the architecture
                  <ArrowRight className="h-4 w-4" />
                </a>
              </div>
            </section>

            <aside className="border-t border-[#dfe4dd] p-5 md:border-l md:border-t-0 sm:p-7 lg:p-8">
              <div className="flex h-full flex-col">
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-display text-xs uppercase tracking-[0.18em] text-[#68736d]">
                      Mission preview
                    </p>
                    <ShieldCheck className="h-5 w-5 text-[#0b7f56]" />
                  </div>
                  <h2 className="mt-4 font-serif text-3xl font-normal leading-tight text-[#051914]">
                    Auth boundary graph review
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-[#53615b]">
                    Northwall turns source evidence into a scoped plan before any specialist agent executes.
                  </p>
                </div>

                <div className="mt-5 grid gap-2">
                  {missionMetrics.map(([label, value]) => (
                    <div key={label} className="border-t border-[#dfe4dd] pt-2">
                      <div className="font-display text-[11px] uppercase tracking-[0.12em] text-[#68736d]">{label}</div>
                      <div className="mt-1 text-sm leading-5 text-[#051914]">{value}</div>
                    </div>
                  ))}
                </div>

                <Link
                  href="/workspace"
                  className="group mt-5 flex w-full items-center justify-between border border-[#dfe4dd] bg-[#fbfcfa] px-4 py-3 text-left transition-colors hover:border-[#051914] md:mt-auto"
                >
                  <span className="font-serif text-2xl leading-none text-[#051914]">
                    Inspect the mission
                  </span>
                  <ArrowUpRight className="h-5 w-5 shrink-0 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </Link>
              </div>
            </aside>
          </div>

          <section id="workflow" className="grid border-t border-[#dfe4dd] sm:grid-cols-2 xl:grid-cols-5">
            {steps.map(({ number, title, body, icon: Icon }) => (
              <article
                key={title}
                className="min-h-40 border-b border-[#dfe4dd] p-5 last:border-b-0 sm:border-r xl:border-b-0 xl:last:border-r-0 lg:px-7"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-display text-xs text-[#68736d]">{number}</span>
                  <Icon className="h-4 w-4 text-[#0b7f56]" />
                </div>
                <h2 className="mt-5 text-sm font-semibold text-[#051914]">{title}</h2>
                <p className="mt-2 max-w-xs text-sm leading-5 text-[#53615b]">{body}</p>
              </article>
            ))}
          </section>
        </div>
      </section>

      <section className="border-t border-[#dfe4dd] bg-[#fbfcfa] px-5 py-16 sm:px-10 lg:px-14">
        <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr]">
          <SectionIntro
            eyebrow="Definition"
            title="What is Northwall?"
            body="Northwall is an agentic AppSec orchestration layer for security leaders who need application security work to move from evidence to action without losing control."
          />
          <div className="border-l border-[#dfe4dd] pl-5 sm:pl-8">
            <p className="max-w-3xl text-xl leading-9 text-[#31413b] sm:text-2xl sm:leading-10">
              It is not a passive code review bot. Northwall builds graph context from application evidence, proposes a mission plan, routes work to specialist security agents, streams execution, and creates owner-ready remediation handoffs after approval.
            </p>
            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              {["Agentic AI execution", "Multi-agent AppSec orchestration", "Parallel MoE security specialists", "Application security knowledge graph"].map((item) => (
                <div key={item} className="flex items-center gap-2 text-sm font-medium text-[#051914]">
                  <CheckCircle2 className="h-4 w-4 text-[#0b7f56]" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-[#dfe4dd] bg-white px-5 py-16 sm:px-10 lg:px-14">
        <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
          <SectionIntro
            eyebrow="Why Northwall"
            title="Scanners produce signals. Northwall runs the AppSec mission."
            body="Existing scanners and review tools still matter. Northwall adds the orchestration layer that turns those signals into scoped, reviewed, owner-ready work."
          />
          <div className="grid gap-3 sm:grid-cols-2">
            {advantages.map(({ title, body, icon: Icon }) => (
              <article key={title} className="border border-[#dfe4dd] bg-[#fbfcfa] p-5">
                {Icon && <Icon className="h-5 w-5 text-[#0b7f56]" />}
                <h3 className="mt-5 text-sm font-semibold text-[#051914]">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-[#53615b]">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="architecture" className="border-t border-[#dfe4dd] bg-[#fbfcfa] px-5 py-16 sm:px-10 lg:px-14">
        <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
          <SectionIntro
            eyebrow="Technical foundation"
            title="Graph context, MoE routing, RAG, and governed tool use."
            body="The product language is technical because the work is technical, but every layer has a practical job: reduce manual triage and make security action easier to approve."
          />
          <div className="grid gap-3">
            {technicalLayers.map(({ title, body }) => (
              <article key={title} className="grid gap-2 border-b border-[#dfe4dd] pb-4 sm:grid-cols-[230px_1fr]">
                <h3 className="text-sm font-semibold text-[#051914]">{title}</h3>
                <p className="text-sm leading-6 text-[#53615b]">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-[#dfe4dd] bg-white px-5 py-16 sm:px-10 lg:px-14">
        <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
          <SectionIntro
            eyebrow="Use cases"
            title="Built for AppSec work that needs context, ownership, and approval."
            body="Northwall starts with GitHub because source, package, ownership, and CI context are where many application security decisions become concrete."
          />
          <div className="grid gap-3 sm:grid-cols-2">
            {useCases.map(({ title, body, icon: Icon }) => (
              <article key={title} className="border border-[#dfe4dd] bg-white p-5">
                {Icon && <Icon className="h-5 w-5 text-[#315e80]" />}
                <h3 className="mt-5 text-sm font-semibold text-[#051914]">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-[#53615b]">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-[#dfe4dd] bg-[#fbfcfa] px-5 py-16 sm:px-10 lg:px-14">
        <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
          <SectionIntro
            eyebrow="Agent team"
            title="Parallel specialists, approved before they execute."
            body="Security teams can see who is doing what, why it is in scope, and where each agent fits in the mission before the run begins."
          />
          <div className="grid gap-3">
            {agents.map(({ title, body }) => (
              <article key={title} className="grid gap-3 border-b border-[#dfe4dd] pb-4 sm:grid-cols-[230px_1fr]">
                <h3 className="text-sm font-semibold text-[#051914]">{title}</h3>
                <p className="text-sm leading-6 text-[#53615b]">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-[#dfe4dd] bg-white px-5 py-16 sm:px-10 lg:px-14">
        <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
          <SectionIntro
            eyebrow="Evaluation"
            title="Use Northwall alongside the tools security teams already trust."
            body="The goal is not to replace every security control. The goal is to make AppSec evidence easier to understand, approve, assign, and verify."
          />
          <div className="overflow-hidden border border-[#dfe4dd]">
            <div className="grid bg-[#fbfcfa] font-display text-[11px] uppercase tracking-[0.12em] text-[#68736d] sm:grid-cols-[0.7fr_1fr_1fr]">
              <div className="border-b border-[#dfe4dd] p-4 sm:border-r">Tool type</div>
              <div className="border-b border-[#dfe4dd] p-4 sm:border-r">Useful for</div>
              <div className="border-b border-[#dfe4dd] p-4">What Northwall adds</div>
            </div>
            {comparisons.map((row) => (
              <div key={row.alternative} className="grid border-b border-[#dfe4dd] last:border-b-0 sm:grid-cols-[0.7fr_1fr_1fr]">
                <div className="border-b border-[#dfe4dd] p-4 text-sm font-semibold text-[#051914] sm:border-b-0 sm:border-r">
                  {row.alternative}
                </div>
                <div className="border-b border-[#dfe4dd] p-4 text-sm leading-6 text-[#53615b] sm:border-b-0 sm:border-r">
                  {row.usefulFor}
                </div>
                <div className="p-4 text-sm leading-6 text-[#53615b]">{row.northwall}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-[#dfe4dd] bg-[#fbfcfa] px-5 py-16 sm:px-10 lg:px-14">
        <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
          <SectionIntro
            eyebrow="Connector posture"
            title="GitHub first. Broader security evidence next."
            body="The current product story stays honest: GitHub is the first real connector and execution surface. SIEM, EDR, cloud, Jira, SAST, SCA, DAST, SBOM, and evidence-store integrations are framed as extension paths."
          />
          <div className="border-l border-[#dfe4dd] pl-5 sm:pl-8">
            <Braces className="h-5 w-5 text-[#315e80]" />
            <p className="mt-5 max-w-3xl text-base leading-7 text-[#31413b]">
              That framing matters for security buyers. It says Northwall is practical today, extensible tomorrow, and careful about the difference between implemented surfaces and roadmap direction.
            </p>
          </div>
        </div>
      </section>

      <section className="border-t border-[#dfe4dd] bg-white px-5 py-16 sm:px-10 lg:px-14">
        <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
          <SectionIntro
            eyebrow="FAQ"
            title="Straight answers for security leaders evaluating agentic AppSec."
            body="These answers are written for people comparing AI code review, security scanners, AppSec automation, and agentic AI execution platforms."
          />
          <div className="grid gap-3">
            {faqs.map((faq) => (
              <article key={faq.question} className="border-b border-[#dfe4dd] pb-5">
                <h3 className="text-sm font-semibold text-[#051914]">{faq.question}</h3>
                <p className="mt-3 text-sm leading-6 text-[#53615b]">{faq.answer}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-[#dfe4dd] bg-[#051914] px-5 py-12 text-white sm:px-10 lg:px-14">
        <div className="grid items-center gap-7 lg:grid-cols-[1fr_auto]">
          <div>
            <p className="font-display text-xs uppercase tracking-[0.18em] text-white/55">Run a mission</p>
            <h2 className="mt-4 max-w-3xl font-serif text-4xl font-normal leading-tight sm:text-5xl">
              See how graph context becomes approved AppSec action.
            </h2>
          </div>
          <Link
            href="/workspace"
            className="inline-flex min-h-11 items-center justify-center gap-2 border border-white/20 bg-white px-4 py-3 font-display text-xs uppercase text-[#051914] transition-colors hover:bg-[#e6ebe4]"
          >
            Open the demo workspace
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </main>
  );
}
