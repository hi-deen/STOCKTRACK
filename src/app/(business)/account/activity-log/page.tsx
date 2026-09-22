'use client';

import { useCallback, useRef, useState } from 'react';

import { BackToTopButton } from '@/components/back-to-top-button';
import { EmptyState } from '@/components/empty-state';
import { Field, FormInput } from '@/components/form-input';
import { ListRow } from '@/components/list-row';
import { MessageBox } from '@/components/message-box';
import { Page } from '@/components/page';
import { PrimaryButton } from '@/components/primary-button';
import { ScreenHeader } from '@/components/screen-header';
import { SkeletonRows } from '@/components/skeleton';
import { useFocusEffect } from '@/hooks/use-focus-effect';
import { AUDIT_FILTER_GROUPS, formatAuditAction, listAuditLog, listAuditLogAll } from '@/lib/audit-log-api';
import { useBusinessAuth } from '@/lib/business-auth-context';
import { buildCsv } from '@/lib/csv-export';
import { getErrorMessage } from '@/lib/error-message';
import { formatDate, toDateString } from '@/lib/format';
import { PDF_ROW_WARNING_THRESHOLD, exportHtmlAsPdf } from '@/lib/pdf-export';
import { buildReportHtml } from '@/lib/pdf-templates';
import { shareTextFile } from '@/lib/share-file';
import type { AuditLogEntry } from '@/types/audit';

function defaultStartDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 29);
  return toDateString(d);
}

