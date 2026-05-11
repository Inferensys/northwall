import Link from "next/link";
import { ArrowUpRight, CheckCircle2 } from "lucide-react";
import { NorthwallLogo, NorthwallMark } from "@/components/logo";

const agents = [
  ["Triage", "Separate weak signals from incidents worth a response run."],
  ["Context", "Map source, owners, dependencies, CI, and affected paths."],
  ["Plan", "Show the agent team, task order, evidence goals, and approval notes."],
  ["Handoff", "Draft GitHub issues that owners can act on without a second rewrite."],
];

const flow = [
  "Connect GitHub",
  "Build context",
  "Review plan",
  "Run agents",
  "Create issues",
];

const integrations = [
  "Microsoft Sentinel",
  "CrowdStrike",
  "GitHub",
  "Snyk",
  "Semgrep",
  "Jira",
  "Slack",
];

function SignalField() {
  return (
    <div className="relative h-[180px] overflow-hidden border-b border-[#dfe4dd] bg-[#fbfcfa]">
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,25,20,0.05)_1px,transparent_1px)] bg-[length:18px_18px]" />
      <div className="absolute left-8 right-8 top-10 h-32">
        {Array.from({ length: 70 }).map((_, index) => {
          const isActive = index >= 24 && index <= 33;
          const height = Math.max(18, 124 - Math.abs(index - 22) * 2.7);
          const lowerHeight = Math.max(12, 108 - Math.abs(index - 30) * 4.4);
          return (
            <span
              key={index}
              className="absolute bottom-0 w-px"
              style={{
                left: `${index * 1.45}%`,
                height: `${height}px`,
                background: isActive ? "#11bfa3" : "rgba(5,25,20,0.14)",
                boxShadow: isActive ? "0 -42px 0 rgba(17,191,163,0.28)" : undefined,
              }}
            >
              <span
                className="absolute bottom-0 block w-[3px]"
                style={{
                  height: `${lowerHeight}px`,
                  background: isActive ? "#079b84" : "rgba(5,25,20,0.06)",
                }}
              />
            </span>
          );
        })}
      </div>
    </div>
  );
}

