import { Suspense } from "react";
import AuthForm from "@/components/auth-form";

export default function SignupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">StockTrack</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">Create your account</h1>
          <p className="mt-2 text-sm text-slate-600">Start tracking stock and customers with your team.</p>
        </div>
        <Suspense fallback={<div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">Loading…</div>}>
          <AuthForm mode="signup" />
        </Suspense>
        <p className="text-center text-sm text-slate-600">
          Already have an account? <a href="/login" className="font-semibold text-slate-900">Sign in</a>
        </p>
      </div>
    </div>
  );
}
