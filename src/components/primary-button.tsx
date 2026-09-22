'use client';

import type { ButtonHTMLAttributes } from 'react';

import { hapticTap } from '@/lib/haptics';

interface PrimaryButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  label: string;
  loading?: boolean;
  variant?: 'primary' | 'outline' | 'danger';
}

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-block h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
      role="status"
      aria-label="Loading"
    />
  );
}

export function PrimaryButton({
  label,
  loading,
  variant = 'primary',
  disabled,
  className = '',
  onClick,
  type = 'button',
  ...rest
}: PrimaryButtonProps) {
  const isDisabled = !!disabled || !!loading;
  const isOutline = variant === 'outline';
  const isDanger = variant === 'danger';

  let tone: string;
  if (isDisabled) {
    tone = `bg-line text-muted ${isOutline ? 'border border-line' : ''}`;
  } else if (isOutline) {
    tone = 'border border-primary bg-transparent text-primary hover:bg-primary-soft';
  } else if (isDanger) {
    tone = 'bg-danger text-on-primary hover:opacity-90';
  } else {
    tone = 'bg-primary text-on-primary hover:opacity-90';
  }

  return (
    <button
      type={type}
      disabled={isDisabled}
      onClick={(event) => {
        hapticTap();
        onClick?.(event);
      }}
      className={`flex min-h-[48px] w-full items-center justify-center rounded-md px-4 py-3 text-base font-bold transition active:scale-[0.98] ${tone} ${className}`}
      {...rest}>
      {loading ? <Spinner /> : label}
    </button>
  );
}
