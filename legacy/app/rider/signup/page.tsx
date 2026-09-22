"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import PasswordInput from "@/components/ui/PasswordInput";
import { useRiderAuth } from "@/lib/rider/RiderAuthContext";

export default function RiderSignupPage() {
  const router = useRouter();
  const { signup, error: authError, loading } = useRiderAuth();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!fullName.trim() || !phone.trim() || !pin || !confirmPin) {
      setFormError("Please complete all fields.");
      return;
    }

    if (pin.length < 4 || pin.length > 6 || !/^\d+$/.test(pin)) {
      setFormError("PIN must be 4 to 6 digits.");
      return;
    }

    if (pin !== confirmPin) {
      setFormError("PINs do not match.");
      return;
    }

    setFormError(null);
    await signup(phone.trim(), pin, fullName.trim());
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
          <h1 className="mt-2 text-3xl font-semibold text-[color:var(--ink)]">Create rider account</h1>
          <p className="mt-2 text-sm text-[color:var(--muted)]">Register for the daily delivery route view.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 rounded-[1.5rem] border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-[0_18px_48px_-24px_rgba(43,36,32,0.45)]">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="full-name">Full name</label>
            <input
              id="full-name"
              type="text"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-3 text-base outline-none focus:border-slate-900"
              placeholder="Amina Yusuf"
            />
          </div>
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
            <input
              id="pin"
              type="number"
              inputMode="numeric"
              value={pin}
              onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))}
              className="w-full rounded-lg border border-slate-300 px-3 py-3 text-base outline-none focus:border-slate-900"
              placeholder="PIN"
            />
          </div>
          <div>
            <input
              id="confirm-pin"
              type="number"
              inputMode="numeric"
              value={confirmPin}
              onChange={(event) => setConfirmPin(event.target.value.replace(/\D/g, ""))}
              className="w-full rounded-lg border border-slate-300 px-3 py-3 text-base outline-none focus:border-slate-900"
              placeholder="Confirm PIN"
            />
          </div>
          {(formError || authError) ? <p className="text-sm text-red-600">{formError ?? authError}</p> : null}
          <button type="submit" disabled={loading} className="w-full rounded-xl bg-[color:var(--primary)] px-4 py-3 text-base font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300">
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>
        <p className="text-center text-sm text-[color:var(--muted)]">
          Already have an account? <Link href="/rider/login" className="font-semibold text-[color:var(--ink)]">Log in</Link>
        </p>
      </div>
    </div>
  );
}