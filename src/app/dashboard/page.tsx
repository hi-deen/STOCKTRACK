"use client";

import { useEffect, useMemo, useState } from "react";
import { BellRing, CircleDollarSign, Package, Store, Truck, Wallet } from "lucide-react";
import Link from "next/link";
import { useBusiness } from "@/components/providers/business-provider";
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
  amount: string;
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

  if (diffDays === -1) {
    return "yesterday";
  }

  if (diffDays > 0) {
    return `${diffDays}d`;
  }

  return `${Math.abs(diffDays)}d ago`;
}

function getGreeting() {
  const hour = new Date().getHours();

  if (hour < 12) {
    return "Good morning";
  }

  if (hour < 18) {
    return "Good afternoon";
  }

  return "Good evening";
}

export default function DashboardPage() {
  const { activeBusinessId, businesses, loading: businessLoading } = useBusiness();
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
          title: shopMap.get(delivery.shop_id) ?? "A shop",
          amount: formatCurrency(delivery.total_amount),
          date: delivery.delivery_date,
        })),
        ...payments.map((payment) => ({
          id: `payment-${payment.id}`,
          kind: "payment" as const,
          title: shopMap.get(payment.shop_id) ?? "A shop",
          amount: formatCurrency(payment.amount),
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
      { label: "Owed to You", value: formatCurrency(stats.total_outstanding), icon: Wallet, tone: "danger" as const },
      { label: "Delivered", value: formatCurrency(stats.total_stock_value_this_month), icon: Package, tone: "primary" as const },
      { label: "Collected", value: formatCurrency(stats.total_payments_this_month), icon: CircleDollarSign, tone: "secondary" as const },
      { label: "Shops", value: stats.active_shops_count.toString(), icon: Store, tone: "accent" as const },
    ];
  }, [stats]);

  const activeBusinessName = businesses.find((business) => business.id === activeBusinessId)?.name ?? "Your business";
  const visibleActivity = activity.slice(0, 5);
  const topDebtors = (stats?.top_5_debtor_shops ?? []).slice(0, 3);

  if (businessLoading || loading) {
    return (
      <div className="space-y-4">
        <div>
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-2 h-5 w-40" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-6">
      {error ? <div className="rounded-[1.1rem] border border-[color:var(--danger-soft)] bg-[color:var(--danger-soft)]/80 p-3 text-sm text-[color:var(--danger)]">{error}</div> : null}

      <div className="space-y-1">
        <p className="text-sm font-semibold text-[color:var(--primary)]">{getGreeting()}</p>
        <p className="text-xs text-[color:var(--muted)]">{activeBusinessName}</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {cards.map((card) => (
          <StatTile key={card.label} icon={card.icon} label={card.label} value={card.value} tone={card.tone} />
        ))}
      </div>

      <Link href="/dashboard/reminders" className={`flex items-center gap-2 rounded-[0.9rem] border px-3 py-2 text-sm ${reminderCount > 0 ? "border-[color:var(--warning-soft)] bg-[color:var(--warning-soft)]/50 text-[color:var(--warning)]" : "border-[color:var(--border)] bg-[color:var(--cream)]/50 text-[color:var(--muted)]"}`}>
        <BellRing className="h-4 w-4" />
        <span>{reminderCount} reminders due today</span>
      </Link>

      <Card>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-[color:var(--ink)]">Who Owes Most</h2>
          <Link href="/dashboard/shops" className="text-sm font-semibold text-[color:var(--primary)]">See all</Link>
        </div>
        {topDebtors.length ? (
          <div className="mt-3 space-y-2">
            {topDebtors.map((shop) => (
              <Link key={shop.shop_id} href={`/dashboard/shops/${shop.shop_id}`} className="flex items-center justify-between gap-3 rounded-[0.9rem] border border-[color:var(--border)] bg-[color:var(--cream)]/40 px-3 py-2.5">
                <span className="truncate text-sm font-medium text-[color:var(--ink)]">{shop.shop_name}</span>
                <span className="rounded-full bg-[color:var(--surface)] px-2 py-1 text-xs font-semibold text-[color:var(--ink)]">{formatCurrency(shop.balance)}</span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="mt-3">
            <EmptyState icon={Store} title="No debt yet" description="Shops with balances will appear here." />
          </div>
        )}
      </Card>

      <Card>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-[color:var(--ink)]">Recent Actions</h2>
          <Link href="/dashboard/reports" className="text-sm font-semibold text-[color:var(--primary)]">View all</Link>
        </div>
        <div className="mt-3 space-y-2">
          {visibleActivity.map((item) => (
            <div key={item.id} className="flex items-center gap-2 rounded-[0.9rem] border border-[color:var(--border)] bg-[color:var(--cream)]/40 px-3 py-2">
              {item.kind === "delivery" ? <Truck className="h-3.5 w-3.5 text-[color:var(--primary)]" /> : <Wallet className="h-3.5 w-3.5 text-[color:var(--secondary)]" />}
              <span className="truncate text-sm text-[color:var(--ink)]">{item.title}</span>
              <span className="ml-auto text-xs font-semibold text-[color:var(--ink)]">{item.amount}</span>
              <span className="text-xs text-[color:var(--muted)]">{formatRelativeDate(item.date)}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
