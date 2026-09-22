import type { ReactNode } from 'react';

interface ListRowProps {
  title: string;
  subtitle?: string;
  leading?: ReactNode;
  trailingText?: string;
  trailingClassName?: string;
  trailing?: ReactNode;
  onClick?: () => void;
  className?: string;
}

export function ListRow({
  title,
  subtitle,
  leading,
  trailingText,
  trailingClassName = '',
  trailing,
  onClick,
  className = '',
}: ListRowProps) {
  const body = (
    <>
      {leading}
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-base font-semibold leading-snug text-fg">{title}</p>
        {subtitle ? <p className="mt-0.5 text-sm font-medium text-muted">{subtitle}</p> : null}
      </div>
      {trailing ?? (trailingText ? <span className={`shrink-0 font-medium ${trailingClassName}`}>{trailingText}</span> : null)}
    </>
  );

  const base = `flex w-full items-center justify-between gap-2 border-b border-line py-4 text-left ${className}`;

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${base} transition hover:bg-primary-soft`}>
        {body}
      </button>
    );
  }
  return <div className={base}>{body}</div>;
}
