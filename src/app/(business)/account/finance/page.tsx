'use client';

import { useCallback, useState } from 'react';

import { Card } from '@/components/card';
import { ChipRow } from '@/components/chip-row';
import { ListRow } from '@/components/list-row';
import { MessageBox } from '@/components/message-box';
import { Page, SectionLabel } from '@/components/page';
import { PeriodFilter } from '@/components/period-filter';
import { ScreenHeader } from '@/components/screen-header';
import { SkeletonRows } from '@/components/skeleton';
import { useFocusEffect } from '@/hooks/use-focus-effect';
import { usePeriod } from '@/hooks/use-period';
import { useBusinessAuth } from '@/lib/business-auth-context';
import { getErrorMessage } from '@/lib/error-message';
import {
  financeAlerts,
  formatPercent,
  getFinancePosition,
  getFinanceTrend,
  getProfitAndLoss,
  grossMargin,
  type FinancePosition,
  type ProfitAndLoss,
  type TrendMonth,
} from '@/lib/finance-api';
import { formatDate, formatMoney } from '@/lib/format';

type Breakdown = 'products' | 'shops' | 'runs';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function monthLabel(value: string): string {
  const [y, m] = value.split('-').map(Number);
  return `${MONTHS[m - 1]} ${String(y).slice(2)}`;
}

function Row({ label, value, bold, tone }: { label: string; value: string; bold?: boolean; tone?: 'success' | 'danger' }) {
  const toneClass = tone === 'success' ? 'text-success' : tone === 'danger' ? 'text-danger' : '';
  return (
    <div className={`flex justify-between gap-2 text-sm ${bold ? 'font-bold' : ''}`}>
      <span className={bold ? '' : 'text-muted'}>{label}</span>
      <span className={`tabular-nums ${toneClass}`}>{value}</span>
    </div>
  );
}

