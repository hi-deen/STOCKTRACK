"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import Button from "./Button";

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  children?: ReactNode;
};

export default function EmptyState({ icon: Icon, title, description, actionLabel, onAction, children }: EmptyStateProps) {
  return (
    <div className="rounded-[1.5rem] border border-dashed border-[color:var(--border)] bg-[color:var(--cream)]/70 p-8 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--accent-soft)] text-[color:var(--accent)]">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-[color:var(--ink)]">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-[color:var(--muted)]">{description}</p>
      {children ? <div className="mt-4">{children}</div> : null}
      {actionLabel && onAction ? (
        <div className="mt-5 flex justify-center">
          <Button onClick={onAction} variant="secondary">
            {actionLabel}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
