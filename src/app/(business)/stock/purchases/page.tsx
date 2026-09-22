'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';

import { BackToTopButton } from '@/components/back-to-top-button';
import { EmptyState } from '@/components/empty-state';
import { Fab } from '@/components/fab';
import { ListRow } from '@/components/list-row';
import { MessageBox } from '@/components/message-box';
import { Page } from '@/components/page';
import { ScreenHeader } from '@/components/screen-header';
import { SkeletonRows } from '@/components/skeleton';
import { useFocusEffect } from '@/hooks/use-focus-effect';
import { useBusinessAuth } from '@/lib/business-auth-context';
import { getErrorMessage } from '@/lib/error-message';
import { formatDate, formatMoney } from '@/lib/format';
import { listStockItems } from '@/lib/stock-items-api';
import { listPurchases } from '@/lib/stock-purchases-api';
import type { StockItem, StockPurchase } from '@/types/stock';

export default function PurchasesListPage() {
  const router = useRouter();
  const { activeBusinessId } = useBusinessAuth();

  const [purchases, setPurchases] = useState<StockPurchase[] | null>(null);
  const [items, setItems] = useState<Map<string, StockItem>>(new Map());
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeBusinessId) return;
    try {
      const [purchasesData, itemsData] = await Promise.all([listPurchases(activeBusinessId), listStockItems(activeBusinessId)]);
      setPurchases(purchasesData);
      setItems(new Map(itemsData.map((i) => [i.id, i])));
      setLoadError(null);
    } catch (err) {
      setLoadError(getErrorMessage(err, 'Could not load purchases.'));
    }
  }, [activeBusinessId]);

  useFocusEffect(load);

  if (!activeBusinessId) return null;

  return (
    <>
      <ScreenHeader title="Purchases" back primaryActions={[{ icon: 'refresh', label: 'Refresh', onPress: load }]} />
      <Page narrow>
        <p className="text-sm font-medium text-muted">
          Purchases can&apos;t be edited or deleted once recorded — record a new one to correct a mistake.
        </p>

        {purchases === null && !loadError ? <SkeletonRows /> : null}
        {loadError ? <MessageBox tone="danger" message={loadError} /> : null}

        {purchases !== null && purchases.length === 0 ? (
          <EmptyState
            icon="cart-outline"
            title="No purchases yet"
            message="Recorded purchases will appear here."
            actionLabel="Record purchase"
            onAction={() => router.push('/stock/purchases/new')}
          />
        ) : null}

        <div>
          {(purchases ?? []).map((purchase) => {
            const item = items.get(purchase.stock_item_id);
            return (
              <ListRow
                key={purchase.id}
                title={item?.name ?? 'Unknown item'}
                subtitle={`${purchase.quantity.toLocaleString()} ${item?.unit ?? ''} · ${formatDate(purchase.purchase_date)}${purchase.supplier ? ` · ${purchase.supplier}` : ''}`}
                trailingText={formatMoney(purchase.total_cost)}
              />
            );
          })}
        </div>
      </Page>
      <Fab label="Record purchase" onPress={() => router.push('/stock/purchases/new')} />
      <BackToTopButton />
    </>
  );
}
