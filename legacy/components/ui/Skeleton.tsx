"use client";

import type { ReactNode } from "react";

type SkeletonProps = {
  className?: string;
  children?: ReactNode;
};

export default function Skeleton({ className = "", children }: SkeletonProps) {
  return (
    <div className={`animate-pulse rounded-2xl bg-[color:var(--cream)] ${className}`.trim()}>
      {children}
    </div>
  );
}
