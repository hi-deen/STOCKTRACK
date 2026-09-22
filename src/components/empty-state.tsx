'use client';

import { Icon, type IconName } from '@/components/icon';
import { PrimaryButton } from '@/components/primary-button';

interface EmptyStateProps {
  icon: IconName;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}

// Shown instead of a bare "nothing here" line: an icon, what's missing, and
// (when there's an obvious next step) a button to take it.
export function EmptyState({ icon, title, message, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      <div className="mb-2 flex h-[72px] w-[72px] items-center justify-center rounded-full bg-primary-soft text-primary">
        <Icon name={icon} size={32} />
      </div>
      <p className="text-[17px] font-bold text-fg">{title}</p>
      {message ? <p className="max-w-sm text-muted">{message}</p> : null}
      {actionLabel && onAction ? (
        <div className="mt-2 w-full max-w-[240px]">
          <PrimaryButton label={actionLabel} onClick={onAction} />
        </div>
      ) : null}
    </div>
  );
}
