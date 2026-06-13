"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useBusiness } from "@/components/providers/business-provider";
import ShopFormModal from "@/components/phase2/shop-form-modal";
import { createClient } from "@/lib/supabase/client";
import type { Shop } from "@/types/phase2";

export default function ShopsPage() {
  const { activeBusinessId, loading: businessLoading } = useBusiness();
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingShop, setEditingShop] = useState<Shop | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadShops = async () => {
    const supabase = createClient();
    if (!supabase || !activeBusinessId) {
      setShops([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from("shops")
      .select("*")
      .eq("business_id", activeBusinessId)
      .order("created_at", { ascending: false });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setShops((data ?? []) as Shop[]);
    setLoading(false);
  };

  useEffect(() => {
    void loadShops();
  }, [activeBusinessId]);

  const filteredShops = useMemo(() => {
    const normalizedQuery = query.toLowerCase();
    return shops.filter((shop) => {
      if (!shop.is_active) {
        return false;
      }
      return [shop.name, shop.area ?? ""].some((value) => value.toLowerCase().includes(normalizedQuery));
    });
  }, [query, shops]);

  const handleCreateOrUpdate = async (payload: { name: string; owner_name: string; phone: string; area: string; address: string; notes: string }) => {
    const supabase = createClient();
    if (!supabase || !activeBusinessId) {
      setError("Select a business first.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    if (editingShop) {
      const { error } = await supabase
        .from("shops")
        .update(payload)
        .eq("id", editingShop.id)
        .eq("business_id", activeBusinessId);

      if (error) {
        setError(error.message);
        setSubmitting(false);
        return;
      }
    } else {
      const { error } = await supabase.from("shops").insert({
        business_id: activeBusinessId,
        ...payload,
      });

      if (error) {
        setError(error.message);
        setSubmitting(false);
        return;
      }
    }

    setSuccess(editingShop ? "Shop updated." : "Shop created.");
    setSubmitting(false);
    setModalOpen(false);
    setEditingShop(null);
    await loadShops();
  };

  const toggleActive = async (shop: Shop) => {
    const supabase = createClient();
    if (!supabase || !activeBusinessId) {
      return;
    }

    const { error } = await supabase
      .from("shops")
      .update({ is_active: !shop.is_active })
      .eq("id", shop.id)
      .eq("business_id", activeBusinessId);

    if (!error) {
      await loadShops();
    }
  };

  if (businessLoading) {
    return <p className="text-sm text-slate-600">Loading business context…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Shops</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">Manage your retail partners</h1>
        </div>
        <button onClick={() => { setEditingShop(null); setModalOpen(true); }} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
          Add Shop
        </button>
      </div>

      {error ? <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      {success ? <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{success}</p> : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by shop name or area" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
      </div>

      {loading ? (
        <p className="text-sm text-slate-600">Loading shops…</p>
      ) : filteredShops.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">No shops yet</h2>
          <p className="mt-2 text-sm text-slate-600">Add your first shop to start building your distribution network.</p>
          <button onClick={() => setModalOpen(true)} className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
            Add your first shop
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredShops.map((shop) => (
            <div key={shop.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">{shop.name}</h2>
                  <p className="mt-1 text-sm text-slate-600">{shop.area || "Area not set"}</p>
                </div>
                <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">Active</span>
              </div>
              <div className="mt-4 space-y-2 text-sm text-slate-600">
                <p>Phone: {shop.phone || "—"}</p>
                <p>Owner: {shop.owner_name || "—"}</p>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href={`/dashboard/shops/${shop.id}`} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700">View</Link>
                <button onClick={() => { setEditingShop(shop); setModalOpen(true); }} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700">Edit</button>
                <button onClick={() => void toggleActive(shop)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700">Deactivate</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ShopFormModal
        open={modalOpen}
        mode={editingShop ? "edit" : "create"}
        shop={editingShop}
        onClose={() => { setModalOpen(false); setEditingShop(null); setError(null); setSuccess(null); }}
        onSubmit={handleCreateOrUpdate}
        submitting={submitting}
        error={error}
        success={success}
      />
    </div>
  );
}
