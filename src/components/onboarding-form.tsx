"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function OnboardingForm() {
  const router = useRouter();
  const [businessName, setBusinessName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [joinLoading, setJoinLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);

  const handleCreateBusiness = async (event: React.FormEvent) => {
    event.preventDefault();
    setCreateLoading(true);
    setCreateError(null);
    setCreateSuccess(null);
    const supabase = createClient();
    if (!supabase) {
      setCreateError("Supabase is not configured yet.");
      setCreateLoading(false);
      return;
    }

    const { data, error } = await supabase.rpc("create_business", { business_name: businessName });
    if (error) {
      setCreateError(error.message);
      setCreateLoading(false);
      return;
    }

    setCreateSuccess(`Business created successfully with ID ${data}`);
    setCreateLoading(false);
    router.push("/dashboard");
    router.refresh();
  };

  const handleJoinBusiness = async (event: React.FormEvent) => {
    event.preventDefault();
    setJoinLoading(true);
    setJoinError(null);
    const supabase = createClient();
    if (!supabase) {
      setJoinError("Supabase is not configured yet.");
      setJoinLoading(false);
      return;
    }

    const { error } = await supabase.rpc("redeem_invite_code", { code_input: inviteCode.trim().toUpperCase() });
    if (error) {
      setJoinError(error.message);
      setJoinLoading(false);
      return;
    }

    setJoinLoading(false);
    router.push("/dashboard");
    router.refresh();
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Create a Business</h2>
        <p className="mt-2 text-sm text-slate-600">Start a new workspace for your distribution business.</p>
        <form onSubmit={handleCreateBusiness} className="mt-5 space-y-4">
          <input
            value={businessName}
            onChange={(event) => setBusinessName(event.target.value)}
            required
            placeholder="Acme Distribution"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          />
          {createError ? <p className="text-sm text-red-600">{createError}</p> : null}
          {createSuccess ? <p className="text-sm text-emerald-600">{createSuccess}</p> : null}
          <button
            type="submit"
            disabled={createLoading}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {createLoading ? "Creating..." : "Create Business"}
          </button>
        </form>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Join a Business</h2>
        <p className="mt-2 text-sm text-slate-600">Use an invite code from an existing workspace.</p>
        <form onSubmit={handleJoinBusiness} className="mt-5 space-y-4">
          <input
            value={inviteCode}
            onChange={(event) => setInviteCode(event.target.value)}
            required
            maxLength={8}
            placeholder="ABC12345"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm uppercase outline-none focus:border-slate-900"
          />
          {joinError ? <p className="text-sm text-red-600">{joinError}</p> : null}
          <button
            type="submit"
            disabled={joinLoading}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {joinLoading ? "Joining..." : "Join Business"}
          </button>
        </form>
      </div>
    </div>
  );
}