export default function FinancePage() {
  const { activeBusinessId } = useBusinessAuth();
  const period = usePeriod();

  const [position, setPosition] = useState<FinancePosition | null>(null);
  const [pnl, setPnl] = useState<ProfitAndLoss | null>(null);
  const [trend, setTrend] = useState<TrendMonth[]>([]);
  const [breakdown, setBreakdown] = useState<Breakdown>('products');
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeBusinessId) return;
    try {
      const [positionData, pnlData, trendData] = await Promise.all([
        getFinancePosition(activeBusinessId),
        getProfitAndLoss(activeBusinessId, period.start, period.end),
        getFinanceTrend(activeBusinessId, 12),
      ]);
      setPosition(positionData);
      setPnl(pnlData);
      setTrend(trendData);
      setLoadError(null);
    } catch (err) {
      setLoadError(getErrorMessage(err, 'Could not load your finances.'));
    }
  }, [activeBusinessId, period.start, period.end]);

  useFocusEffect(load);

  if (!activeBusinessId) return null;

  const alerts = position && pnl ? financeAlerts(position, pnl, trend) : [];
  const largest = Math.max(1, ...trend.map((m) => Math.abs(m.net_profit)));
  const empty =
    !!pnl &&
    ((breakdown === 'products' && pnl.products.length === 0) ||
      (breakdown === 'shops' && pnl.shops.length === 0) ||
      (breakdown === 'runs' && pnl.production_runs.length === 0));

  return (
    <>
      <ScreenHeader title="Profit & finances" back primaryActions={[{ icon: 'refresh', label: 'Refresh', onPress: load }]} />
      <Page narrow>
        {position === null && !loadError ? <SkeletonRows count={6} avatar={false} /> : null}
        {loadError ? <MessageBox tone="danger" message={loadError} /> : null}

        {alerts.map((alert) => (
          <MessageBox key={alert.message} tone={alert.tone} message={alert.message} />
        ))}

        {position ? (
          <>
            <SectionLabel>Where the business stands today</SectionLabel>
            <Card className="space-y-2">
              <Row label="Cash on hand" value={formatMoney(position.cash_total)} />
              <Row label="Owed to you by shops" value={formatMoney(position.owed_to_business)} />
              <Row label="Raw materials and packaging (at cost)" value={formatMoney(position.raw_stock_value)} />
              <Row label="Finished goods (at cost)" value={formatMoney(position.finished_stock_value)} />
              <Row label="Owed to suppliers" value={`-${formatMoney(position.owed_to_suppliers)}`} />
              <div className="border-t border-line pt-2">
                <Row
                  label="Working capital"
                  value={formatMoney(position.working_capital)}
                  bold
                  tone={position.working_capital >= 0 ? 'success' : 'danger'}
                />
              </div>
            </Card>
            <p className="text-sm font-medium text-muted">
              Working capital is what the business could turn into cash soon, minus what it owes.
            </p>
          </>
        ) : null}

        <SectionLabel>Profit</SectionLabel>
        <PeriodFilter period={period} />

        {pnl ? (
          <Card className="space-y-2">
            <Row label="Sales" value={formatMoney(pnl.sales)} />
            {pnl.discounts > 0 ? <Row label="Discounts given (already taken off sales)" value={formatMoney(pnl.discounts)} /> : null}
            {pnl.uncosted_sales > 0 ? (
              <Row label="Sales without a recorded cost (left out)" value={`-${formatMoney(pnl.uncosted_sales)}`} />
            ) : null}
            <Row label="Cost of goods sold" value={`-${formatMoney(pnl.cost_of_sales)}`} />
            <Row
              label={`Gross profit (${formatPercent(grossMargin(pnl.costed_sales, pnl.gross_profit))} margin)`}
              value={formatMoney(pnl.gross_profit)}
              bold
            />
            <Row label="Expenses" value={`-${formatMoney(pnl.expenses)}`} />
            {pnl.write_offs > 0 ? <Row label="Damaged or spoiled stock" value={`-${formatMoney(pnl.write_offs)}`} /> : null}
            <div className="border-t border-line pt-2">
              <Row label="Net profit" value={formatMoney(pnl.net_profit)} bold tone={pnl.net_profit >= 0 ? 'success' : 'danger'} />
            </div>
          </Card>
        ) : null}

        {trend.length > 0 ? (
          <>
            <SectionLabel>Last 12 months</SectionLabel>
            <Card className="space-y-2">
              {trend.map((month) => (
                <div key={month.month_start} className="flex items-center gap-3 text-sm">
                  <span className="w-14 shrink-0">{monthLabel(month.month_start)}</span>
                  <span className="h-2 flex-1">
                    <span
                      className={`block h-2 rounded-full ${month.net_profit >= 0 ? 'bg-success' : 'bg-danger'}`}
                      style={{ width: `${(Math.abs(month.net_profit) / largest) * 100}%` }}
                    />
                  </span>
                  <span className="min-w-[10rem] text-right">
                    <span className={`block font-bold tabular-nums ${month.net_profit >= 0 ? 'text-success' : 'text-danger'}`}>
                      {formatMoney(month.net_profit)}
                    </span>
                    <span className="block tabular-nums text-muted">
                      sales {formatMoney(month.sales)}
                      {month.cash_at_end !== null ? ` · cash ${formatMoney(month.cash_at_end)}` : ''}
                    </span>
                  </span>
                </div>
              ))}
            </Card>
            <p className="text-sm font-medium text-muted">
              Bars show net profit. Cash appears from the starting date of your money accounts.
            </p>
          </>
        ) : null}

        {pnl ? (
          <>
            <SectionLabel>Breakdown</SectionLabel>
            <ChipRow
              options={[
                { value: 'products', label: 'Products' },
                { value: 'shops', label: 'Shops' },
                { value: 'runs', label: 'Production runs' },
              ]}
              value={breakdown}
              onChange={setBreakdown}
            />
            <div>
              {breakdown === 'products'
                ? pnl.products.map((p) => (
                    <ListRow
                      key={p.id}
                      title={p.name}
                      subtitle={`${p.quantity.toLocaleString()} ${p.unit} sold · ${formatMoney(p.sales)} sales · ${formatPercent(grossMargin(p.costed_sales, p.gross_profit))} margin`}
                      trailingText={formatMoney(p.gross_profit)}
                      trailingClassName={p.gross_profit >= 0 ? 'text-success' : 'text-danger'}
                    />
                  ))
                : null}
              {breakdown === 'shops'
                ? pnl.shops.map((s) => (
                    <ListRow
                      key={s.id}
                      title={s.name}
                      subtitle={`${formatMoney(s.sales)} sales · owes ${formatMoney(Math.max(0, s.outstanding))}`}
                      trailingText={formatMoney(s.gross_profit)}
                      trailingClassName={s.gross_profit >= 0 ? 'text-success' : 'text-danger'}
                    />
                  ))
                : null}
              {breakdown === 'runs'
                ? pnl.production_runs.map((r) => (
                    <ListRow
                      key={r.id}
                      title={`${r.name} · ${r.product_name}`}
                      subtitle={`${formatDate(r.production_date)} · made ${r.made.toLocaleString()} ${r.unit}, sold ${r.sold.toLocaleString()} · cost ${formatMoney(r.unit_cost ?? 0)} each`}
                      trailingText={formatMoney(r.gross_profit)}
                      trailingClassName={r.gross_profit >= 0 ? 'text-success' : 'text-danger'}
                    />
                  ))
                : null}
            </div>
            {empty ? <p className="text-sm font-medium text-muted">Nothing in this period.</p> : null}
          </>
        ) : null}
      </Page>
    </>
  );
}
