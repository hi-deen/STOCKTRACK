'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';

import { BackToTopButton } from '@/components/back-to-top-button';
import { Badge } from '@/components/badge';
import { ActionSheet } from '@/components/bottom-sheet';
import { Card, PressableCard } from '@/components/card';
import { ChipRow } from '@/components/chip-row';
import { EmptyState } from '@/components/empty-state';
import { Fab } from '@/components/fab';
import { FormInput } from '@/components/form-input';
import { Icon } from '@/components/icon';
import { ListRow } from '@/components/list-row';
import { MessageBox } from '@/components/message-box';
import { Page, SectionLabel } from '@/components/page';
import { PeriodFilter } from '@/components/period-filter';
import { ScreenHeader } from '@/components/screen-header';
import { SkeletonRows } from '@/components/skeleton';
import { StockLevelBar } from '@/components/stock-level-bar';
import { useFocusEffect } from '@/hooks/use-focus-effect';
import { usePeriod } from '@/hooks/use-period';
import { useBusinessAuth } from '@/lib/business-auth-context';
import { getErrorMessage } from '@/lib/error-message';
import { formatMoney } from '@/lib/format';
import { isFresh, useCachedState } from '@/lib/query-cache';
import { listStockItems } from '@/lib/stock-items-api';
import { getFinancialSummary, listLowStockProducts } from '@/lib/stock-reports-api';
import type { Product } from '@/types/catalog';
import type { FinancialSummary, StockItem, StockItemCategory } from '@/types/stock';

