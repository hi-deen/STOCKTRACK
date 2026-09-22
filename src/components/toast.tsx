'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

interface ToastOptions {
  actionLabel?: string;
  onAction?: () => void;
  durationMs?: number;
}

interface ToastState extends ToastOptions {
  id: number;
  message: string;
}

interface ToastContextValue {
  show: (message: string, options?: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue>({ show: () => {} });

export function useToast(): ToastContextValue {
  return useContext(ToastContext);
}

// A small dark bar near the bottom that confirms an action ("Saved") and
// disappears by itself. One at a time; a new one replaces the current one.
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const nextId = useRef(1);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => setToast(null), []);

  const show = useCallback(
    (message: string, options: ToastOptions = {}) => {
      if (timer.current) clearTimeout(timer.current);
      setToast({ id: nextId.current++, message, ...options });
      timer.current = setTimeout(dismiss, options.durationMs ?? (options.actionLabel ? 5000 : 2600));
    },
    [dismiss]
  );

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? (
        <div
          key={toast.id}
          className="animate-fade-in pointer-events-none fixed inset-x-4 bottom-[calc(6rem+env(safe-area-inset-bottom))] z-[60] flex justify-center lg:bottom-8">
          <div
            role="status"
            className="pointer-events-auto flex max-w-[480px] items-center gap-4 rounded-md bg-fg px-4 py-3 text-[15px] text-app shadow-xl">
            <span className="min-w-0 flex-1">{toast.message}</span>
            {toast.actionLabel && toast.onAction ? (
              <button
                type="button"
                className="shrink-0 text-sm font-bold text-primary"
                onClick={() => {
                  toast.onAction?.();
                  dismiss();
                }}>
                {toast.actionLabel}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </ToastContext.Provider>
  );
}
