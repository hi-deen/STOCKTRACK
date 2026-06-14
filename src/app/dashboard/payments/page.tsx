"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, CircleDollarSign, Plus } from "lucide-react";
import { useBusiness } from "@/components/providers/business-provider";
import PaymentModal from "@/components/phase3/payment-modal";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Skeleton from "@/components/ui/Skeleton";
import { createClient } from "@/lib/supabase/client";
import type { Payment, Shop } from "@/types/phase2";

function formatCurrency(value: number) {
  return `₦${value.toLocaleString("en-NG", { maximumFractionDigits: 2 })}`;
}

export default function PaymentsPage() {
  const { activeBusinessId, loading: businessLoading } = useBusiness();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
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
      setPayments([]);
      setShops([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const [paymentsRes, shopsRes] = await Promise.all([
      supabase.from("payments").select("*").eq("business_id", activeBusinessId).order("payment_date", { ascending: false }).order("created_at", { ascending: false }).limit(50),
      supabase.from("shops").select("*").eq("business_id", activeBusinessId).order("name"),
    ]);

    if (paymentsRes.error) {
      setError(paymentsRes.error.message);
      setLoading(false);
      return;
    }

    const shopMap = new Map((shopsRes.data ?? []).map((shop) => [shop.id, shop.name]));
    setPayments((paymentsRes.data ?? []).map((payment) => ({ ...payment, shop_name: shopMap.get(payment.shop_id) })) as Payment[]);
    setShops((shopsRes.data ?? []) as Shop[]);
    setLoading(false);
  };

  useEffect(() => {
    void loadData();
  }, [activeBusinessId]);

  const filteredPayments = useMemo(() => payments.filter((payment) => {
    const matchesShop = shopFilter === "all" || payment.shop_id === shopFilter;
    const matchesStart = !startDate || payment.payment_date >= startDate;
    const matchesEnd = !endDate || payment.payment_date <= endDate;
    return matchesShop && matchesStart && matchesEnd;
  }), [payments, shopFilter, startDate, endDate]);

  const handleCreate = async (payload: { shop_id: string; amount: number; payment_date: string; method: string; notes: string }) => {
    const supabase = createClient();
    if (!supabase || !activeBusinessId) {
      setError("Select a business first.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    const { error } = await supabase.from("payments").insert({
      business_id: activeBusinessId,
      shop_id: payload.shop_id,
      amount: payload.amount,
      payment_date: payload.payment_date,
      method: payload.method,
      notes: payload.notes || null,
      created_by: (await supabase.auth.getUser()).data.user?.id ?? null,
    });

    if (error) {
      setError(error.message);
      setSubmitting(false);
      return;
    }

    setSuccess("Payment recorded.");
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
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[color:var(--primary)]">Payments</p>
          <h1 className="mt-1 font-[family-name:var(--font-heading)] text-2xl font-semibold text-[color:var(--ink)]">Track receipts and payments from your shops</h1>
        </div>
        <Button onClick={() => setModalOpen(true)} icon={Plus}>Record Payment</Button>
      </Card>

      {error ? <div className="rounded-[1.35rem] border border-[color:var(--danger-soft)] bg-[color:var(--danger-soft)]/70 p-3 text-sm text-[color:var(--danger)]">{error}</div> : null}
      {success ? <div className="rounded-[1.35rem] border border-[color:var(--success-soft)] bg-[color:var(--success-soft)]/70 p-3 text-sm text-[color:var(--success)]">{success}</div> : null}

      <Card padded={false} className="p-4">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-[color:var(--ink)]">Shop</label>
            <select value={shopFilter} onChange={(event) => setShopFilter(event.target.value)} className="w-full rounded-[0.9rem] border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--ink)]">
              <option value="all">All shops</option>
              {shops.map((shop) => (<option key={shop.id} value={shop.id}>{shop.name}</option>))}
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
          {Array.from({ length: 6 }).map((_, index) => (<Skeleton key={index} className="h-28" />))}
        </div>
      ) : filteredPayments.length === 0 ? (
        <EmptyState icon={CircleDollarSign} title="No payments yet" description="Record the first payment to keep balances current and your shop follow-ups in sync." actionLabel="Record payment" onAction={() => setModalOpen(true)} />
      ) : (
        <>
          <div className="hidden md:block">
            <Card padded={false} className="overflow-hidden">
              <table className="min-w-full divide-y divide-[color:var(--border)] text-sm">
                <thead className="bg-[color:var(--cream)]/70">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-[color:var(--ink)]">Shop</th>
                    <th className="px-4 py-3 text-left font-semibold text-[color:var(--ink)]">Amount</th>
                    <th className="px-4 py-3 text-left font-semibold text-[color:var(--ink)]">Method</th>
                    <th className="px-4 py-3 text-left font-semibold text-[color:var(--ink)]">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--border)] bg-[color:var(--surface)]">
                  {filteredPayments.map((payment) => (
                    <tr key={payment.id}>
                      <td className="px-4 py-3 font-semibold text-[color:var(--ink)]">{payment.shop_name ?? "Unknown"}</td>
                      <td className="px-4 py-3 text-[color:var(--muted)]">{formatCurrency(payment.amount)}</td>
                      <td className="px-4 py-3 text-[color:var(--muted)]">{payment.method ?? "—"}</td>
                      <td className="px-4 py-3 text-[color:var(--muted)]">{payment.payment_date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>
          <div className="grid gap-4 md:hidden">
            {filteredPayments.map((payment) => (
              <Card key={payment.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-[color:var(--ink)]">{payment.shop_name ?? "Unknown"}</p>
                    <p className="mt-1 text-sm text-[color:var(--muted)]">{payment.method ?? "—"}</p>
                  </div>
                  <Badge variant="success">Received</Badge>
                </div>
                <div className="mt-4 grid gap-2 text-sm text-[color:var(--muted)]">
                  <p>{formatCurrency(payment.amount)}</p>
                  <p className="inline-flex items-center gap-2"><CalendarDays className="h-4 w-4" /> {payment.payment_date}</p>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      <PaymentModal open={modalOpen} onClose={() => { setModalOpen(false); setError(null); setSuccess(null); }} onSubmit={handleCreate} submitting={submitting} error={error} success={success} shops={shops} />
    </div>
  );
}
