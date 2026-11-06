'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';

import { ChipRow } from '@/components/chip-row';
import { Field, FormInput } from '@/components/form-input';
import { MessageBox } from '@/components/message-box';
import { Page, SectionLabel } from '@/components/page';
import { PrimaryButton } from '@/components/primary-button';
import { ScreenHeader } from '@/components/screen-header';
import { useToast } from '@/components/toast';
import { useFocusEffect } from '@/hooks/use-focus-effect';
import { useBusinessAuth } from '@/lib/business-auth-context';
import { getErrorMessage } from '@/lib/error-message';
import { writeOffProduct } from '@/lib/finance-api';
import { toDateString } from '@/lib/format';
import { listProducts } from '@/lib/products-api';
import type { Product } from '@/types/catalog';

export default function WriteOffPage() {
  const router = useRouter();
  const toast = useToast();
  const { activeBusinessId } = useBusinessAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [date, setDate] = useState(() => toDateString(new Date()));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeBusinessId) return;
    try {
      const data = (await listProducts(activeBusinessId)).filter((p) => p.is_active);
      setProducts(data);
      setProductId((current) => current || data[0]?.id || '');
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load products.'));
    }
  }, [activeBusinessId]);

  useFocusEffect(load);

  const product = products.find((p) => p.id === productId);
  const quantityNumber = Number(quantity);
  const canSubmit =
    !!activeBusinessId &&
    !!product &&
    Number.isFinite(quantityNumber) &&
    quantityNumber > 0 &&
    reason.trim().length > 0 &&
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    !submitting;

  async function handleSubmit() {
    if (!canSubmit || !activeBusinessId || !product) return;
    setSubmitting(true);
    setError(null);
    try {
      await writeOffProduct(activeBusinessId, product.id, quantityNumber, reason.trim(), date);
      toast.show('Stock written off');
      router.back();
    } catch (err) {
      setError(getErrorMessage(err, 'Could not write off this stock.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <ScreenHeader title="Write off stock" back />
      <Page narrow>
        <p className="text-sm font-medium text-muted">
          For finished goods that were damaged, spoiled or lost. They leave stock and their cost counts against profit.
        </p>

        <SectionLabel>Product</SectionLabel>
        <ChipRow options={products.map((p) => ({ value: p.id, label: p.name }))} value={productId} onChange={setProductId} />

        <Field label={`Quantity${product ? ` (${product.unit})` : ''}`}>
          <FormInput
            value={quantity}
            onChange={(e) => setQuantity(e.target.value.replace(/[^0-9.]/g, ''))}
            placeholder="e.g. 5"
            inputMode="decimal"
          />
        </Field>
        {product ? (
          <p className="text-sm font-medium text-muted">
            In stock: {product.current_stock.toLocaleString()} {product.unit}
          </p>
        ) : null}

        <Field label="What happened">
          <FormInput value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Spoiled in the rain" />
        </Field>
        <Field label="Date">
          <FormInput type="date" value={date} max={toDateString(new Date())} onChange={(e) => setDate(e.target.value)} />
        </Field>

        {error ? <MessageBox tone="danger" message={error} /> : null}

        <PrimaryButton label="Write off" onClick={handleSubmit} disabled={!canSubmit} loading={submitting} />
      </Page>
    </>
  );
}
