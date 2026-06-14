"use client";

import { useEffect, useState } from "react";
import { Download, WifiOff } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export default function PWAInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const onAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt as EventListener);
    window.addEventListener("appinstalled", onAppInstalled);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    setIsInstalled(window.matchMedia("(display-mode: standalone)").matches || Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone));
    setIsOnline(window.navigator.onLine);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt as EventListener);
      window.removeEventListener("appinstalled", onAppInstalled);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) {
      return;
    }

    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  };

  if (isInstalled) {
    return null;
  }

  return (
    <div className="mb-4 space-y-2">
      {!isOnline ? (
        <div className="flex items-center gap-2 rounded-2xl border border-[color:var(--border)] bg-[color:var(--cream)]/80 px-3 py-2 text-sm text-[color:var(--ink)]">
          <WifiOff className="h-4 w-4 text-[color:var(--primary)]" />
          You are offline. StockTrack will continue to load cached pages when available.
        </div>
      ) : null}

      {deferredPrompt ? (
        <div className="flex flex-col gap-3 rounded-[1.35rem] border border-[color:var(--border)] bg-[color:var(--surface)] p-4 shadow-[0_12px_40px_-24px_rgba(43,36,32,0.45)] sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-[color:var(--ink)]">Install StockTrack on your phone</p>
            <p className="mt-1 text-sm text-[color:var(--muted)]">Open it from your home screen for faster daily field operations.</p>
          </div>
          <button
            type="button"
            onClick={handleInstall}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
          >
            <Download className="h-4 w-4" />
            Install app
          </button>
        </div>
      ) : null}
    </div>
  );
}
