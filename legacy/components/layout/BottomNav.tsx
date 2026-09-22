"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BarChart3, Bell, LayoutDashboard, Route } from "lucide-react";
import { useBusiness } from "@/components/providers/business-provider";
import { createClient } from "@/lib/supabase/client";

const navItems = [
  { href: "/dashboard/operations", label: "Operations", icon: Route },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/reports", label: "History", icon: BarChart3 },
  { href: "/dashboard/reminders", label: "Reminders", icon: Bell },
];

export default function BottomNav() {
  const pathname = usePathname();
  const { activeBusinessId } = useBusiness();
  const [reminderCount, setReminderCount] = useState(0);

  useEffect(() => {
    const loadReminderCount = async () => {
      const supabase = createClient();
      if (!supabase || !activeBusinessId) {
        setReminderCount(0);
        return;
      }

      const today = new Date().toISOString().slice(0, 10);
      const { data } = await supabase
        .from("reminders")
        .select("id", { count: "exact" })
        .eq("business_id", activeBusinessId)
        .eq("status", "pending")
        .lte("due_date", today);

      setReminderCount(data?.length ?? 0);
    };

    void loadReminderCount();
  }, [activeBusinessId]);

  return (
    <nav className="sticky bottom-0 z-40 border-t border-[color:var(--border)] bg-[color:var(--surface)]/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-around px-2 py-2 sm:px-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-w-0 flex-1 flex-col items-center justify-center rounded-2xl px-2 py-2 text-[11px] font-semibold transition ${isActive ? "bg-[color:var(--primary)] text-white shadow-sm" : "text-[color:var(--muted)] hover:bg-[color:var(--cream)] hover:text-[color:var(--ink)]"}`}
            >
              <div className="relative">
                <Icon className="h-4 w-4" />
                {item.href === "/dashboard/reminders" && reminderCount > 0 ? (
                  <span className={`absolute -right-2 -top-2 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${isActive ? "bg-white/20 text-white" : "bg-[color:var(--danger-soft)] text-[color:var(--danger)]"}`}>
                    {reminderCount}
                  </span>
                ) : null}
              </div>
              <span className="mt-1">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
