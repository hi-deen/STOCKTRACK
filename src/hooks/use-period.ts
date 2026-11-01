'use client';

import { useState } from 'react';

import { formatDate, toDateString } from '@/lib/format';

export type PeriodPreset = 'all' | 'month' | 'last_month' | 'three_months' | 'year' | 'custom';

export const PERIOD_OPTIONS: { value: PeriodPreset; label: string }[] = [
  { value: 'month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
  { value: 'three_months', label: 'Last 3 months' },
  { value: 'year', label: 'This year' },
  { value: 'custom', label: 'Custom' },
];

// 'all' has no bounds, so start and end are empty; only list filters offer it.
function presetRange(preset: PeriodPreset): { start: string; end: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = toDateString(now);
  switch (preset) {
    case 'last_month':
      return {
        start: toDateString(new Date(year, month - 1, 1)),
        end: toDateString(new Date(year, month, 0)),
      };
    case 'three_months':
      return { start: toDateString(new Date(year, month - 2, 1)), end: today };
    case 'year':
      return { start: toDateString(new Date(year, 0, 1)), end: today };
    case 'all':
      return { start: '', end: '' };
    default:
      return { start: toDateString(new Date(year, month, 1)), end: today };
  }
}

export function usePeriod(initial: PeriodPreset = 'month') {
  const [preset, setPreset] = useState(initial);
  const [custom, setCustom] = useState(() => presetRange('month'));

  const { start, end } = preset === 'custom' ? custom : presetRange(preset);

  // Moving one end past the other drags it along, so the range stays valid.
  function setStart(value: string) {
    setCustom((c) => ({ start: value, end: value > c.end ? value : c.end }));
  }
  function setEnd(value: string) {
    setCustom((c) => ({ start: value < c.start ? value : c.start, end: value }));
  }

  const label =
    preset === 'custom'
      ? `${formatDate(start)} – ${formatDate(end)}`
      : (PERIOD_OPTIONS.find((o) => o.value === preset)?.label ?? 'All');

  return { preset, setPreset, start, end, label, setStart, setEnd };
}

export type Period = ReturnType<typeof usePeriod>;
