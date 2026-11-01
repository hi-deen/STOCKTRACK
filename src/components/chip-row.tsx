'use client';

interface ChipRowProps<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

export function ChipRow<T extends string>({ options, value, onChange }: ChipRowProps<T>) {
  return (
    <div className="flex gap-2 overflow-x-auto">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`shrink-0 rounded-md border px-3 py-1 text-sm font-bold ${
            option.value === value ? 'border-primary bg-primary-soft text-primary' : 'border-line bg-surface text-muted'
          }`}>
          {option.label}
        </button>
      ))}
    </div>
  );
}
