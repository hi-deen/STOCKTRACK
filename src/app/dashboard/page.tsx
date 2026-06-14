"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, BellRing, CircleDollarSign, Package, ReceiptText, Store, TrendingUp, Wallet } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useBusiness } from "@/components/providers/business-provider";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Skeleton from "@/components/ui/Skeleton";
import StatTile from "@/components/ui/StatTile";
import { createClient } from "@/lib/supabase/client";
import type { DashboardStats, Payment, Product, Shop, StockDelivery } from "@/types/phase2";
import type { ReminderSuggestion } from "@/types/phase4";

export const dynamic = "force-dynamic";

type ActivityItem = {
  id: string;
  kind: "delivery" | "payment";
  title: string;
  subtitle: string;
  date: string;
};

function formatCurrency(value: number) {
  return `₦${value.toLocaleString("en-NG", { maximumFractionDigits: 2 })}`;
}

function formatRelativeDate(value: string) {
  const now = new Date();
  const target = new Date(value);
  const diffMs = target.getTime() - now.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return "today";
  }

  if (diffDays === 1 || diffDays === -1) {
    return diffDays > 0 ? "tomorrow" : "yesterday";
  }

  const absDays = Math.abs(diffDays);
  return `${absDays} day${absDays === 1 ? "" : "s"} ${diffDays > 0 ? "from now" : "ago"}`;
}

