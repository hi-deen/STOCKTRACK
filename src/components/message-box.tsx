import type { ReactNode } from 'react';

interface MessageBoxProps {
  tone?: 'danger' | 'success' | 'warning' | 'neutral';
  message?: string | null;
  children?: ReactNode;
  className?: string;
}

const TONES: Record<NonNullable<MessageBoxProps['tone']>, string> = {
  danger: 'bg-danger-soft text-danger',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  neutral: 'bg-surface text-muted border border-line',
};

export function MessageBox({ tone = 'neutral', message, children, className = '' }: MessageBoxProps) {
  return (
    <div
      role={tone === 'danger' ? 'alert' : undefined}
      className={`space-y-1 rounded-sm p-4 text-base ${TONES[tone]} ${className}`}>
      {message ? <p>{message}</p> : null}
      {children}
    </div>
  );
}