export default function ActivityLogPage() {
  const { activeBusinessId } = useBusinessAuth();

  const [startDateStr, setStartDateStr] = useState(defaultStartDate);
  const [endDateStr, setEndDateStr] = useState(() => toDateString(new Date()));
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());

  const [entries, setEntries] = useState<AuditLogEntry[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const pageRef = useRef(0);

  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const rangeValid = /^\d{4}-\d{2}-\d{2}$/.test(startDateStr) && /^\d{4}-\d{2}-\d{2}$/.test(endDateStr) && startDateStr <= endDateStr;

  const activeActions =
    selectedGroups.size === 0
      ? undefined
      : AUDIT_FILTER_GROUPS.filter((g) => selectedGroups.has(g.label)).flatMap((g) => g.actions);

  // Always (re)starts from page 0 — a fresh load, a refresh, or any filter
  // change all mean "restart pagination," not "append."
  const load = useCallback(async () => {
    if (!activeBusinessId || !rangeValid) return;
    try {
      const result = await listAuditLog(
        activeBusinessId,
        { startDate: startDateStr, endDate: endDateStr, actions: activeActions },
        0,
      );
      pageRef.current = 0;
      setEntries(result.entries);
      setHasMore(result.hasMore);
      setLoadError(null);
    } catch (err) {
      setLoadError(getErrorMessage(err, 'Could not load the activity log.'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBusinessId, startDateStr, endDateStr, selectedGroups, rangeValid]);

  useFocusEffect(load);

  async function handleLoadMore() {
    if (!activeBusinessId || !hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      const nextPage = pageRef.current + 1;
      const result = await listAuditLog(
        activeBusinessId,
        { startDate: startDateStr, endDate: endDateStr, actions: activeActions },
        nextPage,
      );
      pageRef.current = nextPage;
      setEntries((prev) => [...(prev ?? []), ...result.entries]);
      setHasMore(result.hasMore);
    } catch (err) {
      setLoadError(getErrorMessage(err, 'Could not load more activity.'));
    } finally {
      setLoadingMore(false);
    }
  }

  function toggleGroup(label: string) {
    setSelectedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  const columns = ['Date', 'Action', 'Target', 'Actor'];
  function toRows(list: AuditLogEntry[]) {
    return list.map((e) => [
      new Date(e.created_at).toLocaleString(),
      formatAuditAction(e.action),
      e.target_label ?? e.target_type,
      e.actor_label ?? e.actor_type,
    ]);
  }

  // Exports always cover the complete filtered range, independent of how much
  // the on-screen list has paged in.
  async function fetchAll() {
    return listAuditLogAll(activeBusinessId as string, {
      startDate: startDateStr,
      endDate: endDateStr,
      actions: activeActions,
    });
  }

  async function handleExportPdf() {
    if (!activeBusinessId) return;
    setExportError(null);
    setExportingPdf(true);
    try {
      const html = buildReportHtml({
        title: 'Activity log',
        subtitle: `${startDateStr} to ${endDateStr}`,
        columns,
        rows: toRows(await fetchAll()),
        generatedAt: new Date().toLocaleString(),
      });
      await exportHtmlAsPdf(html, `activity-log-${startDateStr}-to-${endDateStr}.pdf`);
    } catch (err) {
      setExportError(getErrorMessage(err, 'Could not export the activity log.'));
    } finally {
      setExportingPdf(false);
    }
  }

  async function handleExportCsv() {
    if (!activeBusinessId) return;
    setExportError(null);
    setExportingCsv(true);
    try {
      const csv = buildCsv(columns, toRows(await fetchAll()));
      await shareTextFile(`activity-log-${startDateStr}-to-${endDateStr}.csv`, csv, 'text/csv');
    } catch (err) {
      setExportError(getErrorMessage(err, 'Could not export the activity log.'));
    } finally {
      setExportingCsv(false);
    }
  }

  if (!activeBusinessId) return null;

  return (
    <>
      <ScreenHeader title="Activity log" back primaryActions={[{ icon: 'refresh', label: 'Refresh', onPress: load }]} />
      <Page narrow>
        <div className="grid grid-cols-2 gap-3">
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

        <div className="flex flex-wrap gap-2">
          {AUDIT_FILTER_GROUPS.map((group) => {
            const active = selectedGroups.has(group.label);
            return (
              <button
                key={group.label}
                type="button"
                aria-pressed={active}
                onClick={() => toggleGroup(group.label)}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                  active ? 'border-primary bg-primary text-on-primary' : 'border-line text-muted hover:bg-primary-soft'
                }`}>
                {group.label}
              </button>
            );
          })}
        </div>

        {entries === null && !loadError ? <SkeletonRows count={6} /> : null}
        {loadError ? <MessageBox tone="danger" message={loadError} /> : null}

        {entries !== null && entries.length > 0 ? (
          <>
            <div className="flex gap-2">
              <PrimaryButton label="Export PDF" variant="outline" onClick={handleExportPdf} loading={exportingPdf} />
              <PrimaryButton label="Export CSV" variant="outline" onClick={handleExportCsv} loading={exportingCsv} />
            </div>
            {hasMore || entries.length > PDF_ROW_WARNING_THRESHOLD ? (
              <p className="text-sm font-medium text-muted">
                This range has {hasMore ? `${entries.length}+` : entries.length} entries — export covers the full range, not
                just what&apos;s loaded on-screen, so PDF export may take a moment. Consider CSV for very large ranges.
              </p>
            ) : null}
            {exportError ? <MessageBox tone="danger" message={exportError} /> : null}
          </>
        ) : null}

        {entries !== null && entries.length === 0 ? (
          <EmptyState
            icon="document-text-outline"
            title="No activity in this range"
            message="Try a wider date range or clear the filters."
          />
        ) : null}

        <div>
          {(entries ?? []).map((entry) => (
            <ListRow
              key={entry.id}
              title={entry.target_label ?? entry.target_type}
              subtitle={`${formatAuditAction(entry.action)} · ${entry.actor_label ?? entry.actor_type} · ${formatDate(entry.created_at)} ${new Date(entry.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
            />
          ))}
        </div>

        {hasMore ? <PrimaryButton label="Load more" variant="outline" onClick={handleLoadMore} loading={loadingMore} /> : null}
      </Page>
      <BackToTopButton />
    </>
  );
}
