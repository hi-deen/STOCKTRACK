"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { MoreVertical, Route } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRiderAuth } from "@/lib/rider/RiderAuthContext";

type RiderHomeRow = {
  link_id: string;
  business_id: string;
  business_name: string;
  status: string;
  requested_via: string;
  assigned_shop_count: number;
};

export default function RiderHomePage() {
  const router = useRouter();
  const { rider, loading: authLoading, logout } = useRiderAuth();
  const [rows, setRows] = useState<RiderHomeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    if (!authLoading && !rider) {
      router.replace("/rider/login");
    }
  }, [authLoading, rider, router]);

  useEffect(() => {
    if (!supabase || !rider) {
      return;
    }

    const token = window.localStorage.getItem("rider_session_token");
    if (!token) {
      router.replace("/rider/login");
      return;
    }

    const loadHomeData = async () => {
      setLoading(true);
      setError(null);
      const { data, error: homeError } = await supabase.rpc("get_rider_home_data", { token_input: token });
      if (homeError) {
        setError(homeError.message);
        setLoading(false);
        return;
      }
      setRows((data ?? []) as RiderHomeRow[]);
      setLoading(false);
    };

    void loadHomeData();
  }, [router, rider, supabase]);

  const pendingRequests = rows.filter((row) => row.status === "pending");
  const activeBusinesses = rows.filter((row) => row.status === "active");

  const handleResponse = async (linkId: string, status: "active" | "declined") => {
    const token = window.localStorage.getItem("rider_session_token");
    if (!supabase || !token) {
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    const { error: updateError } = await supabase.rpc("update_rider_link_status", {
      token_input: token,
      link_id_input: linkId,
      status_input: status,
    });

    if (updateError) {
      setError(updateError.message);
      setSubmitting(false);
      return;
    }

    setSuccessMessage(status === "active" ? "Request accepted." : "Request declined.");
    const { data } = await supabase.rpc("get_rider_home_data", { token_input: token });
    setRows((data ?? []) as RiderHomeRow[]);
    setSubmitting(false);
  };

  const handleRedeemCode = async () => {
    const token = window.localStorage.getItem("rider_session_token");
    if (!supabase || !token || !inviteCode.trim()) {
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    const { error: codeError } = await supabase.rpc("redeem_rider_invite_code", {
      token_input: token,
      code_input: inviteCode.trim(),
    });

    if (codeError) {
      setError(codeError.message);
      setSubmitting(false);
      return;
    }

    setInviteCode("");
    setSuccessMessage("Invite code accepted.");
    const { data } = await supabase.rpc("get_rider_home_data", { token_input: token });
    setRows((data ?? []) as RiderHomeRow[]);
    setSubmitting(false);
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[color:var(--background)] px-4">
        <p className="text-sm text-[color:var(--muted)]">Loading your route…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[color:var(--background)] px-4 py-6">
      <div className="mx-auto max-w-2xl space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[color:var(--primary)]">Dispatch</p>
            <h1 className="mt-1 text-2xl font-semibold text-[color:var(--ink)]">{rider?.full_name ?? "Rider"}</h1>
          </div>
          <div className="relative">
            <button type="button" onClick={() => setMenuOpen((current) => !current)} className="rounded-xl border border-[color:var(--border)] bg-white p-2">
              <MoreVertical className="h-5 w-5 text-[color:var(--muted)]" />
            </button>
            {menuOpen ? (
              <div className="absolute right-0 mt-2 w-48 rounded-xl border border-[color:var(--border)] bg-white p-2 shadow-lg">
                <button type="button" className="block w-full rounded-lg px-3 py-2 text-left text-sm text-[color:var(--ink)] hover:bg-[color:var(--cream)]">Profile / Edit Photo</button>
                <button type="button" onClick={() => { void logout(); router.push("/rider/login"); }} className="mt-1 block w-full rounded-lg px-3 py-2 text-left text-sm text-[color:var(--ink)] hover:bg-[color:var(--cream)]">Log out</button>
              </div>
            ) : null}
          </div>
        </div>

        {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
        {successMessage ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{successMessage}</div> : null}

        <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
          <h2 className="text-base font-semibold text-[color:var(--ink)]">Pending Requests</h2>
          {pendingRequests.length === 0 ? (
            <p className="mt-2 text-sm text-[color:var(--muted)]">No new requests right now.</p>
          ) : (
            <div className="mt-3 space-y-3">
              {pendingRequests.map((request) => (
                <div key={request.link_id} className="flex items-center justify-between rounded-xl border border-[color:var(--border)] bg-white p-3">
                  <div>
                    <p className="font-medium text-[color:var(--ink)]">{request.business_name}</p>
                    <p className="text-xs text-[color:var(--muted)]">{request.requested_via === "owner_invite" ? "Invitation" : "Request"}</p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" disabled={submitting} onClick={() => void handleResponse(request.link_id, "active")} className="rounded-lg bg-[color:var(--primary)] px-3 py-2 text-sm font-semibold text-white">Accept</button>
                    <button type="button" disabled={submitting} onClick={() => void handleResponse(request.link_id, "declined")} className="rounded-lg border border-[color:var(--border)] px-3 py-2 text-sm font-semibold text-[color:var(--ink)]">Decline</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
          <h2 className="text-base font-semibold text-[color:var(--ink)]">Enter Invite Code</h2>
          <div className="mt-3 flex gap-2">
            <input value={inviteCode} onChange={(event) => setInviteCode(event.target.value.toUpperCase())} className="w-full rounded-xl border border-[color:var(--border)] px-3 py-3 text-base" placeholder="AB12CD34" />
            <button type="button" disabled={submitting || !inviteCode.trim()} onClick={() => void handleRedeemCode()} className="rounded-xl bg-[color:var(--primary)] px-4 py-3 text-sm font-semibold text-white disabled:bg-slate-300">Use code</button>
          </div>
        </section>

        <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-[color:var(--ink)]">My Businesses</h2>
          </div>
          {activeBusinesses.length === 0 ? (
            <p className="mt-2 text-sm text-[color:var(--muted)]">No active businesses yet.</p>
          ) : (
            <div className="mt-3 grid gap-3">
              {activeBusinesses.map((business) => (
                <div key={business.business_id} className="rounded-xl border border-[color:var(--border)] bg-white p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-[color:var(--ink)]">{business.business_name}</p>
                      <p className="text-sm text-[color:var(--muted)]">{business.assigned_shop_count} assigned shop{business.assigned_shop_count === 1 ? "" : "s"}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <button type="button" onClick={() => router.push("/rider/route")} disabled={activeBusinesses.length === 0} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[color:var(--ink)] px-5 py-4 text-base font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300">
          <Route className="h-5 w-5" />
          Start Today&apos;s Route
        </button>

        <div className="text-center">
          <Link href="/rider/login" className="text-sm font-semibold text-[color:var(--ink)]">Back to login</Link>
        </div>
      </div>
    </div>
  );
}