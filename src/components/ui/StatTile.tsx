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
    <div className="rounded-[1.35rem] border border-[color:var(--border)] bg-[color:var(--surface)] p-5 shadow-[0_12px_40px_-24px_rgba(43,36,32,0.45)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-[color:var(--muted)]">{label}</p>
          <p className="mt-2 text-2xl font-semibold text-[color:var(--ink)]">{value}</p>
        </div>
        <div className={`rounded-2xl p-3 ${toneClasses[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {trend ? <div className="mt-4 text-sm text-[color:var(--muted)]">{trend}</div> : null}
    </div>
  );
}