export default function StockHomePage() {
  const router = useRouter();
  const { activeBusinessId, can } = useBusinessAuth();
  const period = usePeriod();

  const [items, setItems] = useCachedState<StockItem[] | null>(activeBusinessId ? `stock-items:${activeBusinessId}` : null, null);
  const [lowStockProducts, setLowStockProducts] = useCachedState<Product[]>(
    activeBusinessId ? `stock-low-products:${activeBusinessId}` : null,
    [],
  );
  const summaryKey = activeBusinessId ? `stock-summary:${activeBusinessId}:${period.start}:${period.end}` : null;
  const [summary, setSummary] = useCachedState<FinancialSummary | null>(summaryKey, null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [itemSheetOpen, setItemSheetOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<StockItem | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<'all' | StockItemCategory>('all');

  const load = useCallback(async () => {
    if (!activeBusinessId) return;
    try {
      const [itemsData, lowProducts, summaryData] = await Promise.all([
        listStockItems(activeBusinessId),
        listLowStockProducts(activeBusinessId),
        getFinancialSummary(activeBusinessId, period.start, period.end),
      ]);
      setItems(itemsData);
      setLowStockProducts(lowProducts);
      setSummary(summaryData);
      setLoadError(null);
    } catch (err) {
      setLoadError(getErrorMessage(err, 'Could not load stock.'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBusinessId, period.start, period.end]);

  useFocusEffect(
    useCallback(() => {
      if (!isFresh(summaryKey)) load();
    }, [load, summaryKey]),
  );

  if (!activeBusinessId) return null;

  const lowStockItems = (items ?? []).filter((i) => i.is_low_stock);
  const activeItems = (items ?? []).filter((i) => i.is_active);
  const lowStockCount = lowStockItems.length + lowStockProducts.length;
  const searchText = search.trim().toLowerCase();
  const visibleItems = activeItems.filter(
    (i) => (category === 'all' || i.category === category) && (searchText === '' || i.name.toLowerCase().includes(searchText)),
  );

  function openItemSheet(item: StockItem) {
    setSelectedItem(item);
    setItemSheetOpen(true);
  }

  return (
    <>
      <ScreenHeader
        title="Stock"
        primaryActions={[{ icon: 'refresh', label: 'Refresh', onPress: load }]}
      />
      <Page>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              { label: 'Purchases', icon: 'receipt-outline', tone: 'bg-primary-soft text-primary', href: '/stock/purchases' },
              { label: 'Production runs', icon: 'construct-outline', tone: 'bg-success-soft text-success', href: '/stock/batches' },
              { label: 'Expenses', icon: 'wallet-outline', tone: 'bg-warning-soft text-warning', href: '/stock/expenses' },
            ] as const
          ).map((tile) => (
            <PressableCard key={tile.label} onClick={() => router.push(tile.href)} className="text-center">
              <span className={`mx-auto mb-1 flex h-10 w-10 items-center justify-center rounded-full ${tile.tone}`}>
                <Icon name={tile.icon} size={22} />
              </span>
              <span className="block text-sm font-bold">{tile.label}</span>
            </PressableCard>
          ))}
        </div>

        {items === null && !loadError ? <SkeletonRows /> : null}
        {loadError ? <MessageBox tone="danger" message={loadError} /> : null}

        {lowStockCount > 0 ? (
          <MessageBox tone="warning">
            <p className="text-sm font-bold text-warning">
              {lowStockCount} item{lowStockCount === 1 ? '' : 's'} at or below reorder level
            </p>
            {lowStockItems.slice(0, 5).map((item) => (
              <button key={item.id} type="button" onClick={() => openItemSheet(item)} className="flex w-full justify-between text-sm font-medium text-muted">
                <span>{item.name}</span>
                <span className="font-bold text-warning">Restock</span>
              </button>
            ))}
            {lowStockProducts.slice(0, Math.max(0, 5 - lowStockItems.length)).map((product) => (
              <p key={product.id} className="text-sm font-medium text-muted">
                {product.name}
              </p>
            ))}
          </MessageBox>
        ) : null}

        <SectionLabel>Money summary</SectionLabel>
        <PeriodFilter period={period} />

        {summary ? (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                ['Purchases', summary.total_purchases],
                ['Production costs', summary.total_batch_costs],
                ['Expenses', summary.total_expenses],
                ['Sales to shops', summary.total_distribution_revenue],
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

        {activeItems.length > 0 ? (
          <div className="space-y-2">
            <FormInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search items" />
            <ChipRow
              options={[
                { value: 'all', label: 'All' },
                { value: 'raw_material', label: 'Raw materials' },
                { value: 'packaging', label: 'Packaging' },
              ]}
              value={category}
              onChange={setCategory}
            />
          </div>
        ) : null}

        {activeItems.length > 0 && visibleItems.length === 0 ? <p className="text-sm font-medium text-muted">No items match.</p> : null}

        <div className="grid gap-2 lg:grid-cols-2">
          {visibleItems.map((item) => (
            <div key={item.id} className="rounded-lg border border-line bg-surface px-4">
              <ListRow
                className="!border-b-0"
                onClick={() => openItemSheet(item)}
                title={item.name}
                subtitle={`${item.category === 'raw_material' ? 'Raw material' : 'Packaging'} · ${item.current_quantity.toLocaleString()} ${item.unit}`}
                trailing={
                  <div className="flex flex-col items-end gap-1">
                    {item.is_low_stock ? <Badge label="Low stock" tone="warning" /> : null}
                    <StockLevelBar quantity={item.current_quantity} reorderLevel={item.reorder_level} low={item.is_low_stock} />
                  </div>
                }
              />
            </div>
          ))}
        </div>
      </Page>
      {can('record_stock') ? (
        <Fab label="Add" icon="add" onPress={() => setAddOpen(true)} />
      ) : null}
      <ActionSheet
        visible={addOpen}
        onClose={() => setAddOpen(false)}
        actions={[
          { icon: 'cube-outline', label: 'Add stock item', onPress: () => router.push('/stock/items/new') },
          { icon: 'cart-outline', label: 'Record purchase', onPress: () => router.push('/stock/purchases/new') },
          { icon: 'construct-outline', label: 'New production run', onPress: () => router.push('/stock/batches/new') },
          { icon: 'wallet-outline', label: 'Add expense', onPress: () => router.push('/stock/expenses/new') },
        ]}
      />
      <ActionSheet
        visible={itemSheetOpen}
        onClose={() => setItemSheetOpen(false)}
        title={selectedItem?.name}
        actions={[
          { icon: 'cart-outline', label: 'Record purchase', onPress: () => router.push(`/stock/purchases/new?itemId=${selectedItem?.id}`) },
          { icon: 'receipt-outline', label: 'Item details & history', onPress: () => router.push(`/stock/items/${selectedItem?.id}`) },
          { icon: 'create-outline', label: 'Edit item', onPress: () => router.push(`/stock/items/${selectedItem?.id}/edit`) },
        ]}
      />
      <BackToTopButton />
    </>
  );
}
