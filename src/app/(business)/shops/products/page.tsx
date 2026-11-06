'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';

import { Badge } from '@/components/badge';
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
import { formatMoney } from '@/lib/format';
import { listProducts } from '@/lib/products-api';
import type { Product } from '@/types/catalog';

export default function ProductsListPage() {
  const router = useRouter();
  const { activeBusinessId, can } = useBusinessAuth();

  const [products, setProducts] = useState<Product[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeBusinessId) return;
    try {
      setProducts(await listProducts(activeBusinessId));
      setLoadError(null);
    } catch (err) {
      setLoadError(getErrorMessage(err, 'Could not load products.'));
    }
  }, [activeBusinessId]);

  useFocusEffect(load);

  if (!activeBusinessId) return null;

  return (
    <>
      <ScreenHeader back title="Products" />
      <Page>
        {products === null && !loadError ? <SkeletonRows count={7} /> : null}
        {loadError ? <MessageBox tone="danger" message={loadError} /> : null}

        {products !== null && products.length === 0 ? (
          <EmptyState
            icon="pricetags-outline"
            title="No products yet"
            message="Add the products you sell to start recording deliveries."
            actionLabel="Add product"
            onAction={() => router.push('/shops/products/new')}
          />
        ) : null}

        <div className="grid gap-2 lg:grid-cols-2">
          {(products ?? []).map((product) => (
            <div key={product.id} className="rounded-lg border border-line bg-surface px-4">
              <ListRow
                className="!border-b-0"
                onClick={() => router.push(`/shops/products/${product.id}/edit`)}
                title={product.name}
                subtitle={`${product.unit} · ${formatMoney(product.unit_price)}`}
                trailing={
                  !product.is_active ? (
                    <Badge label="Inactive" />
                  ) : product.is_low_stock ? (
                    <Badge label="Low stock" tone="warning" />
                  ) : undefined
                }
              />
            </div>
          ))}
        </div>
      </Page>
      {can('manage_catalog') ? (
        <Fab label="Add product" onPress={() => router.push('/shops/products/new')} />
      ) : null}
    </>
  );
}
