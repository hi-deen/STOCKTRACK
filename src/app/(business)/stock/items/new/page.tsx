'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { CategoryChips } from '@/components/category-chips';
import { Field, FormInput } from '@/components/form-input';
import { MessageBox } from '@/components/message-box';
import { Page } from '@/components/page';
import { PrimaryButton } from '@/components/primary-button';
import { ScreenHeader } from '@/components/screen-header';
import { useToast } from '@/components/toast';
import { useBusinessAuth } from '@/lib/business-auth-context';
import { getErrorMessage } from '@/lib/error-message';
import { createStockItem } from '@/lib/stock-items-api';
import type { StockItemCategory } from '@/types/stock';

export default function NewStockItemPage() {
  const router = useRouter();
  const toast = useToast();
  const { activeBusinessId } = useBusinessAuth();

  const [name, setName] = useState('');
  const [category, setCategory] = useState<StockItemCategory>('raw_material');
  const [unit, setUnit] = useState('');
  const [reorderLevel, setReorderLevel] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reorderNumber = reorderLevel.trim() ? Number(reorderLevel) : null;
  const canSubmit =
    name.trim().length > 0 &&
    unit.trim().length > 0 &&
    (reorderNumber === null || Number.isFinite(reorderNumber)) &&
    !!activeBusinessId;

  async function handleSubmit() {
    if (!canSubmit || isSubmitting || !activeBusinessId) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await createStockItem(activeBusinessId, { name: name.trim(), category, unit: unit.trim(), reorder_level: reorderNumber });
      toast.show('Stock item added');
      router.back();
    } catch (err) {
      setError(getErrorMessage(err, 'Could not create this stock item.'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <ScreenHeader title="New stock item" back />
      <Page narrow>
        <Field label="Name">
          <FormInput value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Flour" />
        </Field>
        <div className="space-y-1.5">
          <span className="block text-sm font-bold">Category</span>
          <CategoryChips
            value={category}
            onChange={setCategory}
            options={[
              { value: 'raw_material', label: 'Raw material' },
              { value: 'packaging', label: 'Packaging' },
            ]}
          />
        </div>
        <Field label="Unit">
          <FormInput value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="e.g. kg, bag, roll" />
        </Field>
        <Field label="Reorder level (optional)">
          <FormInput
            value={reorderLevel}
            onChange={(e) => setReorderLevel(e.target.value.replace(/[^0-9.]/g, ''))}
            placeholder="Alert when quantity drops to this or below"
            inputMode="decimal"
          />
        </Field>
        {error ? <MessageBox tone="danger" message={error} /> : null}
        <PrimaryButton label="Create stock item" onClick={handleSubmit} disabled={!canSubmit} loading={isSubmitting} />
      </Page>
    </>
  );
}
