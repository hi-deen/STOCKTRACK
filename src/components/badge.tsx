interface BadgeProps {
  label: string;
  tone?: 'primary' | 'success' | 'danger' | 'warning' | 'neutral';
  className?: string;
}

const TONES: Record<NonNullable<BadgeProps['tone']>, string> = {
  primary: 'bg-primary-soft text-primary border-transparent',
  success: 'bg-success-soft text-success border-transparent',
  danger: 'bg-danger-soft text-danger border-transparent',
  warning: 'bg-warning-soft text-warning border-transparent',
  neutral: 'bg-surface text-muted border-line',
};

export function Badge({ label, tone = 'neutral', className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex self-start whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-bold tracking-wide ${TONES[tone]} ${className}`}>
      {label}
    </span>
  );
}
