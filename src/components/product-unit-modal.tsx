'use client';

import { useEffect, useState } from 'react';

import { BottomSheet } from '@/components/bottom-sheet';
import { Field, FormInput } from '@/components/form-input';
import { MessageBox } from '@/components/message-box';
import { PrimaryButton } from '@/components/primary-button';
import type { ProductUnit } from '@/types/stock';

interface ProductUnitModalProps {
  visible: boolean;
  // null = creating a new unit; otherwise editing this one.
  editingUnit: ProductUnit | null;
  loading?: boolean;
  error?: string | null;
  onCancel: () => void;
  onSubmit: (input: { name: string; base_unit_quantity: number; default_price: number }) => void;
}

// Shared add/edit sheet for a product's selling units.
export function ProductUnitModal({ visible, editingUnit, loading, error, onCancel, onSubmit }: ProductUnitModalProps) {
  const [name, setName] = useState('');
  const [baseQuantity, setBaseQuantity] = useState('');
  const [price, setPrice] = useState('');

  useEffect(() => {
    if (visible) {
      setName(editingUnit?.name ?? '');
      setBaseQuantity(editingUnit ? String(editingUnit.base_unit_quantity) : '');
      setPrice(editingUnit ? String(editingUnit.default_price) : '');
    }
  }, [visible, editingUnit]);

  const baseQuantityNumber = Number(baseQuantity);
  const priceNumber = Number(price);
  const canSubmit =
    name.trim().length > 0 &&
    Number.isFinite(baseQuantityNumber) &&
    baseQuantityNumber > 0 &&
    Number.isFinite(priceNumber) &&
    priceNumber >= 0;

  return (
    <BottomSheet visible={visible} onClose={onCancel} title={editingUnit ? 'Edit selling unit' : 'New selling unit'}>
      <div className="space-y-4 pb-2">
        <Field label="Name">
          <FormInput value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Bag (70 pieces)" />
        </Field>
        <Field label="Equal to (in base units)">
          <FormInput
            value={baseQuantity}
            onChange={(e) => setBaseQuantity(e.target.value.replace(/[^0-9.]/g, ''))}
            placeholder="e.g. 70"
            inputMode="decimal"
          />
        </Field>
        <Field label="Default price">
          <FormInput
            value={price}
            onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ''))}
            placeholder="0"
            inputMode="decimal"
          />
        </Field>
        {error ? <MessageBox tone="danger" message={error} /> : null}
        <div className="flex items-center justify-end gap-4">
          <button type="button" onClick={onCancel} className="px-2 py-2 text-muted">
            Cancel
          </button>
          <div className="min-w-[130px]">
            <PrimaryButton
              label={editingUnit ? 'Save changes' : 'Add unit'}
              onClick={() =>
                onSubmit({ name: name.trim(), base_unit_quantity: baseQuantityNumber, default_price: priceNumber })
              }
              disabled={!canSubmit}
              loading={loading}
            />
          </div>
        </div>
      </div>
    </BottomSheet>
  );
}
