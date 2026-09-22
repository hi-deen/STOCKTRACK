'use client';

import { PressableCard } from '@/components/card';

interface CategoryChipsProps<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}

// Row of mutually-exclusive selectable cards (e.g. Raw material / Packaging).
export function CategoryChips<T extends string>({ options, value, onChange, disabled }: CategoryChipsProps<T>) {
  return (
    <div className="flex gap-2">
      {options.map((option) => (
        <PressableCard
          key={option.value}
          selected={option.value === value}
          onClick={() => !disabled && onChange(option.value)}
          className="text-center">
          <span className="text-sm font-bold">{option.label}</span>
        </PressableCard>
      ))}
    </div>
  );
}
