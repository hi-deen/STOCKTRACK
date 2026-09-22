'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';

import { BatchFormFields, emptyBatchForm, isBatchFormValid, toBatchInput, type BatchFormState } from '@/components/batch-form';
import { MessageBox } from '@/components/message-box';
import { Page } from '@/components/page';
import { PrimaryButton } from '@/components/primary-button';
import { ScreenHeader } from '@/components/screen-header';
import { useToast } from '@/components/toast';
import { useFocusEffect } from '@/hooks/use-focus-effect';
import { createBatch } from '@/lib/batches-api';
import { useBusinessAuth } from '@/lib/business-auth-context';
import { getErrorMessage } from '@/lib/error-message';
import { listProducts } from '@/lib/products-api';
import { listStockItems } from '@/lib/stock-items-api';
import type { Product } from '@/types/catalog';
import type { StockItem } from '@/types/stock';

export default function NewBatchPage() {
  const router = useRouter();
  const toast = useToast();
  const { activeBusinessId } = useBusinessAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState<BatchFormState>(emptyBatchForm);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeBusinessId) return;
    try {
      const [productsData, itemsData] = await Promise.all([listProducts(activeBusinessId), listStockItems(activeBusinessId)]);
      setProducts(productsData.filter((p) => p.is_active));
      setStockItems(itemsData.filter((i) => i.is_active));
      setLoadError(null);
    } catch (err) {
      setLoadError(getErrorMessage(err, 'Could not load products and stock items.'));
    }
  }, [activeBusinessId]);

  useFocusEffect(load);

  const canSubmit = !!activeBusinessId && isBatchFormValid(form) && !submitting;

  async function handleSubmit() {
    if (!canSubmit || !activeBusinessId) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await createBatch(activeBusinessId, toBatchInput(form));
      toast.show('Batch created');
      router.back();
    } catch (err) {
      setSubmitError(getErrorMessage(err, 'Could not create this batch.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <ScreenHeader title="New batch" back />
      <Page narrow>
        {loadError ? <MessageBox tone="danger" message={loadError} /> : null}
        <BatchFormFields state={form} setState={setForm} products={products} stockItems={stockItems} />
        {submitError ? <MessageBox tone="danger" message={submitError} /> : null}
        <PrimaryButton label="Create batch" onClick={handleSubmit} disabled={!canSubmit} loading={submitting} />
      </Page>
    </>
  );
}
