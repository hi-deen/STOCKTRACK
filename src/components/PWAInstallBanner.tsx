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

    setIsInstalled(
      window.matchMedia("(display-mode: standalone)").matches ||
        Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone),
    );
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

  const showOffline = !isOnline;
  const showInstall = !isInstalled && !!deferredPrompt;

  if (!showOffline && !showInstall) {
    return null;
  }

  return (
    <div className="space-y-2">
      {showOffline ? (
        <div className="flex items-center gap-2 rounded-sm bg-warning-soft px-4 py-3 text-sm font-medium text-warning">
          <WifiOff className="h-4 w-4 shrink-0" />
          You are offline. Deliveries and payments you record are saved on this device and sync when you
          are back online.
        </div>
      ) : null}

      {showInstall ? (
        <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-fg">Install Distro on your device</p>
            <p className="mt-0.5 text-sm text-muted">Open it from your home screen for faster daily operations.</p>
          </div>
          <button
            type="button"
            onClick={handleInstall}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-bold text-on-primary transition hover:opacity-90">
            <Download className="h-4 w-4" />
            Install app
          </button>
        </div>
      ) : null}
    </div>
  );
}
