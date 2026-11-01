'use client';

import { useParams, useRouter } from 'next/navigation';
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
import { editPurchase, getPurchase } from '@/lib/stock-purchases-api';
import type { StockItem, StockPurchase } from '@/types/stock';

export default function EditPurchasePage() {
  const router = useRouter();
  const toast = useToast();
  const { activeBusinessId } = useBusinessAuth();
  const { purchaseId } = useParams<{ purchaseId: string }>();

  const [purchase, setPurchase] = useState<StockPurchase | null>(null);
  const [items, setItems] = useState<StockItem[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState('');
  const [totalCost, setTotalCost] = useState('');
  const [supplier, setSupplier] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeBusinessId || !purchaseId) return;
    try {
      const [purchaseData, itemsData] = await Promise.all([getPurchase(purchaseId), listStockItems(activeBusinessId)]);
      setPurchase(purchaseData);
      setItems(itemsData);
      setSelectedItemId(purchaseData.stock_item_id);
      setQuantity(String(purchaseData.quantity));
      setTotalCost(String(purchaseData.total_cost));
      setSupplier(purchaseData.supplier ?? '');
      setPurchaseDate(purchaseData.purchase_date);
      setLoadError(null);
    } catch (err) {
      setLoadError(getErrorMessage(err, 'Could not load this purchase.'));
    }
  }, [activeBusinessId, purchaseId]);

  useFocusEffect(load);

  const used = purchase ? purchase.quantity - purchase.remaining_quantity : 0;
  const quantityNumber = Number(quantity);
  const totalCostNumber = Number(totalCost);
  const canSubmit =
    !!purchase &&
    !!selectedItemId &&
    Number.isFinite(quantityNumber) &&
    quantityNumber > 0 &&
    quantityNumber >= used &&
    Number.isFinite(totalCostNumber) &&
    totalCostNumber >= 0 &&
    /^\d{4}-\d{2}-\d{2}$/.test(purchaseDate) &&
    reason.trim().length > 0 &&
    !submitting;

  async function handleSubmit() {
    if (!canSubmit || !purchase || !selectedItemId) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await editPurchase({
        purchaseId: purchase.id,
        stockItemId: selectedItemId,
        quantity: quantityNumber,
        totalCost: totalCostNumber,
        purchaseDate,
        supplier: supplier.trim() || null,
        reason: reason.trim(),
      });
      toast.show('Purchase updated');
      router.back();
    } catch (err) {
      setSubmitError(getErrorMessage(err, 'Could not update this purchase.'));
    } finally {
      setSubmitting(false);
    }
  }

  const selectedUnit = items.find((i) => i.id === selectedItemId)?.unit ?? '';
  // A used purchase stays on its item; only active items are offered otherwise.
  const pickerItems = items.filter((i) => i.id === selectedItemId || (used === 0 && i.is_active));

  return (
    <>
      <ScreenHeader title="Edit purchase" back />
      <Page narrow>
        {purchase === null && !loadError ? <Skeleton height={64} /> : null}
        {loadError ? <MessageBox tone="danger" message={loadError} /> : null}

        {purchase ? (
          <>
            {used > 0 ? (
              <MessageBox
                tone="warning"
                message={`${used.toLocaleString()} ${selectedUnit} of this purchase is already used in production runs. Quantity can't go below that, the item can't change, and those runs keep the cost they recorded.`}
              />
            ) : null}

            <SectionLabel>Item</SectionLabel>
            <div className="grid gap-2 sm:grid-cols-2">
              {pickerItems.map((item) => (
                <PressableCard key={item.id} selected={item.id === selectedItemId} onClick={() => setSelectedItemId(item.id)}>
                  <span className="block text-sm font-bold">{item.name}</span>
                </PressableCard>
              ))}
            </div>

            <Field label="Quantity purchased">
              <FormInput value={quantity} onChange={(e) => setQuantity(e.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" />
            </Field>
            <Field label="Total cost paid">
              <FormInput value={totalCost} onChange={(e) => setTotalCost(e.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" />
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
            <Field label="Reason for edit">
              <FormInput value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Required" />
            </Field>

            {submitError ? <MessageBox tone="danger" message={submitError} /> : null}

            <PrimaryButton label="Save changes" onClick={handleSubmit} disabled={!canSubmit} loading={submitting} />
          </>
        ) : null}
      </Page>
    </>
  );
}
