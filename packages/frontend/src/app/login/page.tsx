import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LoginButton } from "@/components/login-button";
import { NorthwallLogo } from "@/components/logo";

export default async function LoginPage() {
  const hasSupabaseConfig =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  if (hasSupabaseConfig && process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS !== "true") {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      redirect("/");
    }
  }

  return (
    <div className="min-h-screen bg-[#f6f7f4] text-[#051914]">
      <div className="mx-auto grid min-h-screen max-w-6xl items-center gap-10 px-6 py-10 lg:grid-cols-[1fr_390px]">
        <section>
          <div className="mb-8 flex items-center gap-3">
            <NorthwallLogo className="text-2xl" />
          </div>
          <h1 className="max-w-2xl text-4xl font-semibold tracking-normal text-[#051914]">
            Agentic SOC, starting with real context.
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-[#31413b]">
            Northwall brings agents into security operations: triage alerts, build the investigation graph, draft the response plan, and send the work to the right owner.
          </p>
          <div className="mt-8 grid max-w-2xl gap-3 text-sm text-[#31413b] sm:grid-cols-3">
            <div className="rounded-md border border-[#d9ded7] bg-white p-4">SOC triage</div>
            <div className="rounded-md border border-[#d9ded7] bg-white p-4">Agent graph</div>
            <div className="rounded-md border border-[#d9ded7] bg-white p-4">Owner handoff</div>
          </div>
        </section>

        <section className="rounded-md border border-[#d9ded7] bg-white p-6 shadow-sm">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-[#051914]">Sign in</h2>
            <p className="mt-1 text-sm text-[#77827d]">
              GitHub is the first connector for code context and remediation work items.
            </p>
          </div>
          <LoginButton />
        </section>
      </div>
    </div>
  );
}
