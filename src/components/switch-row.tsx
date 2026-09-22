'use client';

interface SwitchRowProps {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  hint?: string;
}

export function SwitchRow({ label, value, onChange, hint }: SwitchRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <span>
        <span className="block text-sm font-bold">{label}</span>
        {hint ? <span className="block text-sm text-muted">{hint}</span> : null}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-label={label}
        onClick={() => onChange(!value)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition ${value ? 'bg-primary' : 'bg-line'}`}>
        <span
          className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${value ? 'left-[22px]' : 'left-0.5'}`}
        />
      </button>
    </div>
  );
}
