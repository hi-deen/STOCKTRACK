'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';

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
import { formatDate, formatMoney, toDateString } from '@/lib/format';
import { listStockItems } from '@/lib/stock-items-api';
import { listPurchasesForItem, recordPurchase } from '@/lib/stock-purchases-api';
import type { StockItem, StockPurchase } from '@/types/stock';
import { ChipRow } from '@/components/chip-row';
import { listMoneyAccounts, type MoneyAccount } from '@/lib/money-api';

export default function RecordPurchasePage() {
  return (
    <Suspense>
      <RecordPurchaseForm />
    </Suspense>
  );
}

function RecordPurchaseForm() {
  const router = useRouter();
  const itemId = useSearchParams().get('itemId');
  const toast = useToast();
  const { activeBusinessId, userId } = useBusinessAuth();

  const [items, setItems] = useState<StockItem[] | null>(null);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(itemId);
  const [pickingItem, setPickingItem] = useState(!itemId);
  const [quantity, setQuantity] = useState('');
  const [totalCost, setTotalCost] = useState('');
  const [supplier, setSupplier] = useState('');
  const [supplierEdited, setSupplierEdited] = useState(false);
  const [lastPurchase, setLastPurchase] = useState<StockPurchase | null>(null);
  const [accounts, setAccounts] = useState<MoneyAccount[]>([]);
  const [paidFrom, setPaidFrom] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(() => toDateString(new Date()));
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeBusinessId) return;
    try {
      const data = await listStockItems(activeBusinessId);
      setItems(data.filter((i) => i.is_active));
      const accountList = await listMoneyAccounts(activeBusinessId);
      setAccounts(accountList);
      setPaidFrom((current) => current || accountList.find((a) => a.kind === 'cash')?.id || 'credit');
    } catch (err) {
      setItemsError(getErrorMessage(err, 'Could not load stock items.'));
    }
  }, [activeBusinessId]);

  useFocusEffect(load);

  // Suggests the item's last supplier until the user types their own.
  useEffect(() => {
    if (!selectedItemId) return;
    let active = true;
    listPurchasesForItem(selectedItemId, 1)
      .then((rows) => {
        if (!active) return;
        setLastPurchase(rows[0] ?? null);
        if (!supplierEdited) setSupplier(rows[0]?.supplier ?? '');
      })
      .catch(() => {
        if (active) setLastPurchase(null);
      });
    return () => {
      active = false;
    };
    // supplierEdited is read as it stands when the item changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedItemId]);

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

  const unitCost = quantityNumber > 0 ? totalCostNumber / quantityNumber : 0;
  const lastUnitCost = lastPurchase?.unit_cost ?? 0;
  const priceChange = unitCost > 0 && lastUnitCost > 0 ? Math.round(((unitCost - lastUnitCost) / lastUnitCost) * 100) : 0;

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
        accountId: paidFrom === 'credit' ? null : paidFrom || null,
        onCredit: paidFrom === 'credit',
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
              {items
                .filter((item) => pickingItem || item.id === selectedItemId)
                .map((item) => (
                <PressableCard
                  key={item.id}
                  selected={item.id === selectedItemId}
                  onClick={() => {
                    setSelectedItemId(item.id);
                    setPickingItem(false);
                  }}>
                  <span className="block text-sm font-bold">{item.name}</span>
                  <span className="mt-0.5 block text-sm font-medium text-muted">
                    {item.category === 'raw_material' ? 'Raw material' : 'Packaging'} · has{' '}
                    {item.current_quantity.toLocaleString()} {item.unit}
                  </span>
                </PressableCard>
              ))}
            </div>
            {!pickingItem ? (
              <button type="button" className="text-sm font-bold text-primary" onClick={() => setPickingItem(true)}>
                Change item
              </button>
            ) : null}

            {lastPurchase ? (
              <p className="text-sm font-medium tabular-nums text-muted">
                Last bought {formatDate(lastPurchase.purchase_date)} at {formatMoney(lastPurchase.unit_cost)} each
                {lastPurchase.supplier ? ` from ${lastPurchase.supplier}` : ''}
              </p>
            ) : null}

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
            {priceChange !== 0 ? (
              <p className={`text-sm font-bold ${priceChange > 0 ? 'text-warning' : 'text-success'}`}>
                {Math.abs(priceChange)}% {priceChange > 0 ? 'higher' : 'lower'} than last time
              </p>
            ) : null}

            <Field label="Purchase date">
              <FormInput type="date" value={purchaseDate} max={toDateString(new Date())} onChange={(e) => setPurchaseDate(e.target.value)} />
            </Field>
            <Field label="Supplier">
              <FormInput
                value={supplier}
                onChange={(e) => {
                  setSupplier(e.target.value);
                  setSupplierEdited(true);
                }}
                placeholder="Optional"
              />
            </Field>

            <SectionLabel>Paid from</SectionLabel>
            <ChipRow options={[...accounts.map((a) => ({ value: a.id, label: a.name })), { value: 'credit', label: 'On credit (pay later)' }]} value={paidFrom} onChange={setPaidFrom} />

            {submitError ? <MessageBox tone="danger" message={submitError} /> : null}

            <PrimaryButton label="Record purchase" onClick={handleSubmit} disabled={!canSubmit} loading={submitting} />
          </>
        ) : null}
      </Page>
    </>
  );
}
