'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { Card, PressableCard } from '@/components/card';
import { EmptyState } from '@/components/empty-state';
import { ListRow } from '@/components/list-row';
import { MessageBox } from '@/components/message-box';
import { Page, SectionLabel } from '@/components/page';
import { PeriodFilter } from '@/components/period-filter';
import { ScreenHeader } from '@/components/screen-header';
import { SkeletonRows } from '@/components/skeleton';
import { useFocusEffect } from '@/hooks/use-focus-effect';
import { usePeriod } from '@/hooks/use-period';
import { useBusinessAuth } from '@/lib/business-auth-context';
import { getDashboardStats, getRecentActivity } from '@/lib/dashboard-api';
import { getErrorMessage } from '@/lib/error-message';
import { formatDate, formatMoney } from '@/lib/format';
import { getReportSummary } from '@/lib/reports-api';
import { listLowStockItems, listLowStockProducts } from '@/lib/stock-reports-api';
import type { ActivityItem, DashboardStats } from '@/types/dashboard';
import type { ReportSummary } from '@/types/reports';
import { getMoneyPosition } from '@/lib/money-api';

export default function BusinessHomePage() {
  const router = useRouter();
  const { activeBusinessId, can } = useBusinessAuth();

  const period = usePeriod();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [periodSummary, setPeriodSummary] = useState<ReportSummary | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeBusinessId) return;
    try {
      const [statsData, activityData, lowStockItems, lowStockProducts] = await Promise.all([
        getDashboardStats(activeBusinessId),
        getRecentActivity(activeBusinessId),
        listLowStockItems(activeBusinessId),
        listLowStockProducts(activeBusinessId),
      ]);
      setStats(statsData);
      setActivity(activityData);
      setLowStockCount(lowStockItems.length + lowStockProducts.length);
      setLoadError(null);
    } catch (err) {
      setLoadError(getErrorMessage(err, 'Could not load your dashboard.'));
    }
  }, [activeBusinessId]);

  useFocusEffect(load);

  // Deliveries and payments for the chosen period. Re-runs whenever `stats`
  // reloads, so a refresh updates these figures too.
  useEffect(() => {
    if (!activeBusinessId) return;
    let active = true;
    getReportSummary(activeBusinessId, period.start, period.end)
      .then((data) => {
        if (active) setPeriodSummary(data);
      })
      .catch(() => {
        if (active) setPeriodSummary(null);
      });
    return () => {
      active = false;
    };
  }, [activeBusinessId, period.start, period.end, stats]);

  // Cash on hand, for members allowed to see money. Re-fetched with the stats.
  const canViewFinances = can('view_finances');
  const [cashTotal, setCashTotal] = useState<number | null>(null);
  useEffect(() => {
    if (!activeBusinessId || !canViewFinances) return;
    let active = true;
    getMoneyPosition(activeBusinessId)
      .then((position) => {
        if (active) setCashTotal(position.cash_total);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [activeBusinessId, canViewFinances, stats]);

  if (!activeBusinessId) return null;

  const statCards = stats
    ? [
        { label: 'Outstanding', value: stats.total_outstanding, tone: 'text-danger', filter: 'balance' as const, money: true },
        { label: 'Active shops', value: stats.active_shops_count, filter: 'active' as const },
        { label: 'Shops with balance', value: stats.shops_with_outstanding_balance_count, filter: 'balance' as const },
      ]
    : [];

  return (
    <>
      <ScreenHeader
        title="Overview"
        back
        primaryActions={[{ icon: 'refresh', label: 'Refresh', onPress: load }]}
      />
      <Page>
        {stats === null && !loadError ? <SkeletonRows count={5} avatar={false} /> : null}
        {loadError ? <MessageBox tone="danger" message={loadError} /> : null}

        {lowStockCount > 0 ? (
          <button type="button" className="block w-full text-left" onClick={() => router.push('/stock')}>
            <MessageBox
              tone="warning"
              message={`${lowStockCount} stock item${lowStockCount === 1 ? '' : 's'} at or below reorder level — tap to view`}
            />
          </button>
        ) : null}

        {stats ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            {statCards.map((card) => (
              <PressableCard key={card.label} onClick={() => router.push(`/shops?filter=${card.filter}`)}>
                <span className="block text-sm font-medium text-muted">{card.label}</span>
                <span
                  className={`mt-1 block truncate text-xl font-semibold leading-tight tabular-nums lg:text-[32px] ${card.tone ?? 'text-fg'}`}>
                  {card.money ? formatMoney(card.value) : card.value.toLocaleString()}
                </span>
              </PressableCard>
            ))}
          </div>
        ) : null}

        {canViewFinances && cashTotal !== null ? (
          <PressableCard onClick={() => router.push('/account/money')}>
            <span className="block text-sm font-medium text-muted">Cash on hand</span>
            <span className="mt-1 block truncate text-xl font-semibold leading-tight tabular-nums lg:text-[32px]">
              {formatMoney(cashTotal)}
            </span>
          </PressableCard>
        ) : null}

        <SectionLabel>Deliveries and payments</SectionLabel>
        <PeriodFilter period={period} />
        {periodSummary ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <Card>
              <span className="block text-sm font-medium text-muted">Stock value</span>
              <span className="mt-1 block truncate text-xl font-semibold leading-tight tabular-nums text-fg lg:text-[32px]">
                {formatMoney(periodSummary.total_stock_value)}
              </span>
            </Card>
            <Card>
              <span className="block text-sm font-medium text-muted">Payments</span>
              <span className="mt-1 block truncate text-xl font-semibold leading-tight tabular-nums text-success lg:text-[32px]">
                {formatMoney(periodSummary.total_payments_collected)}
              </span>
            </Card>
          </div>
        ) : null}

        <div className="grid gap-x-8 lg:grid-cols-2">
          {stats && stats.top_5_debtor_shops.length > 0 ? (
            <section>
              <SectionLabel className="mb-1">Top debtors</SectionLabel>
              {stats.top_5_debtor_shops.map((debtor) => (
                <ListRow
                  key={debtor.shop_id}
                  onClick={() => router.push(`/shops/${debtor.shop_id}`)}
                  title={debtor.shop_name}
                  trailingText={formatMoney(debtor.balance)}
                  trailingClassName="text-danger"
                />
              ))}
            </section>
          ) : null}

          <section>
            <SectionLabel className="mb-1">Recent activity</SectionLabel>
            {activity.length === 0 ? (
              <EmptyState
                icon="pulse-outline"
                title="No activity yet"
                message="Deliveries and payments you record will show up here."
              />
            ) : (
              activity.map((item) => (
                <ListRow
                  key={`${item.type}-${item.id}`}
                  onClick={() => router.push(`/shops/${item.shop_id}`)}
                  title={`${item.shop_name}${item.edited ? ' · Edited' : ''}${item.voided ? ' · Voided' : ''}`}
                  subtitle={`${item.type === 'delivery' ? 'Delivery' : 'Payment'} · ${item.description} · ${formatDate(item.date)}`}
                  trailingText={formatMoney(item.amount)}
                  trailingClassName={item.voided ? 'text-muted' : 'text-fg'}
                />
              ))
            )}
          </section>
        </div>
      </Page>
    </>
  );
}
