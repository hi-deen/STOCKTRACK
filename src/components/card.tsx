import type { ButtonHTMLAttributes, HTMLAttributes } from 'react';

function cardClass(selected?: boolean) {
  return [
    'block w-full rounded-lg border p-4 text-left shadow-[0_1px_3px_var(--shadow)] dark:shadow-none',
    selected ? 'border-primary bg-primary-soft' : 'border-line bg-surface',
  ].join(' ');
}

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  selected?: boolean;
}

export function Card({ selected, className = '', ...rest }: CardProps) {
  return <div className={`${cardClass(selected)} ${className}`} {...rest} />;
}

interface PressableCardProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
}

export function PressableCard({ selected, className = '', type = 'button', ...rest }: PressableCardProps) {
  return (
    <button
      type={type}
      className={`${cardClass(selected)} transition active:scale-[0.99] active:opacity-90 hover:border-primary/60 ${className}`}
      {...rest}
    />
  );
}
