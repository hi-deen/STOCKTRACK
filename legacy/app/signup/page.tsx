import Link from "next/link";
import { Suspense } from "react";
import AuthForm from "@/components/auth-form";

export default function SignupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[color:var(--background)] px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[color:var(--primary)]">StockTrack</p>
          <h1 className="mt-2 text-3xl font-semibold text-[color:var(--ink)]">Create your account</h1>
          <p className="mt-2 text-sm text-[color:var(--muted)]">Start tracking stock, payments, and daily field work with your team.</p>
        </div>
        <Suspense fallback={<div className="rounded-[1.5rem] border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-[0_18px_48px_-24px_rgba(43,36,32,0.45)]">Loading…</div>}>
          <AuthForm mode="signup" />
        </Suspense>
        <p className="text-center text-sm text-[color:var(--muted)]">
          Already have an account? <Link href="/login" className="font-semibold text-[color:var(--ink)]">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
