'use client';

import { useCallback, useState } from 'react';

import { BackToTopButton } from '@/components/back-to-top-button';
import { Card } from '@/components/card';
import { EmptyState } from '@/components/empty-state';
import { Field, FormInput } from '@/components/form-input';
import { ListRow } from '@/components/list-row';
import { MessageBox } from '@/components/message-box';
import { Page, SectionLabel } from '@/components/page';
import { ScreenHeader } from '@/components/screen-header';
import { ShowMoreControls } from '@/components/show-more-controls';
import { SkeletonRows } from '@/components/skeleton';
import { useFocusEffect } from '@/hooks/use-focus-effect';
import { useBusinessAuth } from '@/lib/business-auth-context';
import { buildCsv } from '@/lib/csv-export';
import { getErrorMessage } from '@/lib/error-message';
import { formatDate, formatMoney, toDateString } from '@/lib/format';
import { PDF_ROW_WARNING_THRESHOLD, exportHtmlAsPdf } from '@/lib/pdf-export';
import { buildReportHtml } from '@/lib/pdf-templates';
import { getActivityInRange, getReportSummary } from '@/lib/reports-api';
import { shareTextFile } from '@/lib/share-file';
import type { ActivityLogEntry, ReportSummary } from '@/types/reports';

const ACTIVITY_INITIAL = 10;
const ACTIVITY_STEP = 20;

function defaultStartDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 29);
  return toDateString(d);
}

