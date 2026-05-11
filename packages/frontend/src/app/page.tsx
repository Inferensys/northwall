import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { NorthwallLogo, NorthwallMark } from "@/components/logo";

const steps = [
  ["01", "Connect source", "GitHub repo, branch, owners, CI, and package context."],
  ["02", "Review plan", "Agent team, task order, evidence goals, and approval notes."],
  ["03", "Create issues", "Approved findings become owner-ready GitHub work items."],
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
    <main className="min-h-screen bg-[#00150f] px-4 py-6 text-[#051914] sm:px-8 sm:py-10">
      <section className="mx-auto flex min-h-[calc(100vh-80px)] max-w-6xl items-center">
        <div className="w-full overflow-hidden border border-white/20 bg-white shadow-[0_40px_120px_rgba(0,0,0,0.32)]">
          <header className="flex h-16 items-center justify-between border-b border-[#dfe4dd] px-5 sm:px-7">
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

          <div className="grid md:grid-cols-[1fr_360px]">
            <section className="px-5 py-9 sm:px-8 sm:py-12">
              <h1 className="max-w-3xl font-serif text-[3.15rem] font-normal leading-[0.93] text-[#051914] sm:text-[5rem] md:text-[5.7rem]">
                Turn SOC alerts into owner-ready work.
              </h1>
              <p className="mt-7 max-w-2xl text-base leading-7 text-[#31413b] sm:text-lg">
                Northwall runs specialist agents across source context, evidence, and ownership. Analysts approve the plan before issues are created.
              </p>
            </section>

            <aside className="flex border-t border-[#dfe4dd] p-5 md:border-l md:border-t-0 sm:p-7">
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
                className="min-h-36 border-b border-[#dfe4dd] p-5 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0"
              >
                <div className="font-display text-xs text-[#68736d]">{number}</div>
                <h2 className="mt-5 text-sm font-semibold text-[#051914]">{title}</h2>
                <p className="mt-2 max-w-xs text-sm leading-5 text-[#53615b]">{body}</p>
              </article>
            ))}
          </section>
        </div>
      </section>
    </main>
  );
}
