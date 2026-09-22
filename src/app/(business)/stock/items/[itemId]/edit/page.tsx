'use client';

import { useParams, useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';

import { CategoryChips } from '@/components/category-chips';
import { Field, FormInput } from '@/components/form-input';
import { MessageBox } from '@/components/message-box';
import { Page } from '@/components/page';
import { PrimaryButton } from '@/components/primary-button';
import { ScreenHeader } from '@/components/screen-header';
import { SkeletonRows } from '@/components/skeleton';
import { SwitchRow } from '@/components/switch-row';
import { useToast } from '@/components/toast';
import { useFocusEffect } from '@/hooks/use-focus-effect';
import { useBusinessAuth } from '@/lib/business-auth-context';
import { getErrorMessage } from '@/lib/error-message';
import { listStockItems, updateStockItem } from '@/lib/stock-items-api';
import type { StockItem, StockItemCategory } from '@/types/stock';

// Viewing is open to every business member; editing is owner-only.
export default function EditStockItemPage() {
  const router = useRouter();
  const toast = useToast();
  const { activeBusinessId, activeMembership } = useBusinessAuth();
  const { itemId } = useParams<{ itemId: string }>();
  const isOwner = activeMembership?.role === 'owner';

  const [item, setItem] = useState<StockItem | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<StockItemCategory>('raw_material');
  const [unit, setUnit] = useState('');
  const [reorderLevel, setReorderLevel] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeBusinessId || !itemId || dirty) return;
    try {
      const all = await listStockItems(activeBusinessId);
      const found = all.find((i) => i.id === itemId);
      if (!found) {
        setLoadError('Stock item not found.');
        return;
      }
      setItem(found);
      setName(found.name);
      setCategory(found.category);
      setUnit(found.unit);
      setReorderLevel(found.reorder_level === null ? '' : String(found.reorder_level));
      setIsActive(found.is_active);
      setLoadError(null);
    } catch (err) {
      setLoadError(getErrorMessage(err, 'Could not load this stock item.'));
    }
  }, [activeBusinessId, itemId, dirty]);

  useFocusEffect(load);

  const reorderNumber = reorderLevel.trim() ? Number(reorderLevel) : null;
  const canSubmit =
    isOwner && name.trim().length > 0 && unit.trim().length > 0 && (reorderNumber === null || Number.isFinite(reorderNumber)) && !!itemId;

  async function handleSubmit() {
    if (!canSubmit || isSubmitting || !itemId) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await updateStockItem(itemId, {
        name: name.trim(),
        category,
        unit: unit.trim(),
        reorder_level: reorderNumber,
        is_active: isActive,
      });
      toast.show('Saved');
      router.back();
    } catch (err) {
      setError(getErrorMessage(err, 'Could not save this stock item.'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <ScreenHeader title="Edit stock item" back />
      <Page narrow>
        {!item && !loadError ? <SkeletonRows count={4} avatar={false} /> : null}
        {loadError ? <MessageBox tone="danger" message={loadError} /> : null}

        {item ? (
          <>
            <p className="text-muted">
              Current quantity: {item.current_quantity.toLocaleString()} {item.unit}
            </p>
            {!isOwner ? <MessageBox tone="neutral" message="Only the business owner can edit stock item details." /> : null}

            <Field label="Name">
              <FormInput
                value={name}
                onChange={(e) => {
                  setDirty(true);
                  setName(e.target.value);
                }}
                disabled={!isOwner}
              />
            </Field>
            <div className="space-y-1.5">
              <span className="block text-sm font-bold">Category</span>
              <CategoryChips
                value={category}
                onChange={(v) => {
                  setDirty(true);
                  setCategory(v);
                }}
                disabled={!isOwner}
                options={[
                  { value: 'raw_material', label: 'Raw material' },
                  { value: 'packaging', label: 'Packaging' },
                ]}
              />
            </div>
            <Field label="Unit">
              <FormInput
                value={unit}
                onChange={(e) => {
                  setDirty(true);
                  setUnit(e.target.value);
                }}
                disabled={!isOwner}
              />
            </Field>
            <Field label="Reorder level (optional)">
              <FormInput
                value={reorderLevel}
                onChange={(e) => {
                  setDirty(true);
                  setReorderLevel(e.target.value.replace(/[^0-9.]/g, ''));
                }}
                inputMode="decimal"
                disabled={!isOwner}
              />
            </Field>
            <SwitchRow
              label="Active"
              value={isActive}
              onChange={(v) => {
                if (!isOwner) return;
                setDirty(true);
                setIsActive(v);
              }}
            />

            {error ? <MessageBox tone="danger" message={error} /> : null}

            {isOwner ? (
              <PrimaryButton label="Save changes" onClick={handleSubmit} disabled={!canSubmit} loading={isSubmitting} />
            ) : null}
          </>
        ) : null}
      </Page>
    </>
  );
}
