"use client";

import { useEffect } from "react";

export default function PWARegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    // /sw.js is now served by a Route Handler (src/app/sw.js/route.ts)
    // that stamps a build identifier into the file's own content on every
    // deploy — no query-string cache-busting needed here any more; the
    // file's bytes themselves are what change now. See that route's
    // header comment for why that matters.
    void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);

  return null;
}
