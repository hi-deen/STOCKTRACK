import { redirect } from "next/navigation";
import OnboardingForm from "@/components/onboarding-form";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const supabase = await createServerSupabaseClient();

  if (!supabase) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-4xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-900">StockTrack</h1>
          <p className="mt-2 text-sm text-slate-600">Supabase configuration is missing. Add your environment variables to continue.</p>
        </div>
      </div>
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { count } = await supabase.from("business_members").select("id", { count: "exact", head: true });
  if (count && count > 0) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-12">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">StockTrack</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">Set up your first workspace</h1>
          <p className="mt-2 text-sm text-slate-600">Create a new business or join an existing one to get started.</p>
        </div>
        <OnboardingForm />
      </div>
    </div>
  );
}
