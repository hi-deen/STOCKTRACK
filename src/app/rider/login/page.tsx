"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import PasswordInput from "@/components/ui/PasswordInput";
import { useRiderAuth } from "@/lib/rider/RiderAuthContext";

export default function RiderLoginPage() {
  const router = useRouter();
  const { login, error: authError, loading } = useRiderAuth();
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [deleted] = useState(
    () => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("deleted") === "1",
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!phone.trim() || !pin) {
      setFormError("Please enter both phone number and PIN.");
      return;
    }

    setFormError(null);
    await login(phone.trim(), pin);
    if (!authError) {
      router.push("/rider/home");
      router.refresh();
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[color:var(--background)] px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[color:var(--primary)]">Dispatch</p>
          <h1 className="mt-2 text-3xl font-semibold text-[color:var(--ink)]">Rider login</h1>
          <p className="mt-2 text-sm text-[color:var(--muted)]">Use your phone number and PIN to access your route.</p>
        </div>
        {deleted ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
            Your rider account has been permanently deleted.
          </div>
        ) : null}
        <form onSubmit={handleSubmit} className="space-y-4 rounded-[1.5rem] border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-[0_18px_48px_-24px_rgba(43,36,32,0.45)]">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="phone">Phone number</label>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-3 text-base outline-none focus:border-slate-900"
              placeholder="08012345678"
            />
          </div>
          <div>
            <PasswordInput id="rider-pin" label="PIN" value={pin} onChange={setPin} placeholder="••••••" minLength={4} autoComplete="current-password" />
          </div>
          {(formError || authError) ? <p className="text-sm text-red-600">{formError ?? authError}</p> : null}
          <button type="submit" disabled={loading} className="w-full rounded-xl bg-[color:var(--primary)] px-4 py-3 text-base font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300">
            {loading ? "Logging in..." : "Log in"}
          </button>
        </form>
        <p className="text-center text-sm text-[color:var(--muted)]">
          New rider? <Link href="/rider/signup" className="font-semibold text-[color:var(--ink)]">Create account</Link>
        </p>
      </div>
    </div>
  );
}