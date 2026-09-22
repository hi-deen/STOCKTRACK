'use client';

import { useEffect, type ReactNode } from 'react';

import { Icon, type IconName } from '@/components/icon';
import { hapticTap } from '@/lib/haptics';

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

// Modal panel: rises from the bottom edge on phones (the mobile-native
// replacement for centred pop-ups) and becomes a centred dialog on wider
// screens. Escape or a tap on the dimmed area closes it.
export function BottomSheet({ visible, onClose, title, children }: BottomSheetProps) {
  useEffect(() => {
    if (!visible) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [visible, onClose]);

  if (!visible) return null;

  return (
    <div
      className="animate-fade-in fixed inset-0 z-50 flex items-end justify-center bg-[var(--overlay)] sm:items-center sm:p-4"
      onClick={onClose}
      role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
        className="animate-sheet-up pb-safe max-h-[92vh] w-full overflow-y-auto rounded-t-lg bg-surface px-4 pb-4 pt-2 shadow-xl sm:max-w-lg sm:animate-pop-in sm:rounded-lg sm:pt-4">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line sm:hidden" />
        {title ? (
          <h2 className="mb-2 text-[13px] font-bold uppercase tracking-wider text-muted">{title}</h2>
        ) : null}
        {children}
      </div>
    </div>
  );
}

export interface SheetAction {
  icon?: IconName;
  label: string;
  onPress: () => void;
  tone?: 'default' | 'danger';
}

interface ActionSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  actions: SheetAction[];
}

// A BottomSheet holding a list of tappable actions. Closes itself before
// running the chosen action.
export function ActionSheet({ visible, onClose, title, actions }: ActionSheetProps) {
  return (
    <BottomSheet visible={visible} onClose={onClose} title={title}>
      {actions.map((action) => {
        const danger = action.tone === 'danger';
        return (
          <button
            key={action.label}
            type="button"
            onClick={() => {
              hapticTap();
              onClose();
              action.onPress();
            }}
            className="flex w-full items-center gap-4 rounded-md px-1 py-4 text-left transition hover:bg-primary-soft">
            {action.icon ? (
              <span className={danger ? 'text-danger' : 'text-muted'}>
                <Icon name={action.icon} size={24} />
              </span>
            ) : null}
            <span className={`text-base ${danger ? 'text-danger' : 'text-fg'}`}>{action.label}</span>
          </button>
        );
      })}
    </BottomSheet>
  );
}

// Centred dialog for small prompts/confirmations (business switcher, etc).
export function Dialog({
  visible,
  onClose,
  title,
  children,
}: BottomSheetProps) {
  useEffect(() => {
    if (!visible) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, onClose]);

  if (!visible) return null;

  return (
    <div
      className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay)] p-4"
      onClick={onClose}
      role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
        className="animate-pop-in max-h-[80vh] w-full max-w-md space-y-2 overflow-y-auto rounded-lg bg-surface p-6 shadow-xl">
        {title ? <h2 className="text-sm font-bold text-fg">{title}</h2> : null}
        {children}
      </div>
    </div>
  );
}
