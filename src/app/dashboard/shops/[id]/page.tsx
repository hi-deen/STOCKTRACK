"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useBusiness } from "@/components/providers/business-provider";
import ShopFormModal from "@/components/phase2/shop-form-modal";
import { createClient } from "@/lib/supabase/client";
import type { Shop } from "@/types/phase2";

export default function ShopDetailPage() {
  const params = useParams<{ id: string }>();
  const { activeBusinessId, loading: businessLoading } = useBusiness();
  const [shop, setShop] = useState<Shop | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadShop = async () => {
    const supabase = createClient();
    if (!supabase || !activeBusinessId || !params.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from("shops")
      .select("*")
      .eq("business_id", activeBusinessId)
      .eq("id", params.id)
      .maybeSingle();

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setShop((data as Shop | null) ?? null);
    setLoading(false);
  };

  useEffect(() => {
    void loadShop();
  }, [activeBusinessId, params.id]);

  const handleUpdate = async (payload: { name: string; owner_name: string; phone: string; area: string; address: string; notes: string }) => {
    const supabase = createClient();
    if (!supabase || !activeBusinessId || !shop) {
      setError("Select a business first.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);
    const { error } = await supabase
      .from("shops")
      .update(payload)
      .eq("id", shop.id)
      .eq("business_id", activeBusinessId);

    if (error) {
      setError(error.message);
      setSubmitting(false);
      return;
    }

    setSuccess("Shop updated.");
    setSubmitting(false);
    setModalOpen(false);
    await loadShop();
  };

  if (businessLoading || loading) {
    return <p className="text-sm text-slate-600">Loading shop details…</p>;
  }

  if (!shop) {
    return <p className="text-sm text-slate-600">Shop not found.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Shop Detail</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">{shop.name}</h1>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/shops" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Back to shops</Link>
          <button onClick={() => setModalOpen(true)} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Edit</button>
        </div>
      </div>

      {error ? <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      {success ? <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{success}</p> : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-3 text-sm text-slate-700">
            <p><span className="font-semibold text-slate-900">Owner:</span> {shop.owner_name || "—"}</p>
            <p><span className="font-semibold text-slate-900">Phone:</span> {shop.phone || "—"}</p>
            <p><span className="font-semibold text-slate-900">Area:</span> {shop.area || "—"}</p>
            <p><span className="font-semibold text-slate-900">Address:</span> {shop.address || "—"}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <p className="font-semibold text-slate-900">Notes</p>
            <p className="mt-2">{shop.notes || "No notes yet."}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Stock History</h2>
          <p className="mt-3 text-sm text-slate-600">Coming in Phase 3.</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Payment History</h2>
          <p className="mt-3 text-sm text-slate-600">Coming in Phase 3.</p>
        </div>
      </div>

      <ShopFormModal
        open={modalOpen}
        mode="edit"
        shop={shop}
        onClose={() => { setModalOpen(false); setError(null); setSuccess(null); }}
        onSubmit={handleUpdate}
        submitting={submitting}
        error={error}
        success={success}
      />
    </div>
  );
}
