import { redirect } from "next/navigation";
import AuthForm from "@/components/auth-form";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const supabase = await createServerSupabaseClient();

  if (!supabase) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-900">StockTrack</h1>
          <p className="mt-2 text-sm text-slate-600">Supabase configuration is missing. Add your environment variables to continue.</p>
        </div>
      </div>
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { count } = await supabase.from("business_members").select("id", { count: "exact", head: true });
    redirect(count ? "/dashboard" : "/onboarding");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">StockTrack</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">Welcome back</h1>
          <p className="mt-2 text-sm text-slate-600">Sign in to manage your stock, customers, and payments.</p>
        </div>
        <AuthForm mode="login" />
        <p className="text-center text-sm text-slate-600">
          Need an account? <a href="/signup" className="font-semibold text-slate-900">Create one</a>
        </p>
      </div>
    </div>
  );
}
