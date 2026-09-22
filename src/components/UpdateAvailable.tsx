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
    <div className="fixed bottom-24 right-4 z-[70] max-w-sm rounded-lg border border-line bg-surface p-4 shadow-xl lg:bottom-4">
      <div className="flex items-start gap-3">
        <div className="rounded-md bg-primary-soft p-2 text-primary">
          <RefreshCw className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-bold text-fg">A new version is available</p>
          <p className="mt-0.5 text-sm text-muted">Refresh to load the latest improvements.</p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="mt-3 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-bold text-on-primary">
        Reload
      </button>
    </div>
  );
}
