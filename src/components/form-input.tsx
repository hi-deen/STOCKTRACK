import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

const FIELD_BASE =
  'w-full rounded-sm border bg-surface px-4 py-2 text-base text-fg outline-none transition focus:border-[1.5px] disabled:opacity-60';

function fieldClass(error?: string | null, extra = '') {
  return `${FIELD_BASE} ${error ? 'border-danger' : 'border-line focus:border-primary'} ${extra}`;
}

function ErrorText({ error }: { error?: string | null }) {
  return error ? <p className="mt-1 text-sm font-medium text-danger">{error}</p> : null;
}

interface FormInputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string | null;
}

export function FormInput({ error, className = '', ...rest }: FormInputProps) {
  return (
    <div>
      <input className={fieldClass(error, className)} {...rest} />
      <ErrorText error={error} />
    </div>
  );
}

interface FormTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string | null;
}

export function FormTextarea({ error, className = '', rows = 3, ...rest }: FormTextareaProps) {
  return (
    <div>
      <textarea rows={rows} className={fieldClass(error, `resize-y ${className}`)} {...rest} />
      <ErrorText error={error} />
    </div>
  );
}

interface FormSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: string | null;
}

export function FormSelect({ error, className = '', children, ...rest }: FormSelectProps) {
  return (
    <div>
      <select className={fieldClass(error, className)} {...rest}>
        {children}
      </select>
      <ErrorText error={error} />
    </div>
  );
}

// Label + control stack used by every form screen.
export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-sm font-bold text-fg">{label}</span>
      {children}
      {hint ? <span className="block text-sm text-muted">{hint}</span> : null}
    </label>
  );
}
