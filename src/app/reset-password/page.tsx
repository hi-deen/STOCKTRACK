"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import PasswordInput from "@/components/ui/PasswordInput";
import Button from "@/components/ui/Button";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"checking" | "ready" | "invalid">("checking");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      const supabase = createClient();
      if (!supabase) {
        setStatus("invalid");
        return;
      }

      const { data } = await supabase.auth.getSession();
      setStatus(data.session ? "ready" : "invalid");
    };

    void checkSession();
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    const supabase = createClient();
    if (!supabase) {
      setError("Supabase is not configured yet.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    await supabase.auth.signOut();
    router.push("/login?message=Password%20updated");
  };

  if (status === "checking") {
    return <div className="flex min-h-screen items-center justify-center bg-[color:var(--background)] px-4">Loading...</div>;
  }

  if (status === "invalid") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[color:var(--background)] px-4 py-12">
        <div className="w-full max-w-md rounded-[1.5rem] border border-[color:var(--border)] bg-[color:var(--surface)] p-6 text-center shadow-[0_18px_48px_-24px_rgba(43,36,32,0.45)]">
          <h1 className="text-2xl font-semibold text-[color:var(--ink)]">This link is invalid or has expired</h1>
          <p className="mt-2 text-sm text-[color:var(--muted)]">Please request a new recovery link to continue.</p>
          <Link href="/forgot-password" className="mt-4 inline-flex text-sm font-semibold text-[color:var(--primary)]">Request a new reset link</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[color:var(--background)] px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[color:var(--primary)]">StockTrack</p>
          <h1 className="mt-2 text-3xl font-semibold text-[color:var(--ink)]">Choose a new password</h1>
          <p className="mt-2 text-sm text-[color:var(--muted)]">Create a strong password for your account.</p>
        </div>

        <div className="rounded-[1.5rem] border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-[0_18px_48px_-24px_rgba(43,36,32,0.45)]">
          <form onSubmit={handleSubmit} className="space-y-4">
            <PasswordInput id="new-password" label="New password" value={password} onChange={setPassword} minLength={8} autoComplete="new-password" />
            <PasswordInput id="confirm-password" label="Confirm password" value={confirmPassword} onChange={setConfirmPassword} minLength={8} autoComplete="new-password" />
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Updating..." : "Update password"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
