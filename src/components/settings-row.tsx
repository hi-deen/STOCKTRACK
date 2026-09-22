'use client';

import { Icon, type IconName } from '@/components/icon';
import { hapticTap } from '@/lib/haptics';

interface SettingsRowProps {
  icon: IconName;
  title: string;
  subtitle?: string;
  onPress: () => void;
  tone?: 'default' | 'danger';
}

// Flat, full-width row: icon column, title, one-line hint. No card, no
// border — the same visual language as a messaging app's settings list.
export function SettingsRow({ icon, title, subtitle, onPress, tone = 'default' }: SettingsRowProps) {
  const isDanger = tone === 'danger';
  return (
    <button
      type="button"
      onClick={() => {
        hapticTap();
        onPress();
      }}
      className="flex w-full items-center gap-4 px-4 py-4 text-left transition hover:bg-primary-soft sm:px-6">
      <span className={`flex w-8 justify-center ${isDanger ? 'text-danger' : 'text-muted'}`}>
        <Icon name={icon} size={24} />
      </span>
      <span className="flex-1 space-y-0.5">
        <span className={`block text-base font-medium ${isDanger ? 'text-danger' : 'text-fg'}`}>{title}</span>
        {subtitle ? <span className="block text-sm text-muted">{subtitle}</span> : null}
      </span>
    </button>
  );
}

export function SettingsDivider() {
  return <div className="my-1 h-px bg-line" />;
}
