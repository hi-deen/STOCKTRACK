const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  const sign = value < 0 ? '-' : '';
  return `${sign}₦${Math.abs(value).toLocaleString()}`;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

// Accepts a 'YYYY-MM-DD' date string or an ISO timestamp. Date-only strings
// are parsed as local dates on purpose — `new Date('2026-09-21')` would be
// read as UTC midnight and can land on the previous day in the evening.
export function parseDate(input: string): Date {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
  if (dateOnly) {
    return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
  }
  return new Date(input);
}

// "Today", "Yesterday", "12 Sep", or "12 Sep 2025" when not the current year.
export function formatDate(input: string | null | undefined): string {
  if (!input) return '';
  const date = parseDate(input);
  if (Number.isNaN(date.getTime())) return input;

  const today = startOfDay(new Date());
  const diffDays = Math.round((today.getTime() - startOfDay(date).getTime()) / 86_400_000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';

  const base = `${date.getDate()} ${MONTHS[date.getMonth()]}`;
  return date.getFullYear() === today.getFullYear() ? base : `${base} ${date.getFullYear()}`;
}

// Local calendar date as YYYY-MM-DD (what date inputs and the API use).
export function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
