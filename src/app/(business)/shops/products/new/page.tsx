'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Field, FormInput } from '@/components/form-input';
import { MessageBox } from '@/components/message-box';
import { Page } from '@/components/page';
import { PrimaryButton } from '@/components/primary-button';
import { ScreenHeader } from '@/components/screen-header';
import { useToast } from '@/components/toast';
import { useBusinessAuth } from '@/lib/business-auth-context';
import { getErrorMessage } from '@/lib/error-message';
import { createProduct } from '@/lib/products-api';

export default function NewProductPage() {
  const router = useRouter();
  const { activeBusinessId } = useBusinessAuth();
  const toast = useToast();

  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [reorderLevel, setReorderLevel] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const priceNumber = Number(unitPrice);
  const reorderNumber = reorderLevel.trim() ? Number(reorderLevel) : null;
  const canSubmit =
    name.trim().length > 0 &&
    unit.trim().length > 0 &&
    Number.isFinite(priceNumber) &&
    priceNumber >= 0 &&
    (reorderNumber === null || Number.isFinite(reorderNumber)) &&
    !!activeBusinessId;

  async function handleSubmit() {
    if (!canSubmit || isSubmitting || !activeBusinessId) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await createProduct(activeBusinessId, {
        name: name.trim(),
        unit: unit.trim(),
        unit_price: priceNumber,
        reorder_level: reorderNumber,
      });
      toast.show('Product created');
      router.back();
    } catch (err) {
      setError(getErrorMessage(err, 'Could not create this product.'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <ScreenHeader back title="New product" />
      <Page narrow>
        <Field label="Name">
          <FormInput value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Cooking gas 12.5kg" />
        </Field>
        <Field label="Unit">
          <FormInput value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="e.g. cylinder, crate, bag" />
        </Field>
        <Field label="Unit price">
          <FormInput
            value={unitPrice}
            onChange={(e) => setUnitPrice(e.target.value.replace(/[^0-9.]/g, ''))}
            placeholder="0"
            inputMode="decimal"
          />
        </Field>
        <Field label="Reorder level (optional)">
          <FormInput
            value={reorderLevel}
            onChange={(e) => setReorderLevel(e.target.value.replace(/[^0-9.]/g, ''))}
            placeholder="Alert when stock drops to this or below"
            inputMode="decimal"
          />
        </Field>
        {error ? <MessageBox tone="danger" message={error} /> : null}
        <PrimaryButton label="Create product" onClick={handleSubmit} disabled={!canSubmit} loading={isSubmitting} />
      </Page>
    </>
  );
}
