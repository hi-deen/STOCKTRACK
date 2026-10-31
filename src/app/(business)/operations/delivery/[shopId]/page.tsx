'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';

import { PressableCard } from '@/components/card';
import { FormInput, FormTextarea } from '@/components/form-input';
import { MessageBox } from '@/components/message-box';
import { Page, SectionLabel } from '@/components/page';
import { PrimaryButton } from '@/components/primary-button';
import { ScreenHeader } from '@/components/screen-header';
import { Skeleton } from '@/components/skeleton';
import { useToast } from '@/components/toast';
import { useFocusEffect } from '@/hooks/use-focus-effect';
import { useBusinessAuth } from '@/lib/business-auth-context';
import { getErrorMessage } from '@/lib/error-message';
import { toDateString } from '@/lib/format';
import { formatMoney } from '@/lib/format';
import {
  cacheProductUnits,
  cacheProducts,
  getCachedProductUnits,
  getCachedProducts,
  isNetworkError,
  queueMutation,
} from '@/lib/offline/db';
import { recordDelivery } from '@/lib/operations-api';
import { listProductUnits } from '@/lib/product-units-api';
import { listProducts } from '@/lib/products-api';
import type { Product } from '@/types/catalog';
import type { ProductUnit } from '@/types/stock';

function RecordDelivery() {
  const router = useRouter();
  const toast = useToast();
  const { activeBusinessId, userId } = useBusinessAuth();
  const { shopId } = useParams<{ shopId: string }>();
  const shopName = useSearchParams().get('shopName');

  const [products, setProducts] = useState<Product[] | null>(null);
  const [productsError, setProductsError] = useState<string | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [units, setUnits] = useState<ProductUnit[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [deliveryDate, setDeliveryDate] = useState(() => toDateString(new Date()));
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeBusinessId) return;
    setProductsError(null);
    try {
      const data = await listProducts(activeBusinessId);
      void cacheProducts(activeBusinessId, data).catch(() => undefined);
      setProducts(data.filter((p) => p.is_active));
    } catch (err) {
      // Offline: fall back to the products cached the last time Today loaded.
      if (isNetworkError(err)) {
        const cached = await getCachedProducts(activeBusinessId).catch(() => []);
        if (cached.length > 0) {
          setProducts(cached.filter((p) => p.is_active));
          return;
        }
      }
      setProducts([]);
      setProductsError(getErrorMessage(err, 'Could not load products.'));
    }
  }, [activeBusinessId]);

  useFocusEffect(load);

  // Reload the product's selling units whenever the picked product changes,
  // defaulting to its base unit (base_unit_quantity === 1, always present).
  useEffect(() => {
    if (!selectedProductId || !activeBusinessId) {
      setUnits([]);
      setSelectedUnitId(null);
      return;
    }
    let cancelled = false;
    (async () => {
      let data: ProductUnit[];
      try {
        data = await listProductUnits(selectedProductId);
        void cacheProductUnits(activeBusinessId, selectedProductId, data).catch(() => undefined);
      } catch {
        data = await getCachedProductUnits(selectedProductId).catch(() => []);
      }
      if (cancelled) return;
      setUnits(data);
      setSelectedUnitId(data.find((u) => u.base_unit_quantity === 1)?.id ?? data[0]?.id ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedProductId, activeBusinessId]);

  const selectedProduct = products?.find((p) => p.id === selectedProductId) ?? null;
  const selectedUnit = units.find((u) => u.id === selectedUnitId) ?? null;
  const quantityNumber = Number(quantity);
  const canSubmit =
    !!activeBusinessId &&
    !!shopId &&
    !!selectedProduct &&
    !!selectedUnit &&
    !!deliveryDate &&
    Number.isFinite(quantityNumber) &&
    quantityNumber > 0 &&
    !submitting;

  async function handleSubmit() {
    if (!canSubmit || !activeBusinessId || !shopId || !selectedProduct || !selectedUnit) return;
    setSubmitting(true);
    setSubmitError(null);
    const input = {
      businessId: activeBusinessId,
      shopId,
      productId: selectedProduct.id,
      sellingUnitId: selectedUnit.id,
      quantity: quantityNumber,
      unitPrice: selectedUnit.default_price,
      notes: notes.trim() || null,
      createdBy: userId,
      deliveryDate,
    };
    try {
      await recordDelivery(input);
      toast.show('Delivery recorded');
      router.back();
    } catch (err) {
      if (isNetworkError(err)) {
        await queueMutation({
          business_id: activeBusinessId,
          type: 'delivery',
          payload: input,
          shop_name: shopName ?? undefined,
        });
        toast.show("Saved offline — will sync when you're back online");
        router.back();
      } else {
        setSubmitError(getErrorMessage(err, 'Could not record this delivery. Please try again.'));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <ScreenHeader title="Record delivery" subtitle={shopName || undefined} back />
      <Page narrow>
        {products === null && !productsError ? <Skeleton height={64} /> : null}
        {productsError ? <MessageBox tone="danger" message={productsError} /> : null}

        {products !== null && products.length === 0 && !productsError ? (
          <MessageBox
            tone="neutral"
            message="No active products in your catalog yet. Add one from the Shops tab's Products screen first."
          />
        ) : null}

        {products !== null && products.length > 0 ? (
          <>
            <SectionLabel>Product</SectionLabel>
            <div className="grid gap-2 sm:grid-cols-2">
              {products.map((product) => (
                <PressableCard
                  key={product.id}
                  selected={product.id === selectedProductId}
                  onClick={() => setSelectedProductId(product.id)}>
                  <span className="block text-sm font-bold">{product.name}</span>
                  <span className="mt-0.5 block text-sm font-medium text-muted">
                    {product.unit} · unit price {formatMoney(product.unit_price)}
                  </span>
                </PressableCard>
              ))}
            </div>

            {units.length > 1 ? (
              <>
                <SectionLabel>Selling unit</SectionLabel>
                <div className="flex flex-wrap gap-2">
                  {units.map((unit) => (
                    <PressableCard
                      key={unit.id}
                      selected={unit.id === selectedUnitId}
                      onClick={() => setSelectedUnitId(unit.id)}
                      className="!w-auto min-w-[110px]">
                      <span className="block text-sm font-bold">{unit.name}</span>
                      <span className="block text-sm font-medium text-muted">{formatMoney(unit.default_price)}</span>
                    </PressableCard>
                  ))}
                </div>
              </>
            ) : null}

            <SectionLabel>Quantity</SectionLabel>
            <FormInput
              value={quantity}
              onChange={(e) => setQuantity(e.target.value.replace(/[^0-9.]/g, ''))}
              placeholder="e.g. 10"
              inputMode="decimal"
            />

            {selectedUnit && quantityNumber > 0 ? (
              <p className="tabular-nums text-muted">Total: {formatMoney(quantityNumber * selectedUnit.default_price)}</p>
            ) : null}

            <SectionLabel>Date</SectionLabel>
            <FormInput type="date" value={deliveryDate} max={toDateString(new Date())} onChange={(e) => setDeliveryDate(e.target.value)} />

            <SectionLabel>Notes</SectionLabel>
            <FormTextarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />

            {submitError ? <MessageBox tone="danger" message={submitError} /> : null}

            <PrimaryButton label="Record delivery" onClick={handleSubmit} disabled={!canSubmit} loading={submitting} />
          </>
        ) : null}
      </Page>
    </>
  );
}

export default function RecordDeliveryPage() {
  return (
    <Suspense fallback={null}>
      <RecordDelivery />
    </Suspense>
  );
}
