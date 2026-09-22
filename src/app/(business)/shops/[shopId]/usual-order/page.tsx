'use client';

import { useParams } from 'next/navigation';
import { useCallback, useState } from 'react';

import { Card } from '@/components/card';
import { EmptyState } from '@/components/empty-state';
import { FormInput } from '@/components/form-input';
import { MessageBox } from '@/components/message-box';
import { Page } from '@/components/page';
import { PrimaryButton } from '@/components/primary-button';
import { ScreenHeader } from '@/components/screen-header';
import { SkeletonRows } from '@/components/skeleton';
import { useToast } from '@/components/toast';
import { useFocusEffect } from '@/hooks/use-focus-effect';
import { useBusinessAuth } from '@/lib/business-auth-context';
import { getErrorMessage } from '@/lib/error-message';
import { listProducts } from '@/lib/products-api';
import { deleteShopProducts, listShopProducts, upsertShopProducts } from '@/lib/shops-api';
import type { Product } from '@/types/catalog';

export default function UsualOrderPage() {
  const toast = useToast();
  const { activeBusinessId } = useBusinessAuth();
  const { shopId } = useParams<{ shopId: string }>();

  const [products, setProducts] = useState<Product[] | null>(null);
  const [initialQuantities, setInitialQuantities] = useState<Record<string, string>>({});
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    if (!activeBusinessId || !shopId || dirty) return;
    try {
      const [productList, shopProductRows] = await Promise.all([listProducts(activeBusinessId), listShopProducts(shopId)]);
      const rowsByProduct = new Map(shopProductRows.map((r) => [r.product_id, r.usual_quantity]));
      const initial: Record<string, string> = {};
      for (const product of productList) {
        const value = rowsByProduct.get(product.id);
        initial[product.id] = value ? String(value) : '';
      }
      setProducts(productList);
      setInitialQuantities(initial);
      setQuantities(initial);
      setLoadError(null);
    } catch (err) {
      setLoadError(getErrorMessage(err, 'Could not load products.'));
    }
  }, [activeBusinessId, shopId, dirty]);

  useFocusEffect(load);

  async function handleSave() {
    if (!shopId || isSaving) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const toUpsert: { product_id: string; usual_quantity: number }[] = [];
      const toDelete: string[] = [];

      for (const productId of Object.keys(quantities)) {
        const raw = quantities[productId]?.trim() ?? '';
        const parsed = Number(raw);
        const hadValue = (initialQuantities[productId] ?? '').length > 0;
        if (raw.length > 0 && Number.isFinite(parsed) && parsed > 0) {
          toUpsert.push({ product_id: productId, usual_quantity: parsed });
        } else if (raw.length === 0 && hadValue) {
          toDelete.push(productId);
        }
      }

      await Promise.all([upsertShopProducts(shopId, toUpsert), deleteShopProducts(shopId, toDelete)]);
      toast.show('Usual order saved');
      setDirty(false);
      setInitialQuantities({ ...quantities });
    } catch (err) {
      setSaveError(getErrorMessage(err, 'Could not save the usual order.'));
    } finally {
      setIsSaving(false);
    }
  }

  if (!activeBusinessId || !shopId) return null;

  return (
    <>
      <ScreenHeader back title="Usual order" />
      <Page narrow>
        <p className="text-muted">Set a default quantity per product. Leave blank if this shop doesn&apos;t usually order it.</p>

        {products === null && !loadError ? <SkeletonRows count={6} avatar={false} /> : null}
        {loadError ? <MessageBox tone="danger" message={loadError} /> : null}

        {products !== null && products.length === 0 ? (
          <EmptyState icon="pricetags-outline" title="No products yet" message="Add some from the Products screen first." />
        ) : null}

        {(products ?? []).map((product) => (
          <Card key={product.id} className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-bold">{product.name}</p>
              <p className="text-sm font-medium text-muted">{product.unit}</p>
            </div>
            <div className="w-28">
              <FormInput
                value={quantities[product.id] ?? ''}
                onChange={(e) => {
                  setDirty(true);
                  setQuantities((prev) => ({ ...prev, [product.id]: e.target.value.replace(/[^0-9.]/g, '') }));
                }}
                placeholder="0"
                inputMode="decimal"
                className="text-right"
              />
            </div>
          </Card>
        ))}

        {saveError ? <MessageBox tone="danger" message={saveError} /> : null}

        {products !== null && products.length > 0 ? (
          <PrimaryButton label="Save usual order" onClick={handleSave} loading={isSaving} />
        ) : null}
      </Page>
    </>
  );
}
