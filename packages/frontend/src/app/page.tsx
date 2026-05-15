import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { NorthwallLogo, NorthwallMark } from "@/components/logo";

const steps = [
  ["01", "Build graph", "GitHub repo, branch, owners, routes, packages, auth, config, and CI."],
  ["02", "Approve mission", "Agent team, task order, evidence goals, and approval notes."],
  ["03", "Send handoffs", "Approved AppSec evidence becomes owner-ready remediation work."],
];

const advantages = [
  ["Agentic execution", "Run governed AppSec missions instead of collecting another passive queue."],
  ["Multi-agent orchestration", "Review named agents, responsibilities, dependencies, and approval gates before execution."],
  ["Parallel MoE specialists", "Route work to focused agents for auth, dependencies, ownership, config, CI, and threat context."],
  ["AppSec knowledge graph", "Map services, routes, owners, packages, controls, evidence, and remediation work together."],
];

const agents = [
  ["System Cartographer", "Builds the AppSec graph across source, routes, packages, owners, controls, and CI."],
  ["Auth Boundary Agent", "Reviews session, tenant, middleware, and permission-sensitive paths."],
  ["Dependency Analyst", "Checks package and lockfile exposure against release and ownership context."],
  ["Response Handoff Agent", "Turns evidence into owner-ready work with verification steps."],
];

function SignalField() {
  return (
    <div className="relative h-[190px] overflow-hidden border-b border-[#dfe4dd] bg-[#fbfcfa]">
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

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-white text-[#051914]">
      <section className="min-h-screen">
        <div className="grid min-h-screen grid-rows-[auto_auto_1fr_auto] bg-white">
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

          <div className="grid min-h-0 md:grid-cols-[1fr_380px] xl:grid-cols-[1fr_430px]">
            <section className="px-5 py-8 sm:px-10 sm:py-10 lg:px-14 lg:py-10">
              <h1 className="max-w-4xl font-serif text-[3.2rem] font-normal leading-[0.93] text-[#051914] sm:text-[4.8rem] lg:text-[4.8rem] xl:text-[6.2rem]">
                Orchestrate AppSec work with specialist AI agents.
              </h1>
              <p className="mt-7 max-w-2xl text-base leading-7 text-[#31413b] sm:text-lg lg:text-xl lg:leading-8">
                Northwall builds a graph of your application, dispatches parallel security agents, and turns approved evidence into owner-ready remediation work.
              </p>
            </section>

            <aside className="flex border-t border-[#dfe4dd] p-5 md:border-l md:border-t-0 sm:p-8 lg:p-10">
              <Link
                href="/workspace"
                className="group mt-auto flex w-full items-center justify-between border border-[#dfe4dd] bg-[#fbfcfa] px-4 py-4 text-left transition-colors hover:border-[#051914]"
              >
                <span className="font-serif text-2xl leading-none text-[#051914]">
                  See Northwall in action
                </span>
                <ArrowUpRight className="h-5 w-5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </Link>
            </aside>
          </div>

          <section className="grid border-t border-[#dfe4dd] sm:grid-cols-3">
            {steps.map(([number, title, body]) => (
              <article
                key={title}
                className="min-h-36 border-b border-[#dfe4dd] p-5 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0 lg:px-10"
              >
                <div className="font-display text-xs text-[#68736d]">{number}</div>
                <h2 className="mt-5 text-sm font-semibold text-[#051914]">{title}</h2>
                <p className="mt-2 max-w-xs text-sm leading-5 text-[#53615b]">{body}</p>
              </article>
            ))}
          </section>
        </div>
      </section>

      <section className="border-t border-[#dfe4dd] bg-[#fbfcfa] px-5 py-14 sm:px-10 lg:px-14">
        <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="font-display text-xs uppercase tracking-[0.18em] text-[#68736d]">Why Northwall</p>
            <h2 className="mt-4 max-w-xl font-serif text-4xl font-normal leading-tight text-[#051914] sm:text-5xl">
              Scanners produce queues. Northwall runs missions.
            </h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {advantages.map(([title, body]) => (
              <article key={title} className="border border-[#dfe4dd] bg-white p-5">
                <h3 className="text-sm font-semibold text-[#051914]">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-[#53615b]">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-[#dfe4dd] bg-white px-5 py-14 sm:px-10 lg:px-14">
        <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="font-display text-xs uppercase tracking-[0.18em] text-[#68736d]">Agent team</p>
            <h2 className="mt-4 max-w-xl font-serif text-4xl font-normal leading-tight text-[#051914] sm:text-5xl">
              Parallel specialists, approved before they execute.
            </h2>
          </div>
          <div className="grid gap-3">
            {agents.map(([title, body]) => (
              <article key={title} className="grid gap-3 border-b border-[#dfe4dd] pb-4 sm:grid-cols-[210px_1fr]">
                <h3 className="text-sm font-semibold text-[#051914]">{title}</h3>
                <p className="text-sm leading-6 text-[#53615b]">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
