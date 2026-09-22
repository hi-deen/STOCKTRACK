'use client';

import { Icon, type IconName } from '@/components/icon';
import { hapticTap } from '@/lib/haptics';

interface FabProps {
  onPress: () => void;
  // Read aloud by screen readers — the button itself is icon-only.
  label: string;
  icon?: IconName;
}

// Floating action button for a screen's one main "create" action. Sits above
// the bottom tab bar on phones and in the corner of the content on desktop.
export function Fab({ onPress, label, icon = 'add' }: FabProps) {
  return (
    <button
      type="button"
      onClick={() => {
        hapticTap();
        onPress();
      }}
      aria-label={label}
      title={label}
      className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 z-30 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-on-primary shadow-lg transition active:scale-95 lg:bottom-8 lg:right-8">
      <Icon name={icon} size={28} />
    </button>
  );
}
