'use client';
/* eslint-disable @next/next/no-img-element */

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';

import { PressableCard } from '@/components/card';
import { FormInput } from '@/components/form-input';
import { MessageBox } from '@/components/message-box';
import { Page, SectionLabel } from '@/components/page';
import { PrimaryButton } from '@/components/primary-button';
import { ScreenHeader } from '@/components/screen-header';
import { Skeleton } from '@/components/skeleton';
import { getErrorMessage } from '@/lib/error-message';
import { getShopProductsForRider, recordRiderDelivery } from '@/lib/rider-api';
import { useRiderAuth } from '@/lib/rider-auth-context';
import { uploadDeliveryProofPhoto } from '@/lib/upload-proof-photo';
import type { RiderShopProduct } from '@/types/rider';

function RecordDelivery() {
  const router = useRouter();
  const { shopId } = useParams<{ shopId: string }>();
  const search = useSearchParams();
  const businessId = search.get('businessId');
  const shopName = search.get('shopName');
  const { token } = useRiderAuth();

  const [products, setProducts] = useState<RiderShopProduct[] | null>(null);
  const [productsError, setProductsError] = useState<string | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const loadProducts = useCallback(async () => {
    if (!token || !shopId) return;
    setProducts(null);
    setProductsError(null);
    try {
      setProducts(await getShopProductsForRider(token, shopId));
    } catch (err) {
      setProductsError(getErrorMessage(err, 'Could not load products for this shop.'));
    }
  }, [token, shopId]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    if (!photo) {
      setPhotoUrl(null);
      return;
    }
    const url = URL.createObjectURL(photo);
    setPhotoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  if (!businessId) {
    return (
      <>
        <ScreenHeader title="Record delivery" back />
        <Page narrow>
          <MessageBox tone="danger" message="Missing shop details. Go back and open this shop from your route." />
        </Page>
      </>
    );
  }

  function handleSelectProduct(product: RiderShopProduct) {
    setSelectedProductId(product.product_id);
    if (quantity.trim().length === 0 && product.usual_quantity) {
      setQuantity(String(product.usual_quantity));
    }
  }

  const quantityNumber = Number(quantity);
  const canSubmit =
    !!selectedProductId &&
    Number.isFinite(quantityNumber) &&
    quantityNumber > 0 &&
    !!photo &&
    !submitting &&
    (products?.length ?? 0) > 0;

  async function handleSubmit() {
    if (!canSubmit || !selectedProductId || !photo || !token || !businessId) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const path = await uploadDeliveryProofPhoto(photo, businessId, shopId);
      await recordRiderDelivery(token, shopId, selectedProductId, quantityNumber, path);
      router.back();
    } catch (err) {
      setSubmitError(getErrorMessage(err, 'Could not record this delivery. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <ScreenHeader title={shopName ?? 'Record delivery'} back />
      <Page narrow>
        {products === null && !productsError ? <Skeleton height={64} /> : null}

        {productsError ? (
          <MessageBox tone="danger">
            <p className="text-danger">{productsError}</p>
            <button type="button" onClick={loadProducts} className="text-sm font-medium text-primary">
              Try again
            </button>
          </MessageBox>
        ) : null}

        {products !== null && products.length === 0 ? (
          <MessageBox
            tone="neutral"
            message="No products are set up for this shop yet. Ask the business to add products before you can record a delivery here."
          />
        ) : null}

        {products !== null && products.length > 0 ? (
          <>
            <SectionLabel>Product</SectionLabel>
            {products.map((product) => (
              <PressableCard
                key={product.product_id}
                selected={product.product_id === selectedProductId}
                onClick={() => handleSelectProduct(product)}>
                <span className="block text-sm font-bold">{product.product_name}</span>
                <span className="mt-0.5 block text-muted">
                  {product.unit} · unit price {product.unit_price}
                  {product.usual_quantity ? ` · usual qty ${product.usual_quantity}` : ''}
                </span>
              </PressableCard>
            ))}

            <SectionLabel>Quantity</SectionLabel>
            <FormInput
              value={quantity}
              onChange={(e) => setQuantity(e.target.value.replace(/[^0-9.]/g, ''))}
              placeholder="e.g. 10"
              inputMode="decimal"
            />

            <SectionLabel>Proof photo</SectionLabel>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setPhoto(file);
                  setSubmitError(null);
                }
                e.target.value = '';
              }}
            />
            {photoUrl ? (
              <div className="space-y-2">
                <img src={photoUrl} alt="Proof of delivery" className="h-56 w-full rounded-md object-cover" />
                <PrimaryButton label="Retake photo" variant="outline" onClick={() => fileInput.current?.click()} />
              </div>
            ) : (
              <PrimaryButton label="Take photo" variant="outline" onClick={() => fileInput.current?.click()} />
            )}

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
