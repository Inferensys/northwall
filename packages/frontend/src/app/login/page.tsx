import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LoginButton } from "@/components/login-button";
import { NorthwallMark } from "@/components/logo";

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
    <div className="min-h-screen bg-[#f6f8fa] text-slate-950">
      <div className="mx-auto grid min-h-screen max-w-6xl items-center gap-10 px-6 py-10 lg:grid-cols-[1fr_390px]">
        <section>
          <div className="mb-8 flex items-center gap-3">
            <NorthwallMark size={28} className="text-teal-600" />
            <span className="text-sm font-semibold">Northwall</span>
          </div>
          <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-slate-950">
            AppSec reviews that start from the repo, not from a spreadsheet.
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-slate-600">
            Connect GitHub, choose a repo and branch, review the assessment plan, then create owner-ready issues from evidence-backed findings.
          </p>
          <div className="mt-8 grid max-w-2xl gap-3 text-sm text-slate-700 sm:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-white p-4">Repo graph</div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">Approval gate</div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">GitHub issues</div>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-slate-950">Sign in</h2>
            <p className="mt-1 text-sm text-slate-500">
              Use GitHub for repository access and issue creation.
            </p>
          </div>
          <LoginButton />
        </section>
      </div>
    </div>
  );
}