export default function DashboardPage() {
  const { activeBusinessId, loading: businessLoading } = useBusiness();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [deliveries, setDeliveries] = useState<StockDelivery[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [reminderCount, setReminderCount] = useState(0);
  const [suggestedPreview, setSuggestedPreview] = useState<ReminderSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadDashboard = async () => {
      const supabase = createClient();
      if (!supabase || !activeBusinessId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      const [statsRes, shopsRes, productsRes, deliveriesRes, paymentsRes, remindersRes, suggestionsRes] = await Promise.all([
        supabase.rpc("get_business_dashboard_stats", { business_id_input: activeBusinessId }),
        supabase.from("shops").select("*").eq("business_id", activeBusinessId).order("name"),
        supabase.from("products").select("*").eq("business_id", activeBusinessId).order("name"),
        supabase.from("stock_deliveries").select("*").eq("business_id", activeBusinessId).order("delivery_date", { ascending: false }).order("created_at", { ascending: false }).limit(20),
        supabase.from("payments").select("*").eq("business_id", activeBusinessId).order("payment_date", { ascending: false }).order("created_at", { ascending: false }).limit(10),
        supabase.from("reminders").select("id").eq("business_id", activeBusinessId).eq("status", "pending").lte("due_date", new Date().toISOString().slice(0, 10)),
        supabase.rpc("get_reminder_suggestions", { business_id_input: activeBusinessId }),
      ]);

      if (statsRes.error) {
        setError(statsRes.error.message);
        setLoading(false);
        return;
      }

      const shopMap = new Map((shopsRes.data ?? []).map((shop) => [shop.id, shop.name]));
      const productMap = new Map((productsRes.data ?? []).map((product) => [product.id, product.name]));

      const normalizedDeliveries = (deliveriesRes.data ?? []) as StockDelivery[];
      const payments = (paymentsRes.data ?? []) as Payment[];
      const activityItems = [
        ...normalizedDeliveries.map((delivery) => ({
          id: `delivery-${delivery.id}`,
          kind: "delivery" as const,
          title: `Delivered ${delivery.quantity} ${productMap.get(delivery.product_id) ?? "item"} to ${shopMap.get(delivery.shop_id) ?? "a shop"}`,
          subtitle: formatCurrency(delivery.total_amount),
          date: delivery.delivery_date,
        })),
        ...payments.map((payment) => ({
          id: `payment-${payment.id}`,
          kind: "payment" as const,
          title: `Received ${formatCurrency(payment.amount)} from ${shopMap.get(payment.shop_id) ?? "a shop"}`,
          subtitle: payment.method ?? "payment",
          date: payment.payment_date,
        })),
      ].sort((left, right) => (left.date < right.date ? 1 : -1)).slice(0, 10);

      setStats((statsRes.data as DashboardStats) ?? null);
      setDeliveries(normalizedDeliveries);
      setShops(shopsRes.data ?? []);
      setProducts(productsRes.data ?? []);
      setReminderCount((remindersRes.data ?? []).length);
      setSuggestedPreview((suggestionsRes.data ?? []).slice(0, 3) as ReminderSuggestion[]);
      setActivity(activityItems);
      setLoading(false);
    };

    void loadDashboard();
  }, [activeBusinessId]);

  const cards = useMemo(() => {
    if (!stats) {
      return [];
    }

    return [
      { label: "Total Outstanding", value: formatCurrency(stats.total_outstanding), hint: "Positive balances due from shops", icon: Wallet, tone: "danger" as const },
      { label: "Stock Value Distributed", value: formatCurrency(stats.total_stock_value_this_month), hint: "Based on this month’s deliveries", icon: Package, tone: "primary" as const },
      { label: "Payments Received", value: formatCurrency(stats.total_payments_this_month), hint: "Payments logged this month", icon: CircleDollarSign, tone: "secondary" as const },
      { label: "Active Shops", value: stats.active_shops_count.toString(), hint: "Currently active shops", icon: Store, tone: "accent" as const },
      { label: "Shops With Debt", value: stats.shops_with_outstanding_balance_count.toString(), hint: "Shops still carrying debt", icon: ReceiptText, tone: "danger" as const },
      { label: "Reminders Due", value: reminderCount.toString(), hint: "Overdue and due-today reminders", icon: BellRing, tone: "warning" as const },
    ];
  }, [stats, reminderCount]);

  const chartData = useMemo(() => {
    const recent = [...deliveries].sort((a, b) => a.delivery_date.localeCompare(b.delivery_date)).slice(-7);
    return recent.map((delivery) => ({
      label: delivery.delivery_date,
      value: delivery.total_amount,
    }));
  }, [deliveries]);

  if (businessLoading || loading) {
    return (
      <div className="space-y-6">
        <Card>
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-3 h-8 w-64" />
          <Skeleton className="mt-3 h-4 w-80" />
        </Card>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-28" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-[color:var(--border)] bg-[color:var(--surface)]">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[color:var(--primary)]">Overview</p>
        <h1 className="mt-2 font-[family-name:var(--font-heading)] text-2xl font-semibold text-[color:var(--ink)]">Business snapshot</h1>
        <p className="mt-3 max-w-2xl text-sm text-[color:var(--muted)]">Track balances, deliveries, payments, and the healthiest shops from a single warm, grounded dashboard.</p>
      </Card>

      {error ? <div className="rounded-[1.35rem] border border-[color:var(--danger-soft)] bg-[color:var(--danger-soft)]/70 p-3 text-sm text-[color:var(--danger)]">{error}</div> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <StatTile key={card.label} icon={card.icon} label={card.label} value={card.value} tone={card.tone} trend={<span>{card.hint}</span>} />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-[color:var(--ink)]">Delivery momentum</h2>
              <p className="mt-1 text-sm text-[color:var(--muted)]">A quick look at stock value delivered over the last week.</p>
            </div>
            <Badge variant="info">Last 7 days</Badge>
          </div>
          <div className="mt-5 h-64">
            {chartData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7dac8" />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#6e6258" }} />
                  <YAxis tick={{ fontSize: 12, fill: "#6e6258" }} />
                  <Tooltip formatter={(value) => formatCurrency(Number(value ?? 0))} />
                  <Bar dataKey="value" fill="#c2620a" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center rounded-[1.2rem] border border-dashed border-[color:var(--border)] bg-[color:var(--cream)]/50">
                <p className="text-sm text-[color:var(--muted)]">No delivery data yet.</p>
              </div>
            )}
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-[color:var(--ink)]">Suggested actions</h2>
              <Link href="/dashboard/reminders" className="text-sm font-semibold text-[color:var(--primary)]">
                See all
              </Link>
            </div>
            {suggestedPreview.length === 0 ? (
              <div className="mt-4">
                <EmptyState icon={BellRing} title="Nothing to follow up" description="Your reminders suggestions will appear here when it is time to nudge a shop." />
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {suggestedPreview.map((item) => (
                  <div key={`${item.shop_id}-${item.type}`} className="rounded-[1.1rem] border border-[color:var(--border)] bg-[color:var(--cream)]/50 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[color:var(--ink)]">{item.shop_name}</p>
                        <p className="mt-1 text-sm text-[color:var(--muted)]">{item.reason}</p>
                      </div>
                      <Badge variant={item.type === "payment" ? "warning" : "info"}>{item.type}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-[color:var(--ink)]">Recent activity</h2>
              <Link href="/dashboard/stock" className="text-sm font-semibold text-[color:var(--primary)]">
                View history
              </Link>
            </div>
            <div className="mt-4 space-y-3">
              {activity.map((item) => (
                <div key={item.id} className="rounded-[1.1rem] border border-[color:var(--border)] bg-[color:var(--cream)]/40 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-[color:var(--ink)]">{item.title}</p>
                    <Badge variant={item.kind === "payment" ? "success" : "info"}>{item.kind}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-[color:var(--muted)]">{item.subtitle}</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.24em] text-[color:var(--muted)]">{formatRelativeDate(item.date)}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-[color:var(--ink)]">Top debtors</h2>
              <p className="mt-1 text-sm text-[color:var(--muted)]">Shops that need the next follow-up.</p>
            </div>
            <Button href="/dashboard/shops" variant="outline" icon={ArrowRight} iconPosition="right">
              Manage shops
            </Button>
          </div>
          {stats?.top_5_debtor_shops?.length ? (
            <div className="mt-4 space-y-3">
              {stats.top_5_debtor_shops.map((shop) => (
                <div key={shop.shop_id} className="flex flex-wrap items-center justify-between gap-3 rounded-[1.1rem] border border-[color:var(--border)] bg-[color:var(--cream)]/40 p-3">
                  <div>
                    <p className="font-semibold text-[color:var(--ink)]">{shop.shop_name}</p>
                    <p className="mt-1 text-sm text-[color:var(--muted)]">{formatCurrency(shop.balance)} outstanding</p>
                  </div>
                  <Link href={`/dashboard/shops/${shop.shop_id}`} className="text-sm font-semibold text-[color:var(--primary)]">Open</Link>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4">
              <EmptyState icon={Store} title="No debtors yet" description="As balances build, the highest-need shops will appear here." />
            </div>
          )}
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-[color:var(--ink)]">Business pulse</h2>
          <div className="mt-4 space-y-3 rounded-[1.1rem] border border-[color:var(--border)] bg-[color:var(--cream)]/50 p-4 text-sm text-[color:var(--muted)]">
            <p>{shops.length} shops are active in this business.</p>
            <p>{products.length} products are ready for deliveries.</p>
            <p>{reminderCount} reminders are currently due or overdue.</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
