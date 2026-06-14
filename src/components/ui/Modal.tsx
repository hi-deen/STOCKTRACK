"use client";

import { X } from "lucide-react";
import type { ReactNode } from "react";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
};

export default function Modal({ open, onClose, title, description, children, footer }: ModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color:var(--overlay)] px-3 py-3 sm:px-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-[1.5rem] border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[0_24px_90px_-36px_rgba(43,36,32,0.75)]">
        <div className="flex items-start justify-between border-b border-[color:var(--border)] px-4 py-4 sm:px-6">
          <div>
            <h3 className="text-lg font-semibold text-[color:var(--ink)]">{title}</h3>
            {description ? <p className="mt-1 text-sm text-[color:var(--muted)]">{description}</p> : null}
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-[color:var(--muted)] transition hover:bg-[color:var(--cream)] hover:text-[color:var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]" aria-label="Close modal">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">{children}</div>
        {footer ? <div className="border-t border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-4 sm:px-6">{footer}</div> : null}
      </div>
    </div>
  );
}
