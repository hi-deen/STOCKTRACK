'use client';

import { ChipRow } from '@/components/chip-row';
import { FormInput } from '@/components/form-input';
import { PERIOD_OPTIONS, type Period, type PeriodPreset } from '@/hooks/use-period';
import { toDateString } from '@/lib/format';

interface PeriodFilterProps {
  period: Period;
  includeAll?: boolean;
}

export function PeriodFilter({ period, includeAll }: PeriodFilterProps) {
  const options: { value: PeriodPreset; label: string }[] = includeAll
    ? [{ value: 'all', label: 'All' }, ...PERIOD_OPTIONS]
    : PERIOD_OPTIONS;
  const today = toDateString(new Date());

  return (
    <div className="space-y-2">
      <ChipRow options={options} value={period.preset} onChange={period.setPreset} />
      {period.preset === 'custom' ? (
        <div className="flex items-center gap-2">
          <FormInput type="date" value={period.start} max={today} onChange={(e) => e.target.value && period.setStart(e.target.value)} />
          <span className="text-sm font-medium text-muted">to</span>
          <FormInput type="date" value={period.end} max={today} onChange={(e) => e.target.value && period.setEnd(e.target.value)} />
        </div>
      ) : null}
    </div>
  );
}
