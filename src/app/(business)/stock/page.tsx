'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';

import { BackToTopButton } from '@/components/back-to-top-button';
import { Badge } from '@/components/badge';
import { ActionSheet } from '@/components/bottom-sheet';
import { Card } from '@/components/card';
import { EmptyState } from '@/components/empty-state';
import { Fab } from '@/components/fab';
import { ListRow } from '@/components/list-row';
import { MessageBox } from '@/components/message-box';
import { Page, SectionLabel } from '@/components/page';
import { ScreenHeader } from '@/components/screen-header';
import { SkeletonRows } from '@/components/skeleton';
import { useFocusEffect } from '@/hooks/use-focus-effect';
import { useBusinessAuth } from '@/lib/business-auth-context';
import { getErrorMessage } from '@/lib/error-message';
import { formatMoney } from '@/lib/format';
import { isFresh, useCachedState } from '@/lib/query-cache';
import { listStockItems } from '@/lib/stock-items-api';
import { getFinancialSummary, listLowStockProducts } from '@/lib/stock-reports-api';
import type { Product } from '@/types/catalog';
import type { FinancialSummary, StockItem } from '@/types/stock';

function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function monthStart(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export default function StockHomePage() {
  const router = useRouter();
  const { activeBusinessId } = useBusinessAuth();

  const [items, setItems] = useCachedState<StockItem[] | null>(activeBusinessId ? `stock-items:${activeBusinessId}` : null, null);
  const [lowStockProducts, setLowStockProducts] = useCachedState<Product[]>(
    activeBusinessId ? `stock-low-products:${activeBusinessId}` : null,
    [],
  );
  const summaryKey = activeBusinessId ? `stock-summary:${activeBusinessId}` : null;
  const [summary, setSummary] = useCachedState<FinancialSummary | null>(summaryKey, null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const load = useCallback(async () => {
    if (!activeBusinessId) return;
    try {
      const [itemsData, lowProducts, summaryData] = await Promise.all([
        listStockItems(activeBusinessId),
        listLowStockProducts(activeBusinessId),
        getFinancialSummary(activeBusinessId, toDateString(monthStart()), toDateString(new Date())),
      ]);
      setItems(itemsData);
      setLowStockProducts(lowProducts);
      setSummary(summaryData);
      setLoadError(null);
    } catch (err) {
      setLoadError(getErrorMessage(err, 'Could not load stock.'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBusinessId]);

  useFocusEffect(
    useCallback(() => {
      if (!isFresh(summaryKey)) load();
    }, [load, summaryKey]),
  );

  if (!activeBusinessId) return null;

  const lowStockItems = (items ?? []).filter((i) => i.is_low_stock);
  const activeItems = (items ?? []).filter((i) => i.is_active);
  const lowStockCount = lowStockItems.length + lowStockProducts.length;

  return (
    <>
      <ScreenHeader
        title="Stock"
        primaryActions={[{ icon: 'refresh', label: 'Refresh', onPress: load }]}
        overflowActions={[
          { icon: 'receipt-outline', label: 'Purchases', onPress: () => router.push('/stock/purchases') },
          { icon: 'construct-outline', label: 'Batches', onPress: () => router.push('/stock/batches') },
          { icon: 'wallet-outline', label: 'Expenses', onPress: () => router.push('/stock/expenses') },
        ]}
      />
      <Page>
        {items === null && !loadError ? <SkeletonRows /> : null}
        {loadError ? <MessageBox tone="danger" message={loadError} /> : null}

        {lowStockCount > 0 ? (
          <MessageBox tone="warning">
            <p className="text-sm font-bold text-warning">
              {lowStockCount} item{lowStockCount === 1 ? '' : 's'} at or below reorder level
            </p>
            {[...lowStockItems.map((i) => i.name), ...lowStockProducts.map((p) => p.name)].slice(0, 5).map((n) => (
              <p key={n} className="text-sm font-medium text-muted">
                {n}
              </p>
            ))}
          </MessageBox>
        ) : null}

        {summary ? (
          <>
            <SectionLabel>This month</SectionLabel>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                ['Purchases', summary.total_purchases],
                ['Batch costs', summary.total_batch_costs],
                ['Expenses', summary.total_expenses],
                ['Distribution revenue', summary.total_distribution_revenue],
              ].map(([label, value]) => (
                <Card key={label as string}>
                  <p className="text-sm font-medium text-muted">{label}</p>
                  <p className="text-sm font-bold tabular-nums">{formatMoney(value as number)}</p>
                </Card>
              ))}
            </div>
          </>
        ) : null}

        <SectionLabel>Raw materials &amp; packaging</SectionLabel>

        {items !== null && items.length === 0 ? (
          <EmptyState
            icon="cube-outline"
            title="No stock items yet"
            message="Add your first raw material or packaging item."
            actionLabel="Add stock item"
            onAction={() => router.push('/stock/items/new')}
          />
        ) : null}

        <div className="grid gap-2 lg:grid-cols-2">
          {activeItems.map((item) => (
            <div key={item.id} className="rounded-lg border border-line bg-surface px-4">
              <ListRow
                className="!border-b-0"
                onClick={() => router.push(`/stock/items/${item.id}/edit`)}
                title={item.name}
                subtitle={`${item.category === 'raw_material' ? 'Raw material' : 'Packaging'} · ${item.current_quantity.toLocaleString()} ${item.unit}`}
                trailing={item.is_low_stock ? <Badge label="Low stock" tone="warning" /> : undefined}
              />
            </div>
          ))}
        </div>
      </Page>
      <Fab label="Add" icon="add" onPress={() => setAddOpen(true)} />
      <ActionSheet
        visible={addOpen}
        onClose={() => setAddOpen(false)}
        actions={[
          { icon: 'cube-outline', label: 'Add stock item', onPress: () => router.push('/stock/items/new') },
          { icon: 'cart-outline', label: 'Record purchase', onPress: () => router.push('/stock/purchases/new') },
          { icon: 'construct-outline', label: 'New batch', onPress: () => router.push('/stock/batches/new') },
          { icon: 'wallet-outline', label: 'Add expense', onPress: () => router.push('/stock/expenses/new') },
        ]}
      />
      <BackToTopButton />
    </>
  );
}
