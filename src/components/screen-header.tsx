'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { Icon, type IconName } from '@/components/icon';
import { hapticTap } from '@/lib/haptics';

export interface HeaderAction {
  icon: IconName;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  // Shows a back arrow. `true` goes back in history; pass a function to run
  // custom logic (e.g. discard-changes confirmation).
  back?: boolean | (() => void);
  onTitlePress?: () => void;
  primaryActions?: HeaderAction[];
  overflowActions?: HeaderAction[];
}

// Solid navy app bar (WhatsApp-style) — sticky at the top of the content
// column, with a back arrow, optional business-switch title, icon actions and
// a 3-dot overflow menu. Same props as the mobile app's ScreenHeader.
export function ScreenHeader({
  title,
  subtitle,
  back,
  onTitlePress,
  primaryActions = [],
  overflowActions = [],
}: ScreenHeaderProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  function runAction(action: HeaderAction) {
    hapticTap();
    action.onPress();
  }

  function handleBack() {
    hapticTap();
    if (typeof back === 'function') back();
    else router.back();
  }

  const titleContent = (
    <span className="min-w-0 text-left">
      <span className="block truncate text-xl font-semibold leading-[26px]">{title}</span>
      {subtitle ? <span className="block truncate text-[13px] leading-[17px] opacity-80">{subtitle}</span> : null}
    </span>
  );

  return (
    <header className="pt-safe sticky top-0 z-40 bg-header text-on-header shadow-[0_1px_3px_rgba(0,0,0,0.15)]">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-1 px-2 lg:px-6">
        {back ? (
          <button
            type="button"
            onClick={handleBack}
            aria-label="Back"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition hover:bg-white/10">
            <Icon name="arrow-back" size={24} />
          </button>
        ) : null}

        {onTitlePress ? (
          <button
            type="button"
            onClick={() => {
              hapticTap();
              onTitlePress();
            }}
            aria-label={`${title}, switch business`}
            className="flex min-w-0 flex-1 items-center gap-0.5 pl-2">
            {titleContent}
            <Icon name="chevron-down" size={18} />
          </button>
        ) : (
          <div className="flex min-w-0 flex-1 items-center pl-2">{titleContent}</div>
        )}

        <div className="flex items-center">
          {primaryActions.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={() => runAction(action)}
              disabled={action.disabled}
              aria-label={action.label}
              title={action.label}
              className="flex h-11 w-11 items-center justify-center rounded-full transition hover:bg-white/10 disabled:opacity-40">
              <Icon name={action.icon} size={24} />
            </button>
          ))}

          {overflowActions.length > 0 ? (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => {
                  hapticTap();
                  setMenuOpen((open) => !open);
                }}
                aria-label="More actions"
                aria-expanded={menuOpen}
                className="flex h-11 w-11 items-center justify-center rounded-full transition hover:bg-white/10">
                <Icon name="ellipsis-vertical" size={24} />
              </button>
              {menuOpen ? (
                <div className="animate-pop-in absolute right-0 top-12 z-50 min-w-[220px] rounded-md border border-line bg-surface py-1 text-fg shadow-xl">
                  {overflowActions.map((action) => (
                    <button
                      key={action.label}
                      type="button"
                      disabled={action.disabled}
                      onClick={() => {
                        setMenuOpen(false);
                        runAction(action);
                      }}
                      className="flex w-full items-center gap-4 px-4 py-3 text-left transition hover:bg-primary-soft disabled:text-muted">
                      <span className="text-muted">
                        <Icon name={action.icon} size={20} />
                      </span>
                      <span>{action.label}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
