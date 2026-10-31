'use client';

import { useEffect, useState } from 'react';

import { BottomSheet } from '@/components/bottom-sheet';
import { PressableCard } from '@/components/card';
import { Field, FormInput, FormTextarea } from '@/components/form-input';
import { MessageBox } from '@/components/message-box';
import { PrimaryButton } from '@/components/primary-button';
import { SectionLabel } from '@/components/page';
import { toDateString } from '@/lib/format';
import { listProductUnits } from '@/lib/product-units-api';
import type { Product } from '@/types/catalog';
import type { ProductUnit } from '@/types/stock';

interface EditDeliveryModalProps {
  visible: boolean;
  products: Product[];
  initialProductId: string | null;
  initialSellingUnitId: string | null;
  initialQuantity: number;
  initialDate: string;
  // Only owners may change a record's date.
  canEditDate: boolean;
  loading?: boolean;
  error?: string | null;
  onCancel: () => void;
  onSubmit: (productId: string, sellingUnitId: string, quantity: number, reason: string, date: string | null) => void;
}

// Pre-fills with the record's current values; reopening resets them so a
// dismissed edit never leaks into the next time this modal opens.
export function EditDeliveryModal({
  visible,
  products,
  initialProductId,
  initialSellingUnitId,
  initialQuantity,
  initialDate,
  canEditDate,
  loading,
  error,
  onCancel,
  onSubmit,
}: EditDeliveryModalProps) {
  const [productId, setProductId] = useState<string | null>(initialProductId);
  const [sellingUnitId, setSellingUnitId] = useState<string | null>(initialSellingUnitId);
  const [units, setUnits] = useState<ProductUnit[]>([]);
  const [quantity, setQuantity] = useState(String(initialQuantity));
  const [reason, setReason] = useState('');
  const [date, setDate] = useState(initialDate);

  useEffect(() => {
    if (visible) {
      setProductId(initialProductId);
      setSellingUnitId(initialSellingUnitId);
      setQuantity(String(initialQuantity));
      setReason('');
      setDate(initialDate);
    }
  }, [visible, initialProductId, initialSellingUnitId, initialQuantity, initialDate]);

  useEffect(() => {
    if (!visible || !productId) {
      setUnits([]);
      return;
    }
    let cancelled = false;
    listProductUnits(productId).then((data) => {
      if (cancelled) return;
      setUnits(data);
      // The selected unit belonged to the previous product — fall back to the
      // new product's base unit (base_unit_quantity === 1).
      if (!data.some((u) => u.id === sellingUnitId)) {
        setSellingUnitId(data.find((u) => u.base_unit_quantity === 1)?.id ?? data[0]?.id ?? null);
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deliberately not re-fetching on sellingUnitId change
  }, [visible, productId]);

  const quantityNumber = Number(quantity);
  const canSubmit =
    !!productId && !!sellingUnitId && Number.isFinite(quantityNumber) && quantityNumber > 0 && reason.trim().length > 0 && (!canEditDate || !!date);

  return (
    <BottomSheet visible={visible} onClose={onCancel} title="Edit delivery">
      <div className="space-y-3 pb-2">
        <SectionLabel>Product</SectionLabel>
        <div className="grid max-h-56 gap-2 overflow-y-auto sm:grid-cols-2">
          {products.map((product) => (
            <PressableCard key={product.id} selected={product.id === productId} onClick={() => setProductId(product.id)}>
              <span className="block text-sm font-bold">{product.name}</span>
              <span className="block text-sm font-medium text-muted">
                {product.unit} · unit price {product.unit_price.toLocaleString()}
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
                  selected={unit.id === sellingUnitId}
                  onClick={() => setSellingUnitId(unit.id)}
                  className="!w-auto min-w-[90px]">
                  <span className="text-sm font-bold">{unit.name}</span>
                </PressableCard>
              ))}
            </div>
          </>
        ) : null}

        <Field label="Quantity">
          <FormInput value={quantity} onChange={(e) => setQuantity(e.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" />
        </Field>
        {canEditDate ? (
          <Field label="Date">
            <FormInput type="date" value={date} max={toDateString(new Date())} onChange={(e) => setDate(e.target.value)} />
          </Field>
        ) : null}
        <Field label="Reason for edit">
          <FormTextarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="What changed and why" />
        </Field>

        {error ? <MessageBox tone="danger" message={error} /> : null}

        <div className="flex items-center justify-end gap-4">
          <button type="button" onClick={onCancel} className="px-2 py-2 text-muted">
            Cancel
          </button>
          <div className="min-w-[130px]">
            <PrimaryButton
              label="Save changes"
              onClick={() => productId && sellingUnitId && onSubmit(productId, sellingUnitId, quantityNumber, reason.trim(), canEditDate ? date : null)}
              disabled={!canSubmit}
              loading={loading}
            />
          </div>
        </div>
      </div>
    </BottomSheet>
  );
}
