'use client';

import type { ReactNode } from 'react';

import { Icon } from '@/components/icon';
import { PressableCard } from '@/components/card';

interface AccordionSectionProps {
  title: string;
  summary?: string;
  expanded: boolean;
  onToggle: () => void;
  children: ReactNode;
}

// Collapsible section — header is a full-width PressableCard (title +
// optional summary line + chevron), content renders below only when expanded.
export function AccordionSection({ title, summary, expanded, onToggle, children }: AccordionSectionProps) {
  return (
    <div className="mt-4">
      <PressableCard onClick={onToggle} className="flex items-center justify-between gap-2" aria-expanded={expanded}>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-bold uppercase tracking-wider text-muted">{title}</span>
          {summary ? <span className="mt-0.5 block text-sm font-medium text-muted">{summary}</span> : null}
        </span>
        <span className="text-muted">
          <Icon name={expanded ? 'chevron-down' : 'chevron-forward'} size={20} />
        </span>
      </PressableCard>
      {expanded ? <div className="mt-2 space-y-2">{children}</div> : null}
    </div>
  );
}
