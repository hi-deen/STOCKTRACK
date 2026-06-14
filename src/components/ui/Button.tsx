"use client";

import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

type ButtonProps = Omit<ComponentPropsWithoutRef<"button">, "children"> & {
  variant?: "primary" | "secondary" | "outline" | "danger" | "ghost";
  icon?: LucideIcon;
  iconPosition?: "left" | "right";
  children: ReactNode;
  href?: string;
  target?: string;
  rel?: string;
};

const baseClasses = "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60";

const variantClasses: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary: "bg-[var(--primary)] text-white shadow-sm hover:bg-[color:#a64f08] focus-visible:ring-[color:var(--primary)]",
  secondary: "bg-[var(--secondary)] text-white shadow-sm hover:bg-[color:#2f4633] focus-visible:ring-[color:var(--secondary)]",
  outline: "border border-[color:var(--border)] bg-white text-[color:var(--ink)] hover:bg-[color:var(--cream)] focus-visible:ring-[color:var(--accent)]",
  danger: "bg-[var(--danger)] text-white shadow-sm hover:bg-[color:#8e2d2a] focus-visible:ring-[color:var(--danger)]",
  ghost: "bg-transparent text-[color:var(--ink)] hover:bg-[color:var(--cream)] focus-visible:ring-[color:var(--accent)]",
};

export default function Button({
  variant = "primary",
  icon: Icon,
  iconPosition = "left",
  children,
  className = "",
  href,
  target,
  rel,
  type = "button",
  ...props
}: ButtonProps) {
  const classes = `${baseClasses} ${variantClasses[variant]} ${className}`.trim();
  const content = (
    <>
      {Icon && iconPosition === "left" ? <Icon className="h-4 w-4" /> : null}
      <span>{children}</span>
      {Icon && iconPosition === "right" ? <Icon className="h-4 w-4" /> : null}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={classes} target={target} rel={rel}>
        {content}
      </Link>
    );
  }

  return (
    <button type={type} className={classes} {...props}>
      {content}
    </button>
  );
}
