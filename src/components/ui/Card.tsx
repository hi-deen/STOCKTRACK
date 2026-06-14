"use client";

import type { ReactNode } from "react";

type CardProps = {
  children: ReactNode;
  className?: string;
  padded?: boolean;
};

export default function Card({ children, className = "", padded = true }: CardProps) {
  return (
    <div className={`rounded-[1.35rem] border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[0_12px_40px_-24px_rgba(43,36,32,0.45)] ${padded ? "p-5 sm:p-6" : ""} ${className}`.trim()}>
      {children}
    </div>
  );
}
