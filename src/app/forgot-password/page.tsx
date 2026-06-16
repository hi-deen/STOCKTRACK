"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Mail } from "lucide-react";
import Button from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { useCountdown } from "@/hooks/useCountdown";
import PasswordInput from "@/components/ui/PasswordInput";
import { useRouter } from "next/navigation";

export default function ForgotPasswordPage() {
  const router = useRouter();

  const [stage, setStage] = useState<1 | 2>(1);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { secondsLeft, isActive, start } = useCountdown(60, "forgot-password-resend");

  const sendCode = async (event?: React.FormEvent) => {
    event?.preventDefault();
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
    // Fire-and-forget: show the same generic message regardless of result
    await supabase.auth.resetPasswordForEmail(nextEmail, { redirectTo });

    start();
    setSuccess("Enter the reset code sent to your email");
    setStage(2);
    setLoading(false);
  };

  const handleVerifyAndReset = async (event: React.FormEvent) => {
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

    const trimmedCode = code.trim();
    if (trimmedCode.length === 0) {
      setError("Please enter the reset code");
      setLoading(false);
      return;
    }

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters");
      setLoading(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    // Verify OTP (recovery)
    const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({ email, token: trimmedCode, type: "recovery" } as any);
    if (verifyError || !verifyData) {
      setError("Invalid or expired code");
      setLoading(false);
      return;
    }

    // If verify created a session, update the user's password
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword } as any);
    if (updateError) {
      setError(updateError.message || "Failed to update password");
      setLoading(false);
      return;
    }

    // Clear recovery session and sign out
    await supabase.auth.signOut();

    setSuccess("Password updated successfully");
    setLoading(false);

    // Redirect to login after short delay
    setTimeout(() => router.push("/login"), 1500);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[color:var(--background)] px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[color:var(--primary)]">StockTrack</p>
          <h1 className="mt-2 text-3xl font-semibold text-[color:var(--ink)]">Reset your password</h1>
          <p className="mt-2 text-sm text-[color:var(--muted)]">Enter the email linked to your account and we’ll send a 6-digit recovery code.</p>
        </div>

        <div className="rounded-[1.5rem] border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-[0_18px_48px_-24px_rgba(43,36,32,0.45)]">
          {stage === 1 ? (
            <form onSubmit={sendCode} className="space-y-4">
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
                {loading ? "Sending..." : "Send reset code"}
              </Button>

              <div className="mt-4 flex items-center justify-between text-sm text-[color:var(--muted)]">
                <Link href="/login" className="inline-flex items-center gap-1 font-semibold text-[color:var(--ink)]">
                  <ArrowLeft className="h-4 w-4" /> Back to login
                </Link>
              </div>
            </form>
          ) : (
            <form onSubmit={handleVerifyAndReset} className="space-y-4">
              <p className="text-sm text-[color:var(--muted)]">Enter the reset code sent to {email}</p>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="otp">Reset code</label>
                <input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={32}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 32))}
                  className="w-full rounded-lg border border-slate-300 bg-white py-2 px-3 text-sm outline-none focus:border-slate-900"
                  placeholder="Enter reset code"
                />
              </div>

              <PasswordInput id="new-password" label="New password" value={newPassword} onChange={setNewPassword} placeholder="New password" minLength={8} autoComplete="new-password" />
              <PasswordInput id="confirm-password" label="Confirm password" value={confirmPassword} onChange={setConfirmPassword} placeholder="Confirm password" minLength={8} autoComplete="new-password" />

              {error ? <p className="text-sm text-red-600">{error}</p> : null}
              {success ? <p className="text-sm text-emerald-600">{success}</p> : null}

              <Button type="submit" className="w-full" disabled={loading}>{loading ? "Resetting..." : "Reset Password"}</Button>

              <div className="mt-4 flex items-center justify-between text-sm text-[color:var(--muted)]">
                <button type="button" className="text-[color:var(--ink)] font-semibold" onClick={() => { setStage(1); setCode(""); setNewPassword(""); setConfirmPassword(""); setSuccess(null); setError(null); }}>
                  <ArrowLeft className="h-4 w-4 inline-block mr-1" /> Back (change email)
                </button>

                <div>
                  {isActive ? (
                    <span>Resend available in {secondsLeft}s</span>
                  ) : (
                    <button type="button" className="font-semibold text-[color:var(--ink)]" onClick={() => sendCode()}>
                      Resend code
                    </button>
                  )}
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