function MiniRun() {
  return (
    <div className="relative border-l border-[#dfe4dd] bg-[#fbfcfa] p-6 md:p-8">
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(17,191,163,0.16)_1px,transparent_1px)] bg-[length:16px_16px] opacity-60" />
      <div className="relative mx-auto max-w-md border border-[#dfe4dd] bg-white p-5 shadow-[0_18px_50px_rgba(5,25,20,0.08)]">
        <div className="mb-4 flex items-center justify-between border-b border-[#e5e9e3] pb-3">
          <span className="font-display text-xs uppercase text-[#68736d]">Live SOC run</span>
          <span className="h-2 w-2 rounded-full bg-[#11bfa3]" />
        </div>
        <div className="space-y-3 text-sm">
          {[
            ["Context mapper", "6 investigation areas indexed"],
            ["Triage agent", "3 findings with evidence"],
            ["Handoff writer", "Issues ready for review"],
          ].map(([agent, result]) => (
            <div key={agent} className="grid grid-cols-[110px_1fr] gap-3 border-b border-[#eef1ed] pb-3 last:border-0 last:pb-0">
              <span className="font-display text-xs text-[#68736d]">{agent}</span>
              <span className="text-[#051914]">{result}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[#00150f] text-[#051914]">
      <section className="mx-auto flex min-h-screen max-w-7xl items-center px-4 py-8 sm:px-8">
        <div className="w-full overflow-hidden border border-white/20 bg-white shadow-[0_40px_120px_rgba(0,0,0,0.35)]">
          <header className="flex h-16 items-center justify-between border-b border-[#dfe4dd] px-5 sm:px-8">
            <Link href="/" className="flex items-center gap-3">
              <NorthwallMark size={26} className="text-[#051914]" />
              <NorthwallLogo className="text-lg" />
            </Link>
            <nav className="hidden items-center gap-7 font-display text-xs uppercase text-[#28352f] md:flex">
              <a href="#workflow" className="hover:text-[#0b7f56]">Workflow</a>
              <a href="#agents" className="hover:text-[#0b7f56]">Agents</a>
              <a href="#stack" className="hover:text-[#0b7f56]">Stack</a>
            </nav>
            <Link
              href="/login"
              className="font-display text-xs uppercase text-[#051914] underline-offset-4 hover:underline"
            >
              Sign in
            </Link>
          </header>

          <SignalField />

          <div className="grid border-b border-[#dfe4dd] md:grid-cols-[1.05fr_0.95fr]">
            <section className="px-5 py-8 sm:px-8 sm:py-10">
              <h1 className="max-w-3xl font-serif text-[3.1rem] font-normal leading-[0.92] text-[#051914] sm:text-[4.5rem] lg:text-[5.4rem]">
                Agentic SOC for real response work
              </h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-[#31413b]">
                Northwall maps alerts to source context, assigns specialist agents, shows the plan before execution, and turns approved findings into owner-ready GitHub issues.
              </p>
            </section>

            <section className="grid border-t border-[#dfe4dd] md:grid-rows-[1fr_auto] md:border-l md:border-t-0">
              <div className="grid grid-cols-2 border-b border-[#dfe4dd]">
                {["Multi-agent security operations", "Human approval before action"].map((item) => (
                  <div key={item} className="min-h-32 border-r border-[#dfe4dd] p-5 last:border-r-0">
                    <CheckCircle2 className="mb-4 h-4 w-4 text-[#0b7f56]" />
                    <p className="text-sm leading-5 text-[#31413b]">{item}</p>
                  </div>
                ))}
              </div>
              <div className="flex items-end p-5 sm:p-8">
                <Link
                  href="/workspace"
                  className="group flex w-full items-center justify-between border border-[#e5e9e3] bg-[#fbfcfa] px-4 py-4 text-left transition-colors hover:border-[#051914]"
                >
                  <span className="font-serif text-2xl leading-none text-[#051914]">See Northwall in action</span>
                  <ArrowUpRight className="h-5 w-5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </Link>
              </div>
            </section>
          </div>

          <section id="workflow" className="grid border-b border-[#dfe4dd] md:grid-cols-[0.36fr_0.64fr]">
            <div className="border-b border-[#dfe4dd] p-6 md:border-b-0 md:border-r md:p-8">
              <p className="max-w-sm text-lg leading-7 text-[#31413b]">
                A response run should not be a black box. Northwall shows the source, the graph, the agents, the plan, and the final work item.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-5">
              {flow.map((step, index) => (
                <div key={step} className="min-h-32 border-b border-[#dfe4dd] p-5 sm:border-b-0 sm:border-r last:border-r-0">
                  <span className="font-display text-xs text-[#68736d]">0{index + 1}</span>
                  <p className="mt-5 text-sm font-medium leading-5 text-[#051914]">{step}</p>
                </div>
              ))}
            </div>
          </section>

          <section id="agents" className="grid md:grid-cols-[0.55fr_0.45fr]">
            <div className="grid grid-cols-1 sm:grid-cols-2">
              {agents.map(([title, body]) => (
                <article key={title} className="min-h-48 border-b border-r border-[#dfe4dd] p-6 md:p-8">
                  <h2 className="font-serif text-3xl font-normal text-[#051914]">{title}</h2>
                  <p className="mt-4 max-w-xs text-sm leading-6 text-[#53615b]">{body}</p>
                </article>
              ))}
            </div>
            <MiniRun />
          </section>

          <section id="stack" className="grid border-t border-[#dfe4dd] md:grid-cols-[0.36fr_0.64fr]">
            <div className="p-6 md:border-r md:p-8">
              <h2 className="font-serif text-4xl font-normal leading-none">Built for the SOC stack you already have</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4">
              {integrations.map((name) => (
                <div key={name} className="border-l border-t border-[#dfe4dd] p-5 first:border-l-0 sm:first:border-l">
                  <p className="font-display text-xs uppercase leading-5 text-[#31413b]">{name}</p>
                </div>
              ))}
              <Link
                href="https://inferensys.com/contact"
                className="group border-l border-t border-[#dfe4dd] bg-[#051914] p-5 text-white"
              >
                <span className="font-display text-xs uppercase">Talk to Inferensys</span>
                <ArrowUpRight className="mt-8 h-5 w-5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </Link>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
