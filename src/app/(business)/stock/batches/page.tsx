'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';

import { BackToTopButton } from '@/components/back-to-top-button';
import { Badge } from '@/components/badge';
import { EmptyState } from '@/components/empty-state';
import { Fab } from '@/components/fab';
import { ListRow } from '@/components/list-row';
import { MessageBox } from '@/components/message-box';
import { Page } from '@/components/page';
import { ScreenHeader } from '@/components/screen-header';
import { SkeletonRows } from '@/components/skeleton';
import { useFocusEffect } from '@/hooks/use-focus-effect';
import { listBatches } from '@/lib/batches-api';
import { useBusinessAuth } from '@/lib/business-auth-context';
import { getErrorMessage } from '@/lib/error-message';
import { formatDate, formatMoney } from '@/lib/format';
import { listProducts } from '@/lib/products-api';
import type { Product } from '@/types/catalog';
import type { Batch } from '@/types/stock';

export default function BatchesListPage() {
  const router = useRouter();
  const { activeBusinessId, can } = useBusinessAuth();

  const [batches, setBatches] = useState<Batch[] | null>(null);
  const [products, setProducts] = useState<Map<string, Product>>(new Map());
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeBusinessId) return;
    try {
      const [batchesData, productsData] = await Promise.all([listBatches(activeBusinessId), listProducts(activeBusinessId)]);
      setBatches(batchesData);
      setProducts(new Map(productsData.map((p) => [p.id, p])));
      setLoadError(null);
    } catch (err) {
      setLoadError(getErrorMessage(err, 'Could not load production runs.'));
    }
  }, [activeBusinessId]);

  useFocusEffect(load);

  if (!activeBusinessId) return null;

  return (
    <>
      <ScreenHeader title="Production runs" back primaryActions={[{ icon: 'refresh', label: 'Refresh', onPress: load }]} />
      <Page narrow>
        {batches === null && !loadError ? <SkeletonRows /> : null}
        {loadError ? <MessageBox tone="danger" message={loadError} /> : null}

        {batches !== null && batches.length === 0 ? (
          <EmptyState
            icon="construct-outline"
            title="No production runs yet"
            message="Record your first production run."
            actionLabel="New production run"
            onAction={() => router.push('/stock/batches/new')}
          />
        ) : null}

        <div>
          {(batches ?? []).map((batch) => (
            <ListRow
              key={batch.id}
              onClick={() => router.push(`/stock/batches/${batch.id}`)}
              title={batch.name}
              subtitle={`${products.get(batch.product_id)?.name ?? 'Unknown product'} · ${formatDate(batch.production_date)} · ${batch.output_quantity_base.toLocaleString()} ${products.get(batch.product_id)?.unit ?? ''}`}
              trailing={
                <span className="flex flex-col items-end gap-1">
                  <span className="text-sm font-bold tabular-nums">{formatMoney(batch.total_cost)}</span>
                  {batch.is_edited ? <Badge label="Edited" /> : null}
                </span>
              }
            />
          ))}
        </div>
      </Page>
      {can('record_stock') ? (
        <Fab label="New production run" onPress={() => router.push('/stock/batches/new')} />
      ) : null}
      <BackToTopButton />
    </>
  );
}
