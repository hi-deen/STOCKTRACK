"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import PasswordInput from "@/components/ui/PasswordInput";
import Button from "@/components/ui/Button";
import { useCountdown } from "@/hooks/useCountdown";

type AuthFormProps = {
  mode: "login" | "signup";
};

function mapAuthError(code: string | undefined, fallbackMessage: string) {
  switch (code) {
    case "invalid_credentials":
      return "We couldn’t sign you in with those details. Please check your email and password.";
    case "email_not_confirmed":
      return "Your email still needs confirmation. Please check your inbox or resend the confirmation email below.";
    case "user_already_exists":
      return "An account with this email already exists. Try signing in instead or reset your password if needed.";
    case "otp_expired":
      return "That confirmation link has expired. Please request a fresh one.";
    default:
      return fallbackMessage;
  }
}

export default function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const { secondsLeft, isActive, start } = useCountdown(60, `auth-resend-${mode}`);

  useEffect(() => {
    const queryMessage = searchParams.get("message");
    if (queryMessage) {
      setMessage(decodeURIComponent(queryMessage));
    }
  }, [searchParams]);

  const redirectTo = searchParams.get("redirectedFrom") ?? (mode === "login" ? "/dashboard/operations" : "/onboarding");
  const confirmationRedirect = typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : undefined;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    setNeedsConfirmation(false);

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

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email: nextEmail, password });
      if (error) {
        setError(mapAuthError(error.code, error.message));
        setLoading(false);
        return;
      }

      router.push(redirectTo);
      router.refresh();
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email: nextEmail,
      password,
      options: {
        emailRedirectTo: confirmationRedirect,
      },
    });

    if (error) {
      setError(mapAuthError(error.code, error.message));
      setLoading(false);
      return;
    }

    if (data.session) {
      router.push(redirectTo);
      router.refresh();
      return;
    }

    setNeedsConfirmation(true);
    setMessage("Account created. Please check your inbox to confirm your email before signing in.");
    setLoading(false);
  };

  const handleResendConfirmation = async () => {
    const supabase = createClient();
    if (!supabase) {
      setError("Supabase is not configured yet.");
      return;
    }

    const nextEmail = email.trim();
    if (!nextEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
      setError("Enter a valid email address before requesting another confirmation email.");
      return;
    }

    setResendLoading(true);
    setError(null);
    setMessage(null);

    const { error } = await supabase.auth.resend({
      type: "signup",
      email: nextEmail,
      options: {
        emailRedirectTo: confirmationRedirect,
      },
    });

    if (error) {
      setError(mapAuthError(error.code, error.message));
      setResendLoading(false);
      return;
    }

    start();
    setMessage("A new confirmation email has been sent.");
    setResendLoading(false);
  };

  return (
    <div className="space-y-4 rounded-[1.5rem] border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-[0_18px_48px_-24px_rgba(43,36,32,0.45)]">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-0 focus:border-slate-900"
            placeholder="you@example.com"
            autoComplete="email"
          />
        </div>

        <PasswordInput
          id="password"
          label="Password"
          value={password}
          onChange={setPassword}
          placeholder={mode === "login" ? "Enter your password" : "Create a strong password"}
          minLength={8}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
        />

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {message ? <p className="text-sm text-emerald-600">{message}</p> : null}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Working..." : mode === "login" ? "Sign in" : "Create account"}
        </Button>
      </form>

      {mode === "signup" && needsConfirmation ? (
        <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--cream)] p-3 text-sm text-[color:var(--ink)]">
          <p className="font-medium">Need the confirmation email again?</p>
          <p className="mt-1 text-[color:var(--muted)]">We can resend it to the same address.</p>
          <Button variant="outline" className="mt-3 w-full" onClick={handleResendConfirmation} disabled={resendLoading || isActive}>
            {resendLoading ? "Sending..." : isActive ? `Resend in ${secondsLeft}s` : "Resend confirmation email"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
