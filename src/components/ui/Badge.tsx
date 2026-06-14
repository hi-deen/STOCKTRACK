"use client";

import type { ReactNode } from "react";

type BadgeProps = {
  children: ReactNode;
  variant?: "success" | "danger" | "warning" | "neutral" | "info";
  className?: string;
};

const variants: Record<NonNullable<BadgeProps["variant"]>, string> = {
  success: "border border-[color:var(--success-soft)] bg-[color:var(--success-soft)] text-[color:var(--success)]",
  danger: "border border-[color:var(--danger-soft)] bg-[color:var(--danger-soft)] text-[color:var(--danger)]",
  warning: "border border-[color:var(--warning-soft)] bg-[color:var(--warning-soft)] text-[color:var(--warning)]",
  neutral: "border border-[color:var(--border)] bg-[color:var(--cream)] text-[color:var(--ink)]",
  info: "border border-[color:var(--accent-soft)] bg-[color:var(--accent-soft)] text-[color:var(--accent)]",
};

export default function Badge({ children, variant = "neutral", className = "" }: BadgeProps) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${variants[variant]} ${className}`.trim()}>{children}</span>;
}
