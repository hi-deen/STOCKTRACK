"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

export default function UpdateAvailable() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    let registration: ServiceWorkerRegistration | null = null;

    const onUpdateFound = () => {
      const installingWorker = registration?.installing;
      if (!installingWorker) {
        return;
      }

      installingWorker.addEventListener("statechange", () => {
        if (installingWorker.state === "installed" && navigator.serviceWorker.controller) {
          setVisible(true);
        }
      });
    };

    const onControllerChange = () => {
      window.location.reload();
    };

    navigator.serviceWorker.getRegistration().then((currentRegistration) => {
      registration = currentRegistration ?? null;
      if (registration) {
        registration.addEventListener("updatefound", onUpdateFound);
        if (registration.waiting && navigator.serviceWorker.controller) {
          setVisible(true);
        }
      }
    });

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    return () => {
      registration?.removeEventListener("updatefound", onUpdateFound);
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  if (!visible) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-[70] max-w-sm rounded-[1.2rem] border border-[color:var(--border)] bg-[color:var(--surface)] p-3 shadow-[0_20px_60px_-30px_rgba(43,36,32,0.65)]">
      <div className="flex items-start gap-3">
        <div className="rounded-2xl bg-[color:var(--accent-soft)] p-2 text-[color:var(--accent)]">
          <RefreshCw className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-semibold text-[color:var(--ink)]">A new version is available</p>
          <p className="mt-1 text-sm text-[color:var(--muted)]">Refresh to load the latest improvements.</p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="mt-3 inline-flex items-center justify-center rounded-2xl bg-[color:var(--primary)] px-3 py-2 text-sm font-semibold text-white"
      >
        Reload
      </button>
    </div>
  );
}
