'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';

import { EmptyState } from '@/components/empty-state';
import { ListRow } from '@/components/list-row';
import { MessageBox } from '@/components/message-box';
import { Page } from '@/components/page';
import { PrimaryButton } from '@/components/primary-button';
import { ScreenHeader } from '@/components/screen-header';
import { SkeletonRows } from '@/components/skeleton';
import { getErrorMessage } from '@/lib/error-message';
import { formatDate, formatMoney } from '@/lib/format';
import { listShopDeliveries, listShopPayments } from '@/lib/shops-api';
import type { ShopDelivery, ShopPayment } from '@/types/catalog';

const PAGE_SIZE = 30;

function ShopHistory() {
  const { shopId } = useParams<{ shopId: string }>();
  const isDeliveries = useSearchParams().get('type') !== 'payments';

  const [deliveries, setDeliveries] = useState<ShopDelivery[]>([]);
  const [payments, setPayments] = useState<ShopPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPage = useCallback(
    async (offset: number) => {
      if (!shopId) return;
      try {
        if (isDeliveries) {
          const page = await listShopDeliveries(shopId, PAGE_SIZE, offset);
          setDeliveries((prev) => (offset === 0 ? page : [...prev, ...page]));
          setHasMore(page.length === PAGE_SIZE);
        } else {
          const page = await listShopPayments(shopId, PAGE_SIZE, offset);
          setPayments((prev) => (offset === 0 ? page : [...prev, ...page]));
          setHasMore(page.length === PAGE_SIZE);
        }
        setError(null);
      } catch (err) {
        setError(getErrorMessage(err, 'Could not load this history.'));
      }
    },
    [shopId, isDeliveries],
  );

  useEffect(() => {
    setLoading(true);
    loadPage(0).finally(() => setLoading(false));
  }, [loadPage]);

  async function handleLoadMore() {
    setLoadingMore(true);
    await loadPage(isDeliveries ? deliveries.length : payments.length);
    setLoadingMore(false);
  }

  const rows = isDeliveries ? deliveries : payments;

  return (
    <>
      <ScreenHeader back title={isDeliveries ? 'All deliveries' : 'All payments'} />
      <Page narrow>
        <p className="text-sm font-medium text-muted">
          To edit or correct an entry, use the shop page. It lists the most recent entries.
        </p>

        {loading ? <SkeletonRows count={6} avatar={false} /> : null}
        {error ? <MessageBox tone="danger" message={error} /> : null}
        {!loading && rows.length === 0 && !error ? (
          <EmptyState icon={isDeliveries ? 'cube-outline' : 'cash-outline'} title="Nothing recorded yet" />
        ) : null}

        <div>
          {isDeliveries
            ? deliveries.map((d) => (
                <ListRow
                  key={d.id}
                  title={`${d.quantity} ${d.product_unit ?? ''} ${d.product_name ?? ''}`}
                  subtitle={`${formatDate(d.delivery_date)}${d.is_edited ? ' · Edited' : ''}${d.voided_at ? ' · Voided' : ''}`}
                  trailingText={formatMoney(d.total_amount)}
                  trailingClassName={d.voided_at ? 'text-muted' : ''}
                />
              ))
            : payments.map((p) => (
                <ListRow
                  key={p.id}
                  title={p.method ?? 'Payment'}
                  subtitle={`${formatDate(p.payment_date)}${p.is_edited ? ' · Edited' : ''}${p.voided_at ? ' · Voided' : ''}`}
                  trailingText={formatMoney(p.amount)}
                  trailingClassName={p.voided_at ? 'text-muted' : ''}
                />
              ))}
        </div>

        {hasMore && !loading && rows.length > 0 ? (
          <PrimaryButton label="Load more" variant="outline" loading={loadingMore} onClick={handleLoadMore} />
        ) : null}
      </Page>
    </>
  );
}

export default function ShopHistoryPage() {
  return (
    <Suspense fallback={null}>
      <ShopHistory />
    </Suspense>
  );
}