export default function ReportsPage() {
  const { activeBusinessId } = useBusinessAuth();

  const [startDateStr, setStartDateStr] = useState(defaultStartDate);
  const [endDateStr, setEndDateStr] = useState(() => toDateString(new Date()));

  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [activity, setActivity] = useState<ActivityLogEntry[] | null>(null);
  const [visibleActivity, setVisibleActivity] = useState(ACTIVITY_INITIAL);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const rangeValid = /^\d{4}-\d{2}-\d{2}$/.test(startDateStr) && /^\d{4}-\d{2}-\d{2}$/.test(endDateStr) && startDateStr <= endDateStr;

  const load = useCallback(async () => {
    if (!activeBusinessId || !rangeValid) return;
    try {
      const [summaryData, activityData] = await Promise.all([
        getReportSummary(activeBusinessId, startDateStr, endDateStr),
        getActivityInRange(activeBusinessId, startDateStr, endDateStr),
      ]);
      setSummary(summaryData);
      setActivity(activityData);
      setVisibleActivity(ACTIVITY_INITIAL);
      setLoadError(null);
    } catch (err) {
      setLoadError(getErrorMessage(err, 'Could not load this report.'));
    }
  }, [activeBusinessId, startDateStr, endDateStr, rangeValid]);

  useFocusEffect(load);

  const activityColumns = ['Date', 'Type', 'Shop', 'Description', 'Amount'];
  const activityRows = (activity ?? []).map((entry) => [
    entry.entry_date,
    entry.entry_type === 'delivery' ? 'Delivery' : 'Payment',
    entry.shop_name ?? 'Unknown shop',
    entry.description,
    entry.amount.toLocaleString(),
  ]);

  async function handleExportPdf() {
    if (!summary) return;
    setExportError(null);
    setExportingPdf(true);
    try {
      const html = buildReportHtml({
        title: 'Report',
        subtitle: `${startDateStr} to ${endDateStr}`,
        statCards: [
          { label: 'Stock delivered', value: summary.total_stock_value.toLocaleString() },
          { label: 'Payments collected', value: summary.total_payments_collected.toLocaleString() },
          { label: 'Net change', value: summary.net_outstanding_change.toLocaleString() },
          { label: 'Deliveries', value: String(summary.delivery_count) },
          { label: 'Payments', value: String(summary.payment_count) },
          { label: 'Shops visited', value: String(summary.unique_shops_visited) },
        ],
        columns: activityColumns,
        rows: activityRows,
        generatedAt: new Date().toLocaleString(),
      });
      await exportHtmlAsPdf(html, `report-${startDateStr}-to-${endDateStr}.pdf`);
    } catch (err) {
      setExportError(getErrorMessage(err, 'Could not export this report.'));
    } finally {
      setExportingPdf(false);
    }
  }

  async function handleExportCsv() {
    setExportError(null);
    setExportingCsv(true);
    try {
      await shareTextFile(`report-${startDateStr}-to-${endDateStr}.csv`, buildCsv(activityColumns, activityRows), 'text/csv');
    } catch (err) {
      setExportError(getErrorMessage(err, 'Could not export this report.'));
    } finally {
      setExportingCsv(false);
    }
  }

  if (!activeBusinessId) return null;

  const statCards = summary
    ? [
        { label: 'Stock delivered', value: summary.total_stock_value, money: true, tone: '' },
        { label: 'Payments collected', value: summary.total_payments_collected, money: true, tone: 'text-success' },
        {
          label: 'Net change',
          value: summary.net_outstanding_change,
          money: true,
          tone: summary.net_outstanding_change > 0 ? 'text-danger' : 'text-success',
        },
        { label: 'Deliveries', value: summary.delivery_count, tone: '' },
        { label: 'Payments', value: summary.payment_count, tone: '' },
        { label: 'Shops visited', value: summary.unique_shops_visited, tone: '' },
      ]
    : [];

  return (
    <>
      <ScreenHeader
        title="Reports"
        primaryActions={[
          {
            icon: 'document-text-outline',
            label: 'Export PDF',
            onPress: handleExportPdf,
            disabled: !activity || activity.length === 0 || exportingPdf,
          },
          {
            icon: 'grid-outline',
            label: 'Export CSV',
            onPress: handleExportCsv,
            disabled: !activity || activity.length === 0 || exportingCsv,
          },
          { icon: 'refresh', label: 'Refresh', onPress: load },
        ]}
      />
      <Page>
        <div className="grid max-w-md grid-cols-2 gap-3">
          <Field label="From">
            <FormInput type="date" value={startDateStr} max={endDateStr} onChange={(e) => setStartDateStr(e.target.value)} />
          </Field>
          <Field label="To">
            <FormInput
              type="date"
              value={endDateStr}
              min={startDateStr}
              max={toDateString(new Date())}
              onChange={(e) => setEndDateStr(e.target.value)}
            />
          </Field>
        </div>

        {summary === null && !loadError ? <SkeletonRows count={5} avatar={false} /> : null}
        {loadError ? <MessageBox tone="danger" message={loadError} /> : null}

        {summary ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            {statCards.map((card) => (
              <Card key={card.label}>
                <p className="text-sm font-medium text-muted">{card.label}</p>
                <p className={`mt-1 truncate text-xl font-semibold leading-tight tabular-nums lg:text-[32px] ${card.tone}`}>
                  {card.money ? formatMoney(card.value) : card.value}
                </p>
              </Card>
            ))}
          </div>
        ) : null}

        <SectionLabel>Activity</SectionLabel>

        {activity !== null && activity.length > 0 ? (
          <>
            {activity.length > PDF_ROW_WARNING_THRESHOLD ? (
              <p className="text-sm font-medium text-muted">
                This range has {activity.length} entries — PDF export may take a moment. Consider CSV for very large ranges.
              </p>
            ) : null}
            {exportError ? <MessageBox tone="danger" message={exportError} /> : null}
          </>
        ) : null}

        {activity !== null && activity.length === 0 ? (
          <EmptyState icon="stats-chart-outline" title="No activity in this range" message="Try a wider date range." />
        ) : null}

        <div>
          {(activity ?? []).slice(0, visibleActivity).map((entry, index) => (
            <ListRow
              key={`${entry.entry_type}-${entry.shop_id}-${index}`}
              title={entry.shop_name ?? 'Unknown shop'}
              subtitle={`${entry.entry_type === 'delivery' ? 'Delivery' : 'Payment'} · ${entry.description} · ${formatDate(entry.entry_date)}`}
              trailingText={formatMoney(entry.amount)}
            />
          ))}
        </div>
        {activity !== null && activity.length > visibleActivity ? (
          <ShowMoreControls
            onShowMore={() => setVisibleActivity((n) => n + ACTIVITY_STEP)}
            showMoreLabel={`Show ${Math.min(ACTIVITY_STEP, activity.length - visibleActivity)} more`}
            onOpenAll={() => setVisibleActivity(activity.length)}
            openAllLabel={`Show all ${activity.length}`}
          />
        ) : null}
      </Page>
      <BackToTopButton />
    </>
  );
}
