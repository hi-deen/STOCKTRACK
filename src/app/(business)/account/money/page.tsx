'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';

import { Card, PressableCard } from '@/components/card';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { EmptyState } from '@/components/empty-state';
import { Fab } from '@/components/fab';
import { ListRow } from '@/components/list-row';
import { MessageBox } from '@/components/message-box';
import { Page, SectionLabel } from '@/components/page';
import { PeriodFilter } from '@/components/period-filter';
import { PrimaryButton } from '@/components/primary-button';
import { ScreenHeader } from '@/components/screen-header';
import { SkeletonRows } from '@/components/skeleton';
import { useToast } from '@/components/toast';
import { useFocusEffect } from '@/hooks/use-focus-effect';
import { usePeriod } from '@/hooks/use-period';
import { useBusinessAuth } from '@/lib/business-auth-context';
import { getErrorMessage } from '@/lib/error-message';
import { formatDate, formatMoney } from '@/lib/format';
import {
  deleteMoneyMovement,
  entryLabel,
  getMoneyLedger,
  getMoneyPosition,
  getMoneySummary,
  isMoneyMovement,
  type LedgerEntry,
  type MoneyPosition,
  type MoneySummary,
} from '@/lib/money-api';

export default function MoneyPage() {
  const router = useRouter();
  const toast = useToast();
  const { activeBusinessId, can } = useBusinessAuth();
  const canManage = can('manage_money');
  const period = usePeriod();

  const [position, setPosition] = useState<MoneyPosition | null>(null);
  const [summary, setSummary] = useState<MoneySummary | null>(null);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<LedgerEntry | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!activeBusinessId) return;
    try {
      const [positionData, summaryData, ledgerData] = await Promise.all([
        getMoneyPosition(activeBusinessId),
        getMoneySummary(activeBusinessId, period.start, period.end),
        getMoneyLedger(activeBusinessId, period.start, period.end),
      ]);
      setPosition(positionData);
      setSummary(summaryData);
      setEntries(ledgerData);
      setLoadError(null);
    } catch (err) {
      setLoadError(getErrorMessage(err, 'Could not load your money.'));
    }
  }, [activeBusinessId, period.start, period.end]);

  useFocusEffect(load);

  async function runDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await deleteMoneyMovement(toDelete.reference_id);
      setToDelete(null);
      toast.show('Entry deleted');
      await load();
    } catch (err) {
      setLoadError(getErrorMessage(err, 'Could not delete this entry.'));
    } finally {
      setDeleting(false);
    }
  }

  if (!activeBusinessId) return null;

  const needsSetup = !!position && position.accounts.every((a) => a.opening_balance === 0);
  const summaryRows: [string, number][] = summary
    ? [
        ['Shop payments', summary.shop_payments],
        ['Owner capital and loans', summary.capital_in + summary.loans_in],
        ['Other income', summary.other_income],
        ['Purchases paid', -summary.purchases],
        ['Expenses and other spending', -summary.expenses],
        ['Withdrawals and loan repayments', -(summary.withdrawals + summary.loan_repayments)],
        ['Cash count differences', summary.adjustments],
      ]
    : [];
  const tone = (value: number) => (value > 0 ? 'text-success' : value < 0 ? 'text-danger' : 'text-muted');

  return (
    <>
      <ScreenHeader title="Money" back primaryActions={[{ icon: 'refresh', label: 'Refresh', onPress: load }]} />
      <Page narrow>
        {position === null && !loadError ? <SkeletonRows count={4} avatar={false} /> : null}
        {loadError ? <MessageBox tone="danger" message={loadError} /> : null}

        {needsSetup && canManage ? (
          <MessageBox tone="warning">
            <p className="text-sm font-bold">Set your starting balances</p>
            <p className="text-sm font-medium text-muted">
              Enter how much is in Cash and in the Bank today, so the app can track it from here.
            </p>
            <div className="pt-2">
              <PrimaryButton label="Set balances" variant="outline" onClick={() => router.push('/account/money/balances')} />
            </div>
          </MessageBox>
        ) : null}

        {position ? (
          <>
            <Card className="space-y-1">
              <p className="text-sm font-medium text-muted">Cash on hand</p>
              <p className="text-3xl font-bold tabular-nums">{formatMoney(position.cash_total)}</p>
              {position.accounts.map((account) => (
                <button
                  key={account.id}
                  type="button"
                  disabled={!canManage}
                  onClick={() => router.push('/account/money/balances')}
                  className="flex w-full justify-between py-1 text-left">
                  <span className="text-muted">{account.name}</span>
                  <span className="text-sm font-bold tabular-nums">{formatMoney(account.balance)}</span>
                </button>
              ))}
            </Card>

            <div className="grid grid-cols-2 gap-3">
              <Card>
                <p className="text-sm font-medium text-muted">Owed to you</p>
                <p className="text-sm font-bold tabular-nums text-success">{formatMoney(position.owed_to_business)}</p>
              </Card>
              <PressableCard onClick={() => router.push('/stock/purchases')}>
                <p className="text-sm font-medium text-muted">Owed to suppliers</p>
                <p className="text-sm font-bold tabular-nums text-danger">{formatMoney(position.owed_to_suppliers)}</p>
              </PressableCard>
            </div>
          </>
        ) : null}

        <PrimaryButton label="See profit & finances" variant="outline" onClick={() => router.push('/account/finance')} />

        <SectionLabel>Money in and out</SectionLabel>
        <PeriodFilter period={period} />

        {summary ? (
          <Card className="space-y-2">
            {summaryRows.map(([label, value]) => (
              <div key={label} className="flex justify-between gap-2 text-sm">
                <span className="text-muted">{label}</span>
                <span className={`tabular-nums ${tone(value)}`}>{formatMoney(value)}</span>
              </div>
            ))}
            <div className="flex justify-between gap-2 border-t border-line pt-2 text-sm font-bold">
              <span>Net change</span>
              <span className={`tabular-nums ${summary.net_change >= 0 ? 'text-success' : 'text-danger'}`}>
                {formatMoney(summary.net_change)}
              </span>
            </div>
          </Card>
        ) : null}

        <SectionLabel>Entries</SectionLabel>
        {summary && entries.length === 0 ? (
          <EmptyState icon="wallet-outline" title="No money movements" message="Nothing moved in or out in this period." />
        ) : null}
        <div>
          {entries.map((entry) => {
            const deletable = canManage && isMoneyMovement(entry.kind);
            return (
              <ListRow
                key={`${entry.kind}-${entry.reference_id}-${entry.account_id}`}
                onClick={deletable ? () => setToDelete(entry) : undefined}
                title={entry.description || entryLabel(entry.kind)}
                subtitle={`${entryLabel(entry.kind)} · ${entry.account_name} · ${formatDate(entry.entry_date)}`}
                trailingText={`${entry.amount > 0 ? '+' : ''}${formatMoney(entry.amount)}`}
                trailingClassName={entry.amount > 0 ? 'text-success' : 'text-danger'}
              />
            );
          })}
        </div>
      </Page>
      {canManage ? <Fab label="Record money" onPress={() => router.push('/account/money/record')} /> : null}
      <ConfirmDialog
        visible={!!toDelete}
        title="Delete this entry?"
        message={toDelete ? `${entryLabel(toDelete.kind)} of ${formatMoney(Math.abs(toDelete.amount))}` : undefined}
        confirmLabel="Delete"
        destructive
        loading={deleting}
        onConfirm={runDelete}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}
