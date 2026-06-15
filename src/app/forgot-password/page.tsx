"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Mail } from "lucide-react";
import Button from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { useCountdown } from "@/hooks/useCountdown";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { secondsLeft, isActive, start } = useCountdown(60, "forgot-password-resend");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    const supabase = createClient();
    if (!supabase) {
      setError("Supabase is not configured yet.");
      setLoading(false);
      return;
    }

    const nextEmail = email.trim();
    if (!nextEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
      setError("Enter a valid email address.");
      setLoading(false);
      return;
    }

    const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : undefined;
    const { error } = await supabase.auth.resetPasswordForEmail(nextEmail, { redirectTo });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    start();
    setSuccess("If an account exists for this email, a reset link has been sent");
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[color:var(--background)] px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[color:var(--primary)]">StockTrack</p>
          <h1 className="mt-2 text-3xl font-semibold text-[color:var(--ink)]">Reset your password</h1>
          <p className="mt-2 text-sm text-[color:var(--muted)]">Enter the email linked to your account and we’ll send a recovery link.</p>
        </div>

        <div className="rounded-[1.5rem] border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-[0_18px_48px_-24px_rgba(43,36,32,0.45)]">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="forgot-email">Email</label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="forgot-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-slate-900"
                  placeholder="you@example.com"
                />
              </div>
            </div>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            {success ? <p className="text-sm text-emerald-600">{success}</p> : null}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Sending..." : "Send reset link"}
            </Button>
          </form>

          <div className="mt-4 flex items-center justify-between text-sm text-[color:var(--muted)]">
            <Link href="/login" className="inline-flex items-center gap-1 font-semibold text-[color:var(--ink)]">
              <ArrowLeft className="h-4 w-4" /> Back to login
            </Link>
            {isActive ? <span>Resend available in {secondsLeft}s</span> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
