"use client";

import { createClient } from "@/lib/supabase/client";
import { useBusiness } from "@/components/providers/business-provider";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function DashboardShell() {
  const router = useRouter();
  const { activeBusinessId, activeBusinessRole, businesses, loading, setActiveBusiness, refreshBusinesses } = useBusiness();
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!loading && businesses.length === 0) {
      router.replace("/onboarding");
    }
  }, [businesses.length, loading, router]);

  const handleGenerateInvite = async () => {
    if (!activeBusinessId) {
      return;
    }

    setInviteLoading(true);
    setInviteError(null);
    const supabase = createClient();
    if (!supabase) {
      setInviteError("Supabase is not configured yet.");
      setInviteLoading(false);
      return;
    }

    const { data, error } = await supabase.rpc("generate_invite_code", { business_id_input: activeBusinessId });
    if (error) {
      setInviteError(error.message);
      setInviteLoading(false);
      return;
    }

    setInviteCode(data as string);
    setInviteLoading(false);
    void refreshBusinesses();
  };

  const handleCopy = async () => {
    if (!inviteCode) {
      return;
    }

    await navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (loading) {
    return <p className="text-sm text-slate-600">Loading your workspace...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">StockTrack</p>
          <h1 className="text-2xl font-semibold text-slate-900">Distribution dashboard</h1>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={activeBusinessId ?? ""}
            onChange={(event) => setActiveBusiness(event.target.value || null)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
          >
            {businesses.map((business) => (
              <option key={business.id} value={business.id}>
                {business.name}
              </option>
            ))}
          </select>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">
            {activeBusinessRole ?? "member"}
          </span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Overview</p>
          <h2 className="mt-2 text-xl font-semibold text-slate-900">Track stock, customers, and payments in one place.</h2>
          <p className="mt-3 text-sm text-slate-600">
            This workspace is ready for your team to manage customer orders, inventory movement, and payment follow-up.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Settings</p>
          {activeBusinessRole === "owner" ? (
            <div className="mt-4 space-y-3">
              <button
                onClick={handleGenerateInvite}
                disabled={inviteLoading}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {inviteLoading ? "Generating..." : "Generate Invite Code"}
              </button>
              {inviteError ? <p className="text-sm text-red-600">{inviteError}</p> : null}
              {inviteCode ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-lg font-semibold text-slate-900">{inviteCode}</span>
                    <button
                      onClick={handleCopy}
                      className="rounded-md border border-slate-300 px-3 py-1 text-sm text-slate-700 hover:bg-white"
                    >
                      {copied ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">Expires in 7 days.</p>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-600">Only business owners can generate invite codes.</p>
          )}
        </div>
      </div>
    </div>
  );
}
