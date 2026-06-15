import Link from "next/link";
import { redirect } from "next/navigation";
import AuthForm from "@/components/auth-form";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const supabase = await createServerSupabaseClient();

  if (!supabase) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[color:var(--background)] px-4">
        <div className="w-full max-w-md rounded-[1.5rem] border border-[color:var(--border)] bg-[color:var(--surface)] p-8 shadow-[0_18px_48px_-24px_rgba(43,36,32,0.45)]">
          <h1 className="text-2xl font-semibold text-[color:var(--ink)]">StockTrack</h1>
          <p className="mt-2 text-sm text-[color:var(--muted)]">Supabase configuration is missing. Add your environment variables to continue.</p>
        </div>
      </div>
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { count } = await supabase.from("business_members").select("id", { count: "exact", head: true });
    redirect(count ? "/dashboard/operations" : "/onboarding");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[color:var(--background)] px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[color:var(--primary)]">StockTrack</p>
          <h1 className="mt-2 text-3xl font-semibold text-[color:var(--ink)]">Welcome back</h1>
          <p className="mt-2 text-sm text-[color:var(--muted)]">Sign in to manage your stock, customers, and payments.</p>
        </div>
        <AuthForm mode="login" />
        <div className="flex items-center justify-between text-sm text-[color:var(--muted)]">
          <Link href="/forgot-password" className="font-semibold text-[color:var(--ink)]">
            Forgot password?
          </Link>
          <Link href="/signup" className="font-semibold text-[color:var(--ink)]">
            Create account
          </Link>
        </div>
      </div>
    </div>
  );
}
