"use client";

import { useEffect, useState } from "react";

export function useCountdown(durationSeconds: number, storageKey: string) {
  const [secondsLeft, setSecondsLeft] = useState(() => {
    if (typeof window === "undefined") {
      return durationSeconds;
    }

    const stored = window.localStorage.getItem(storageKey);
    if (!stored) {
      return durationSeconds;
    }

    const startedAt = Number(stored);
    if (!startedAt) {
      return durationSeconds;
    }

    const elapsed = Math.floor((Date.now() - startedAt) / 1000);
    return Math.max(0, durationSeconds - elapsed);
  });

  const isActive = secondsLeft > 0;

  useEffect(() => {
    if (!isActive) {
      return;
    }

    const timer = window.setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isActive]);

  const start = () => {
    if (typeof window === "undefined") {
      return;
    }
    const startedAt = Date.now();
    window.localStorage.setItem(storageKey, startedAt.toString());
    setSecondsLeft(durationSeconds);
  };

  return { secondsLeft, isActive, start };
}
