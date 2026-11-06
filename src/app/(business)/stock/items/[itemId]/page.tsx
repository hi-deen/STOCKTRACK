'use client';

import { useParams, useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';

import { Badge } from '@/components/badge';
import { Card } from '@/components/card';
import { EmptyState } from '@/components/empty-state';
import { ListRow } from '@/components/list-row';
import { MessageBox } from '@/components/message-box';
import { Page, SectionLabel } from '@/components/page';
import { PrimaryButton } from '@/components/primary-button';
import { ScreenHeader } from '@/components/screen-header';
import { SkeletonRows } from '@/components/skeleton';
import { StockLevelBar } from '@/components/stock-level-bar';
import { useFocusEffect } from '@/hooks/use-focus-effect';
import { useBusinessAuth } from '@/lib/business-auth-context';
import { getErrorMessage } from '@/lib/error-message';
import { formatDate, formatMoney } from '@/lib/format';
import { getStockItem } from '@/lib/stock-items-api';
import { listPurchasesForItem, purchaseQuantityLabel } from '@/lib/stock-purchases-api';
import type { StockItem, StockPurchase } from '@/types/stock';

export default function StockItemDetailPage() {
  const router = useRouter();
  const { can } = useBusinessAuth();
  const canEditStockRecords = can('manage_stock_records');
  const { itemId } = useParams<{ itemId: string }>();

  const [item, setItem] = useState<StockItem | null>(null);
  const [purchases, setPurchases] = useState<StockPurchase[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!itemId) return;
    try {
      const [itemData, purchasesData] = await Promise.all([getStockItem(itemId), listPurchasesForItem(itemId)]);
      setItem(itemData);
      setPurchases(purchasesData);
      setLoadError(null);
    } catch (err) {
      setLoadError(getErrorMessage(err, 'Could not load this item.'));
    }
  }, [itemId]);

  useFocusEffect(load);

  return (
    <>
      <ScreenHeader title={item?.name ?? 'Item'} back primaryActions={[{ icon: 'refresh', label: 'Refresh', onPress: load }]} />
      <Page narrow>
        {item === null && !loadError ? <SkeletonRows /> : null}
        {loadError ? <MessageBox tone="danger" message={loadError} /> : null}

        {item ? (
          <>
            <Card className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted">{item.category === 'raw_material' ? 'Raw material' : 'Packaging'}</p>
                {item.is_low_stock ? <Badge label="Low stock" tone="warning" /> : null}
              </div>
              <p className="text-2xl font-bold tabular-nums">
                {item.current_quantity.toLocaleString()} {item.unit}
              </p>
              <StockLevelBar quantity={item.current_quantity} reorderLevel={item.reorder_level} low={item.is_low_stock} className="w-full" />
              <p className="text-sm font-medium tabular-nums text-muted">
                {item.reorder_level === null ? 'No reorder level set' : `Reorder at ${item.reorder_level.toLocaleString()} ${item.unit}`}
                {purchases[0] ? ` · Last paid ${formatMoney(purchases[0].unit_cost)} each` : ''}
              </p>
            </Card>

            <PrimaryButton label="Record purchase" onClick={() => router.push(`/stock/purchases/new?itemId=${item.id}`)} />
            <PrimaryButton label="Edit item" variant="outline" onClick={() => router.push(`/stock/items/${item.id}/edit`)} />

            <SectionLabel>Purchase history</SectionLabel>

            {purchases.length === 0 ? (
              <EmptyState icon="cart-outline" title="No purchases yet" message="Purchases of this item will appear here." />
            ) : null}

            <div>
              {purchases.map((purchase) => (
                <ListRow
                  key={purchase.id}
                  onClick={canEditStockRecords ? () => router.push(`/stock/purchases/${purchase.id}/edit`) : undefined}
                  title={formatDate(purchase.purchase_date)}
                  subtitle={`${purchaseQuantityLabel(purchase, item.unit)}${purchase.supplier ? ` · ${purchase.supplier}` : ''}`}
                  trailingText={formatMoney(purchase.total_cost)}
                />
              ))}
            </div>
          </>
        ) : null}
      </Page>
    </>
  );
}
