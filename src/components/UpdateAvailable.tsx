"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";

// How often to actively poll for a new deployment while the app is left
// open in one tab for a long session — otherwise a new version is only
// ever discovered on the next full navigation/registration.
const UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000;

export default function UpdateAvailable() {
  const [visible, setVisible] = useState(false);
  const [updating, setUpdating] = useState(false);
  const waitingWorker = useRef<ServiceWorker | null>(null);
  const reloadingRef = useRef(false);

  const showIfWaiting = useCallback((registration: ServiceWorkerRegistration) => {
    // A worker sits in "waiting" only once there's a previously-active one
    // for it to replace — i.e. this is a genuine update, not the very
    // first install (see sw.js's 'install' handler for why that
    // distinction now actually holds).
    if (registration.waiting && navigator.serviceWorker.controller) {
      waitingWorker.current = registration.waiting;
      setVisible(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    let registration: ServiceWorkerRegistration | null = null;

    const onUpdateFound = () => {
      const installingWorker = registration?.installing;
      if (!installingWorker) return;
      installingWorker.addEventListener("statechange", () => {
        if (installingWorker.state === "installed" && navigator.serviceWorker.controller) {
          waitingWorker.current = installingWorker;
          setVisible(true);
        }
      });
    };

    // Only reloads once the *user* has asked to update (see handleUpdate) —
    // this worker no longer skips waiting on its own, so a controllerchange
    // at this point is always either that consent or a harmless fresh
    // navigation picking up a version left waiting from a previous session.
    const onControllerChange = () => {
      if (reloadingRef.current) return;
      reloadingRef.current = true;
      window.location.reload();
    };

    navigator.serviceWorker.getRegistration().then((currentRegistration) => {
      registration = currentRegistration ?? null;
      if (!registration) return;
      registration.addEventListener("updatefound", onUpdateFound);
      showIfWaiting(registration);

      const checkForUpdate = () => registration?.update().catch(() => undefined);
      const interval = setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL_MS);
      const onVisible = () => {
        if (document.visibilityState === "visible") checkForUpdate();
      };
      document.addEventListener("visibilitychange", onVisible);

      return () => {
        clearInterval(interval);
        document.removeEventListener("visibilitychange", onVisible);
      };
    });

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    return () => {
      registration?.removeEventListener("updatefound", onUpdateFound);
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, [showIfWaiting]);

  function handleUpdate() {
    if (!waitingWorker.current || updating) return;
    setUpdating(true);
    // Triggers sw.js's 'message' handler, which calls self.skipWaiting();
    // the resulting activation fires 'controllerchange' above, which then
    // reloads. Nothing reloads before the person asks for it.
    waitingWorker.current.postMessage("SKIP_WAITING");
  }

  if (!visible) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-[calc(6rem+env(safe-area-inset-bottom))] z-[70] flex justify-center lg:inset-x-auto lg:right-4 lg:bottom-4 lg:justify-end">
      <div className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border border-primary bg-surface p-4 shadow-xl">
        <div className="rounded-md bg-primary-soft p-2 text-primary">
          <RefreshCw className={`h-4 w-4 ${updating ? "animate-spin" : ""}`} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-fg">A new version of Distro is available</p>
          <p className="mt-0.5 text-sm text-muted">Update now to get the latest fixes and features.</p>
          <button
            type="button"
            onClick={handleUpdate}
            disabled={updating}
            className="mt-3 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-bold text-on-primary transition hover:opacity-90 disabled:opacity-70">
            {updating ? "Updating…" : "Update now"}
          </button>
        </div>
      </div>
    </div>
  );
}
