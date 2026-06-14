"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, BellRing, CheckCircle2, PencilLine, Plus, Wallet } from "lucide-react";
import { useBusiness } from "@/components/providers/business-provider";
import ShopFormModal from "@/components/phase2/shop-form-modal";
import DeliveryModal from "@/components/phase3/delivery-modal";
import PaymentModal from "@/components/phase3/payment-modal";
import ReminderModal from "@/components/phase4/reminder-modal";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Skeleton from "@/components/ui/Skeleton";
import { createClient } from "@/lib/supabase/client";
import type { Payment, Product, Shop, StockDelivery } from "@/types/phase2";
import type { Reminder } from "@/types/phase4";

function formatCurrency(value: number) {
  return `₦${value.toLocaleString("en-NG", { maximumFractionDigits: 2 })}`;
}

export default function ShopDetailPage() {
  const params = useParams<{ id: string }>();
  const { activeBusinessId, loading: businessLoading } = useBusiness();
  const [shop, setShop] = useState<Shop | null>(null);
  const [deliveries, setDeliveries] = useState<StockDelivery[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deliveryModalOpen, setDeliveryModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [reminderModalOpen, setReminderModalOpen] = useState(false);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [balance, setBalance] = useState(0);

  const loadShop = async () => {
    const supabase = createClient();
    if (!supabase || !activeBusinessId || !params.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const [shopRes, deliveriesRes, paymentsRes, remindersRes, shopsRes, productsRes] = await Promise.all([
      supabase.from("shops").select("*").eq("business_id", activeBusinessId).eq("id", params.id).maybeSingle(),
      supabase.from("stock_deliveries").select("*").eq("business_id", activeBusinessId).eq("shop_id", params.id).order("delivery_date", { ascending: false }).order("created_at", { ascending: false }),
      supabase.from("payments").select("*").eq("business_id", activeBusinessId).eq("shop_id", params.id).order("payment_date", { ascending: false }).order("created_at", { ascending: false }),
      supabase.from("reminders").select("*").eq("business_id", activeBusinessId).eq("shop_id", params.id).eq("status", "pending").order("due_date", { ascending: true }),
      supabase.from("shops").select("*").eq("business_id", activeBusinessId).order("name"),
      supabase.from("products").select("*").eq("business_id", activeBusinessId).order("name"),
    ]);

    if (shopRes.error) {
      setError(shopRes.error.message);
      setLoading(false);
      return;
    }

    const currentShop = (shopRes.data as Shop | null) ?? null;
    setShop(currentShop);
    setDeliveries((deliveriesRes.data ?? []) as StockDelivery[]);
    setPayments((paymentsRes.data ?? []) as Payment[]);
    setReminders((remindersRes.data ?? []) as Reminder[]);
    setShops((shopsRes.data ?? []) as Shop[]);
    setProducts((productsRes.data ?? []) as Product[]);

    if (currentShop) {
      const totalDelivered = (deliveriesRes.data ?? []).reduce((sum, item) => sum + Number(item.total_amount ?? 0), 0);
      const totalPaid = (paymentsRes.data ?? []).reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
      setBalance(totalDelivered - totalPaid);
    }

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
    const { error } = await supabase.from("shops").update(payload).eq("id", shop.id).eq("business_id", activeBusinessId);

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

  const handleCreateDelivery = async (payload: { shop_id: string; product_id: string; quantity: number; unit_price: number; delivery_date: string; notes: string }) => {
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
    setDeliveryModalOpen(false);
    await loadShop();
  };

  const handleCreatePayment = async (payload: { shop_id: string; amount: number; payment_date: string; method: string; notes: string }) => {
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
    setPaymentModalOpen(false);
    await loadShop();
  };

  const handleCreateReminder = async (payload: { shop_id: string; type: string; title: string; message: string; due_date: string }) => {
    const supabase = createClient();
    if (!supabase || !activeBusinessId) {
      setError("Select a business first.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    const { error } = await supabase.from("reminders").insert({
      business_id: activeBusinessId,
      shop_id: payload.shop_id,
      type: payload.type,
      title: payload.title,
      message: payload.message,
      due_date: payload.due_date,
      status: "pending",
      created_by: (await supabase.auth.getUser()).data.user?.id ?? null,
    });

    if (error) {
      setError(error.message);
      setSubmitting(false);
      return;
    }

    setSuccess("Reminder created.");
    setSubmitting(false);
    setReminderModalOpen(false);
    await loadShop();
  };

  const updateReminder = async (id: string, updates: Partial<Reminder>) => {
    const supabase = createClient();
    if (!supabase || !activeBusinessId) {
      setError("Select a business first.");
      return;
    }

    const { error } = await supabase.from("reminders").update(updates).eq("id", id).eq("business_id", activeBusinessId);
    if (error) {
      setError(error.message);
      return;
    }

    await loadShop();
  };

  const balanceCardClass = useMemo(() => (balance > 0 ? "border-[color:var(--danger-soft)] bg-[color:var(--danger-soft)]/50 text-[color:var(--danger)]" : "border-[color:var(--success-soft)] bg-[color:var(--success-soft)]/50 text-[color:var(--success)]"), [balance]);

  if (businessLoading || loading) {
    return <div className="space-y-6"><Skeleton className="h-24" /><Skeleton className="h-40" /><Skeleton className="h-64" /></div>;
  }

  if (!shop) {
    return <EmptyState icon={Wallet} title="Shop not found" description="This shop could not be loaded. Return to the shop list and try again." />;
  }

  return (
    <div className="space-y-6">
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[color:var(--primary)]">Shop Detail</p>
          <h1 className="mt-1 font-[family-name:var(--font-heading)] text-2xl font-semibold text-[color:var(--ink)]">{shop.name}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button href="/dashboard/shops" variant="outline" icon={ArrowLeft}>Back to shops</Button>
          <Button onClick={() => setModalOpen(true)} icon={PencilLine}>Edit</Button>
        </div>
      </Card>

      {error ? <div className="rounded-[1.35rem] border border-[color:var(--danger-soft)] bg-[color:var(--danger-soft)]/70 p-3 text-sm text-[color:var(--danger)]">{error}</div> : null}
      {success ? <div className="rounded-[1.35rem] border border-[color:var(--success-soft)] bg-[color:var(--success-soft)]/70 p-3 text-sm text-[color:var(--success)]">{success}</div> : null}

      <Card>
        <div className="grid gap-6 md:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-3 text-sm text-[color:var(--muted)]">
            <p><span className="font-semibold text-[color:var(--ink)]">Owner:</span> {shop.owner_name || "—"}</p>
            <p><span className="font-semibold text-[color:var(--ink)]">Phone:</span> {shop.phone || "—"}</p>
            <p><span className="font-semibold text-[color:var(--ink)]">Area:</span> {shop.area || "—"}</p>
            <p><span className="font-semibold text-[color:var(--ink)]">Address:</span> {shop.address || "—"}</p>
          </div>
          <div className="space-y-4">
            <div className={`rounded-[1.2rem] border p-4 ${balanceCardClass}`}>
              <p className="text-sm font-semibold uppercase tracking-[0.24em]">Outstanding balance</p>
              <p className="mt-2 text-3xl font-semibold">{formatCurrency(balance)}</p>
              <p className="mt-2 text-sm">{balance > 0 ? "This shop still owes you." : "No outstanding balance."}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setDeliveryModalOpen(true)} icon={Plus}>Record Delivery</Button>
              <Button variant="outline" onClick={() => setPaymentModalOpen(true)}>Record Payment</Button>
              <Button variant="outline" onClick={() => setReminderModalOpen(true)} icon={BellRing}>Add Reminder</Button>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-[color:var(--ink)]">Reminders</h2>
          <Button variant="outline" onClick={() => setReminderModalOpen(true)}>Add Reminder</Button>
        </div>
        {reminders.length === 0 ? (
          <div className="mt-4"><EmptyState icon={BellRing} title="No pending reminders" description="This shop is all caught up for now." /></div>
        ) : (
          <div className="mt-4 space-y-3">
            {reminders.map((reminder) => (
              <div key={reminder.id} className="rounded-[1.1rem] border border-[color:var(--border)] bg-[color:var(--cream)]/40 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[color:var(--ink)]">{reminder.title}</p>
                    <p className="mt-1 text-sm text-[color:var(--muted)]">{reminder.message}</p>
                  </div>
                  <Badge variant={reminder.type === "payment" ? "warning" : "info"}>{reminder.type}</Badge>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => void updateReminder(reminder.id, { status: "done", completed_at: new Date().toISOString() })} icon={CheckCircle2}>Mark Done</Button>
                  <Button variant="ghost" onClick={() => void updateReminder(reminder.id, { status: "dismissed" })}>Dismiss</Button>
                  <Button variant="outline" onClick={() => void updateReminder(reminder.id, { due_date: new Date(new Date(reminder.due_date).getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10) })}>Snooze 3 days</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="text-lg font-semibold text-[color:var(--ink)]">Stock History</h2>
          {deliveries.length === 0 ? (
            <div className="mt-4"><EmptyState icon={Wallet} title="No deliveries yet" description="This shop has no stock history recorded yet." /></div>
          ) : (
            <div className="mt-4 overflow-hidden rounded-[1rem] border border-[color:var(--border)]">
              <table className="min-w-full divide-y divide-[color:var(--border)] text-sm">
                <thead className="bg-[color:var(--cream)]/70">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-[color:var(--ink)]">Product</th>
                    <th className="px-4 py-3 text-left font-semibold text-[color:var(--ink)]">Qty</th>
                    <th className="px-4 py-3 text-left font-semibold text-[color:var(--ink)]">Total</th>
                    <th className="px-4 py-3 text-left font-semibold text-[color:var(--ink)]">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--border)] bg-[color:var(--surface)]">
                  {deliveries.map((delivery) => (
                    <tr key={delivery.id}>
                      <td className="px-4 py-3 font-semibold text-[color:var(--ink)]">{delivery.product_id ? delivery.product_id : "Unknown"}</td>
                      <td className="px-4 py-3 text-[color:var(--muted)]">{delivery.quantity}</td>
                      <td className="px-4 py-3 text-[color:var(--muted)]">{formatCurrency(delivery.total_amount)}</td>
                      <td className="px-4 py-3 text-[color:var(--muted)]">{delivery.delivery_date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <Card>
          <h2 className="text-lg font-semibold text-[color:var(--ink)]">Payment History</h2>
          {payments.length === 0 ? (
            <div className="mt-4"><EmptyState icon={Wallet} title="No payments yet" description="This shop has no payment history uploaded yet." /></div>
          ) : (
            <div className="mt-4 overflow-hidden rounded-[1rem] border border-[color:var(--border)]">
              <table className="min-w-full divide-y divide-[color:var(--border)] text-sm">
                <thead className="bg-[color:var(--cream)]/70">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-[color:var(--ink)]">Amount</th>
                    <th className="px-4 py-3 text-left font-semibold text-[color:var(--ink)]">Method</th>
                    <th className="px-4 py-3 text-left font-semibold text-[color:var(--ink)]">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--border)] bg-[color:var(--surface)]">
                  {payments.map((payment) => (
                    <tr key={payment.id}>
                      <td className="px-4 py-3 font-semibold text-[color:var(--ink)]">{formatCurrency(payment.amount)}</td>
                      <td className="px-4 py-3 text-[color:var(--muted)]">{payment.method ?? "—"}</td>
                      <td className="px-4 py-3 text-[color:var(--muted)]">{payment.payment_date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <ShopFormModal open={modalOpen} mode="edit" shop={shop} onClose={() => { setModalOpen(false); setError(null); setSuccess(null); }} onSubmit={handleUpdate} submitting={submitting} error={error} success={success} />
      <DeliveryModal open={deliveryModalOpen} onClose={() => { setDeliveryModalOpen(false); setError(null); setSuccess(null); }} onSubmit={handleCreateDelivery} submitting={submitting} error={error} success={success} shops={shops} products={products} defaultShopId={shop.id} />
      <PaymentModal open={paymentModalOpen} onClose={() => { setPaymentModalOpen(false); setError(null); setSuccess(null); }} onSubmit={handleCreatePayment} submitting={submitting} error={error} success={success} shops={shops} defaultShopId={shop.id} />
      <ReminderModal open={reminderModalOpen} onClose={() => { setReminderModalOpen(false); setError(null); setSuccess(null); }} onSubmit={handleCreateReminder} submitting={submitting} error={error} success={success} shops={shops} defaultShopId={shop.id} />
    </div>
  );
}
