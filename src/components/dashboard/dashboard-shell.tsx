"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BarChart3, BellRing, Building2, LayoutDashboard, Package, Store, Truck, Wallet, Menu, X } from "lucide-react";
import { useBusiness } from "@/components/providers/business-provider";
import { createClient } from "@/lib/supabase/client";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/shops", label: "Shops", icon: Store },
  { href: "/dashboard/products", label: "Products", icon: Package },
  { href: "/dashboard/stock", label: "Stock", icon: Truck },
  { href: "/dashboard/payments", label: "Payments", icon: Wallet },
  { href: "/dashboard/reports", label: "Reports", icon: BarChart3 },
  { href: "/dashboard/reminders", label: "Reminders", icon: BellRing },
];

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [reminderCount, setReminderCount] = useState(0);
  const { activeBusinessId, businesses } = useBusiness();

  useEffect(() => {
    const loadReminderCount = async () => {
      const supabase = createClient();
      if (!supabase || !activeBusinessId) {
        setReminderCount(0);
        return;
      }

      const today = new Date().toISOString().slice(0, 10);
      const { data } = await supabase.from("reminders").select("id", { count: "exact" }).eq("business_id", activeBusinessId).eq("status", "pending").lte("due_date", today);
      setReminderCount(data?.length ?? 0);
    };

    void loadReminderCount();
  }, [activeBusinessId]);

  const activeBusinessName = activeBusinessId ? businesses.find((business) => business.id === activeBusinessId)?.name ?? "Selected business" : "No business selected";

  return (
    <div className="min-h-screen bg-[color:var(--background)]">
      <div className="mx-auto flex max-w-7xl flex-col lg:flex-row">
        <aside className="border-b border-[color:var(--border)] bg-[color:var(--surface)]/90 px-4 py-4 backdrop-blur lg:min-h-screen lg:w-72 lg:border-b-0 lg:border-r lg:px-6 lg:py-8">
          <div className="flex items-center justify-between lg:block">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[color:var(--primary)]">StockTrack</p>
              <h2 className="mt-1 font-[family-name:var(--font-heading)] text-xl font-semibold text-[color:var(--ink)]">Groundnut trade hub</h2>
            </div>
            <button
              className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-2 text-[color:var(--ink)] lg:hidden"
              onClick={() => setMobileOpen((value) => !value)}
              aria-label="Toggle navigation"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>

          <div className={`mt-4 space-y-2 ${mobileOpen ? "block" : "hidden lg:block"}`}>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center rounded-2xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                    isActive ? "bg-[color:var(--primary)] text-white shadow-sm" : "text-[color:var(--ink)] hover:bg-[color:var(--cream)]"
                  }`}
                  onClick={() => setMobileOpen(false)}
                >
                  <Icon className="mr-3 h-4 w-4" />
                  <span>{item.label}</span>
                  {item.href === "/dashboard/reminders" && reminderCount > 0 ? (
                    <span className={`ml-auto rounded-full px-2 py-0.5 text-xs font-semibold ${isActive ? "bg-white/20 text-white" : "bg-[color:var(--danger-soft)] text-[color:var(--danger)]"}`}>{reminderCount}</span>
                  ) : null}
                </Link>
              );
            })}
          </div>

          <div className="mt-6 rounded-[1.35rem] border border-[color:var(--border)] bg-[color:var(--cream)]/70 p-4 text-sm text-[color:var(--muted)]">
            <div className="flex items-center gap-2 text-[color:var(--ink)]">
              <Building2 className="h-4 w-4 text-[color:var(--primary)]" />
              <p className="font-semibold">Active business</p>
            </div>
            <p className="mt-2 font-medium text-[color:var(--ink)]">{activeBusinessName}</p>
          </div>
        </aside>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="mb-4 flex items-center justify-between rounded-[1.35rem] border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3 shadow-[0_12px_40px_-24px_rgba(43,36,32,0.45)] lg:hidden">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[color:var(--primary)]">Current business</p>
              <p className="text-sm font-semibold text-[color:var(--ink)]">{activeBusinessName}</p>
            </div>
            <button className="rounded-xl border border-[color:var(--border)] bg-[color:var(--cream)] p-2 text-[color:var(--ink)]" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
              <Menu className="h-5 w-5" />
            </button>
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
