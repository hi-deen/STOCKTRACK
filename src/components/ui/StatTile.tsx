"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

type StatTileProps = {
  icon: LucideIcon;
  label: string;
  value: string;
  tone?: "primary" | "secondary" | "accent" | "danger" | "warning";
  trend?: ReactNode;
};

const toneClasses: Record<NonNullable<StatTileProps["tone"]>, string> = {
  primary: "bg-[color:var(--primary-soft)] text-[color:var(--primary)]",
  secondary: "bg-[color:var(--secondary-soft)] text-[color:var(--secondary)]",
  accent: "bg-[color:var(--accent-soft)] text-[color:var(--accent)]",
  danger: "bg-[color:var(--danger-soft)] text-[color:var(--danger)]",
  warning: "bg-[color:var(--warning-soft)] text-[color:var(--warning)]",
};

export default function StatTile({ icon: Icon, label, value, tone = "primary", trend }: StatTileProps) {
  return (
    <div className="rounded-[1.1rem] border border-[color:var(--border)] bg-[color:var(--surface)] p-3 shadow-[0_10px_30px_-22px_rgba(43,36,32,0.45)]">
      <div className="flex items-start gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${toneClasses[tone]}`}>
          <Icon className="h-4.5 w-4.5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-[color:var(--muted)]">{label}</p>
          <p className="mt-1 text-xl font-semibold text-[color:var(--ink)]">{value}</p>
        </div>
      </div>
      {trend ? <div className="mt-2 text-xs text-[color:var(--muted)]">{trend}</div> : null}
    </div>
  );
}
