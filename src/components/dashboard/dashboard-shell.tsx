"use client";

import { useEffect, useState } from "react";
import PWAInstallBanner from "@/components/PWAInstallBanner";
import BottomNav from "@/components/layout/BottomNav";
import TopBar from "@/components/layout/TopBar";

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="min-h-screen bg-[color:var(--background)]">
      <TopBar />
      <div className="mx-auto flex max-w-7xl flex-col">
        <main className="flex-1 px-3 py-4 pb-24 pt-4 sm:px-4 sm:py-6 sm:pb-28 lg:px-8 lg:py-8 lg:pb-28">
          {mounted ? <PWAInstallBanner /> : null}
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
