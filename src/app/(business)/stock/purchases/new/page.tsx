'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';

import { PressableCard } from '@/components/card';
import { Field, FormInput } from '@/components/form-input';
import { MessageBox } from '@/components/message-box';
import { Page, SectionLabel } from '@/components/page';
import { PrimaryButton } from '@/components/primary-button';
import { ScreenHeader } from '@/components/screen-header';
import { Skeleton } from '@/components/skeleton';
import { useToast } from '@/components/toast';
import { useFocusEffect } from '@/hooks/use-focus-effect';
import { useBusinessAuth } from '@/lib/business-auth-context';
import { getErrorMessage } from '@/lib/error-message';
import { formatMoney, toDateString } from '@/lib/format';
import { listStockItems } from '@/lib/stock-items-api';
import { recordPurchase } from '@/lib/stock-purchases-api';
import type { StockItem } from '@/types/stock';

export default function RecordPurchasePage() {
  const router = useRouter();
  const toast = useToast();
  const { activeBusinessId, userId } = useBusinessAuth();

  const [items, setItems] = useState<StockItem[] | null>(null);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState('');
  const [totalCost, setTotalCost] = useState('');
  const [supplier, setSupplier] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(() => toDateString(new Date()));
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeBusinessId) return;
    try {
      const data = await listStockItems(activeBusinessId);
      setItems(data.filter((i) => i.is_active));
    } catch (err) {
      setItemsError(getErrorMessage(err, 'Could not load stock items.'));
    }
  }, [activeBusinessId]);

  useFocusEffect(load);

  const quantityNumber = Number(quantity);
  const totalCostNumber = Number(totalCost);
  const canSubmit =
    !!activeBusinessId &&
    !!selectedItemId &&
    Number.isFinite(quantityNumber) &&
    quantityNumber > 0 &&
    Number.isFinite(totalCostNumber) &&
    totalCostNumber >= 0 &&
    /^\d{4}-\d{2}-\d{2}$/.test(purchaseDate) &&
    !submitting;

  async function handleSubmit() {
    if (!canSubmit || !activeBusinessId || !selectedItemId) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await recordPurchase({
        businessId: activeBusinessId,
        stockItemId: selectedItemId,
        quantity: quantityNumber,
        totalCost: totalCostNumber,
        purchaseDate,
        supplier: supplier.trim() || null,
        createdBy: userId,
      });
      toast.show('Purchase recorded');
      router.back();
    } catch (err) {
      setSubmitError(getErrorMessage(err, 'Could not record this purchase.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <ScreenHeader title="Record purchase" back />
      <Page narrow>
        {items === null && !itemsError ? <Skeleton height={64} /> : null}
        {itemsError ? <MessageBox tone="danger" message={itemsError} /> : null}
        {items !== null && items.length === 0 ? (
          <MessageBox tone="neutral" message="No stock items yet. Add one from the Stock tab first." />
        ) : null}

        {items !== null && items.length > 0 ? (
          <>
            <SectionLabel>Item</SectionLabel>
            <div className="grid gap-2 sm:grid-cols-2">
              {items.map((item) => (
                <PressableCard key={item.id} selected={item.id === selectedItemId} onClick={() => setSelectedItemId(item.id)}>
                  <span className="block text-sm font-bold">{item.name}</span>
                  <span className="mt-0.5 block text-sm font-medium text-muted">
                    {item.category === 'raw_material' ? 'Raw material' : 'Packaging'} · has{' '}
                    {item.current_quantity.toLocaleString()} {item.unit}
                  </span>
                </PressableCard>
              ))}
            </div>

            <Field label="Quantity purchased">
              <FormInput
                value={quantity}
                onChange={(e) => setQuantity(e.target.value.replace(/[^0-9.]/g, ''))}
                placeholder="e.g. 50"
                inputMode="decimal"
              />
            </Field>
            <Field label="Total cost paid">
              <FormInput
                value={totalCost}
                onChange={(e) => setTotalCost(e.target.value.replace(/[^0-9.]/g, ''))}
                placeholder="Total on the receipt, not per unit"
                inputMode="decimal"
              />
            </Field>
            {quantityNumber > 0 && totalCostNumber >= 0 ? (
              <p className="tabular-nums text-muted">Unit cost: {formatMoney(totalCostNumber / quantityNumber)}</p>
            ) : null}

            <Field label="Purchase date">
              <FormInput type="date" value={purchaseDate} max={toDateString(new Date())} onChange={(e) => setPurchaseDate(e.target.value)} />
            </Field>
            <Field label="Supplier">
              <FormInput value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="Optional" />
            </Field>

            {submitError ? <MessageBox tone="danger" message={submitError} /> : null}

            <PrimaryButton label="Record purchase" onClick={handleSubmit} disabled={!canSubmit} loading={submitting} />
          </>
        ) : null}
      </Page>
    </>
  );
}
