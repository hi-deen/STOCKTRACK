"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useBusiness } from "@/components/providers/business-provider";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/shops", label: "Shops" },
  { href: "/dashboard/products", label: "Products" },
  { href: "/dashboard/stock", label: "Stock" },
  { href: "/dashboard/payments", label: "Payments" },
  { href: "/dashboard/reminders", label: "Reminders" },
];

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { activeBusinessId, businesses } = useBusiness();

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto flex max-w-7xl flex-col lg:flex-row">
        <aside className="border-b border-slate-200 bg-white px-4 py-4 lg:min-h-screen lg:w-64 lg:border-b-0 lg:border-r lg:px-6 lg:py-8">
          <div className="flex items-center justify-between lg:block">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">StockTrack</p>
              <h2 className="mt-1 text-lg font-semibold text-slate-900">Phase 2</h2>
            </div>
            <button
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 lg:hidden"
              onClick={() => setMobileOpen((value) => !value)}
            >
              Menu
            </button>
          </div>

          <div className={`mt-4 space-y-2 ${mobileOpen ? "block" : "hidden lg:block"}`}>
            {navItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center rounded-lg px-3 py-2 text-sm font-medium transition ${
                    isActive ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"
                  }`}
                  onClick={() => setMobileOpen(false)}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>

          <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
            <p className="font-semibold text-slate-900">Active business</p>
            <p className="mt-1">{activeBusinessId ? businesses.find((business) => business.id === activeBusinessId)?.name ?? "Selected business" : "No business selected"}</p>
          </div>
        </aside>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
