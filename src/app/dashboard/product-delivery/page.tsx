"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, PackageCheck, Plus } from "lucide-react";
import { useBusiness } from "@/components/providers/business-provider";
import DeliveryModal from "@/components/phase3/delivery-modal";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Skeleton from "@/components/ui/Skeleton";
import { createClient } from "@/lib/supabase/client";
import type { Product, Shop, StockDelivery } from "@/types/phase2";

function formatCurrency(value: number) {
  return `₦${value.toLocaleString("en-NG", { maximumFractionDigits: 2 })}`;
}

export default function StockPage() {
  const { activeBusinessId, loading: businessLoading } = useBusiness();
  const [deliveries, setDeliveries] = useState<StockDelivery[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [shopFilter, setShopFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const loadData = async () => {
    const supabase = createClient();
    if (!supabase || !activeBusinessId) {
      setDeliveries([]);
      setShops([]);
      setProducts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const [deliveriesRes, shopsRes, productsRes] = await Promise.all([
      supabase.from("stock_deliveries").select("*").eq("business_id", activeBusinessId).order("delivery_date", { ascending: false }).order("created_at", { ascending: false }).limit(50),
      supabase.from("shops").select("*").eq("business_id", activeBusinessId).order("name"),
      supabase.from("products").select("*").eq("business_id", activeBusinessId).order("name"),
    ]);

    if (deliveriesRes.error) {
      setError(deliveriesRes.error.message);
      setLoading(false);
      return;
    }

    const normalizedDeliveries = (deliveriesRes.data ?? []) as StockDelivery[];
    const shopMap = new Map((shopsRes.data ?? []).map((shop) => [shop.id, shop.name]));
    const productMap = new Map((productsRes.data ?? []).map((product) => [product.id, product.name]));
    const unitMap = new Map((productsRes.data ?? []).map((product) => [product.id, product.unit]));

    setDeliveries(normalizedDeliveries.map((delivery) => ({
      ...delivery,
      shop_name: shopMap.get(delivery.shop_id),
      product_name: productMap.get(delivery.product_id),
      product_unit: unitMap.get(delivery.product_id),
    })));
    setShops((shopsRes.data ?? []) as Shop[]);
    setProducts((productsRes.data ?? []) as Product[]);
    setLoading(false);
  };

  useEffect(() => {
    void loadData();
  }, [activeBusinessId]);

  const filteredDeliveries = useMemo(() => deliveries.filter((delivery) => {
    const matchesShop = shopFilter === "all" || delivery.shop_id === shopFilter;
    const matchesStart = !startDate || delivery.delivery_date >= startDate;
    const matchesEnd = !endDate || delivery.delivery_date <= endDate;
    return matchesShop && matchesStart && matchesEnd;
  }), [deliveries, shopFilter, startDate, endDate]);

  const handleCreate = async (payload: { shop_id: string; product_id: string; quantity: number; unit_price: number; delivery_date: string; notes: string }) => {
    const supabase = createClient();
    if (!supabase || !activeBusinessId) {
      setError("Select a business first.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    const { error } = await supabase.from("stock_deliveries").insert({
      business_id: activeBusinessId,
      shop_id: payload.shop_id,
      product_id: payload.product_id,
      quantity: payload.quantity,
      unit_price: payload.unit_price,
      total_amount: payload.quantity * payload.unit_price,
      delivery_date: payload.delivery_date,
      notes: payload.notes || null,
      created_by: (await supabase.auth.getUser()).data.user?.id ?? null,
    });

    if (error) {
      setError(error.message);
      setSubmitting(false);
      return;
    }

    setSuccess("Delivery recorded.");
    setSubmitting(false);
    setModalOpen(false);
    await loadData();
  };

  if (businessLoading) {
    return <div className="space-y-4"><Skeleton className="h-24" /><Skeleton className="h-40" /></div>;
  }

  return (
    <div className="space-y-6">
      <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[color:var(--primary)]">Product Delivery</p>
          <h1 className="mt-1 font-[family-name:var(--font-heading)] text-2xl font-semibold text-[color:var(--ink)]">Record deliveries and review delivery history</h1>
        </div>
        <Button onClick={() => setModalOpen(true)} icon={Plus}>Record Delivery</Button>
      </Card>

      {error ? <div className="rounded-[1.35rem] border border-[color:var(--danger-soft)] bg-[color:var(--danger-soft)]/70 p-3 text-sm text-[color:var(--danger)]">{error}</div> : null}
      {success ? <div className="rounded-[1.35rem] border border-[color:var(--success-soft)] bg-[color:var(--success-soft)]/70 p-3 text-sm text-[color:var(--success)]">{success}</div> : null}

      <Card padded={false} className="p-4">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-[color:var(--ink)]">Shop</label>
            <select value={shopFilter} onChange={(event) => setShopFilter(event.target.value)} className="w-full rounded-[0.9rem] border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--ink)]">
              <option value="all">All shops</option>
              {shops.map((shop) => (
                <option key={shop.id} value={shop.id}>{shop.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[color:var(--ink)]">Start date</label>
            <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="w-full rounded-[0.9rem] border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--ink)]" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[color:var(--ink)]">End date</label>
            <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="w-full rounded-[0.9rem] border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--ink)]" />
          </div>
        </div>
      </Card>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (<Skeleton key={index} className="h-32" />))}
        </div>
      ) : filteredDeliveries.length === 0 ? (
        <EmptyState icon={PackageCheck} title="No deliveries yet" description="Record the first stock delivery to start keeping balances and restocks in sync." actionLabel="Record delivery" onAction={() => setModalOpen(true)} />
      ) : (
        <>
          <div className="hidden md:block">
            <Card padded={false} className="overflow-hidden">
              <table className="min-w-full divide-y divide-[color:var(--border)] text-sm">
                <thead className="bg-[color:var(--cream)]/70">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-[color:var(--ink)]">Shop</th>
                    <th className="px-4 py-3 text-left font-semibold text-[color:var(--ink)]">Product</th>
                    <th className="px-4 py-3 text-left font-semibold text-[color:var(--ink)]">Qty</th>
                    <th className="px-4 py-3 text-left font-semibold text-[color:var(--ink)]">Total</th>
                    <th className="px-4 py-3 text-left font-semibold text-[color:var(--ink)]">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--border)] bg-[color:var(--surface)]">
                  {filteredDeliveries.map((delivery) => (
                    <tr key={delivery.id}>
                      <td className="px-4 py-3 font-semibold text-[color:var(--ink)]">{delivery.shop_name ?? "Unknown"}</td>
                      <td className="px-4 py-3 text-[color:var(--muted)]">{delivery.product_name ?? "Unknown"}</td>
                      <td className="px-4 py-3 text-[color:var(--muted)]">{delivery.quantity} {delivery.product_unit ?? "unit"}</td>
                      <td className="px-4 py-3 text-[color:var(--muted)]">{formatCurrency(delivery.total_amount)}</td>
                      <td className="px-4 py-3 text-[color:var(--muted)]">{delivery.delivery_date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>
          <div className="grid gap-4 md:hidden">
            {filteredDeliveries.map((delivery) => (
              <Card key={delivery.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-[color:var(--ink)]">{delivery.shop_name ?? "Unknown"}</p>
                    <p className="mt-1 text-sm text-[color:var(--muted)]">{delivery.product_name ?? "Unknown"}</p>
                  </div>
                  <Badge variant="info">Delivery</Badge>
                </div>
                <div className="mt-4 grid gap-2 text-sm text-[color:var(--muted)]">
                  <p>{delivery.quantity} {delivery.product_unit ?? "unit"}</p>
                  <p>{formatCurrency(delivery.total_amount)}</p>
                  <p className="inline-flex items-center gap-2"><CalendarDays className="h-4 w-4" /> {delivery.delivery_date}</p>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      <DeliveryModal open={modalOpen} onClose={() => { setModalOpen(false); setError(null); setSuccess(null); }} onSubmit={handleCreate} submitting={submitting} error={error} success={success} shops={shops} products={products} />
    </div>
  );
}
