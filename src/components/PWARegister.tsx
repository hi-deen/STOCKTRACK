"use client";

import { useEffect } from "react";

const buildId = process.env.NEXT_PUBLIC_BUILD_ID || "dev";

export default function PWARegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    void navigator.serviceWorker.register(`/sw.js?build=${buildId}`).catch(() => undefined);
  }, []);

  return null;
}
