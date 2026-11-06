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
import { recordProductPurchase } from '@/lib/finance-api';
import { formatMoney, toDateString } from '@/lib/format';
import { listMoneyAccounts, type MoneyAccount } from '@/lib/money-api';
import { listProducts } from '@/lib/products-api';
import type { Product } from '@/types/catalog';

export default function NewProductPurchasePage() {
  const router = useRouter();
  const toast = useToast();
  const { activeBusinessId } = useBusinessAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [accounts, setAccounts] = useState<MoneyAccount[]>([]);
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [totalCost, setTotalCost] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(() => toDateString(new Date()));
  const [supplier, setSupplier] = useState('');
  const [paidFrom, setPaidFrom] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeBusinessId) return;
    try {
      const [productData, accountData] = await Promise.all([listProducts(activeBusinessId), listMoneyAccounts(activeBusinessId)]);
      const active = productData.filter((p) => p.is_active);
      setProducts(active);
      setAccounts(accountData);
      setProductId((current) => current || active[0]?.id || '');
      setPaidFrom((current) => current || accountData.find((a) => a.kind === 'cash')?.id || 'credit');
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load products.'));
    }
  }, [activeBusinessId]);

  useFocusEffect(load);

  const product = products.find((p) => p.id === productId);
  const quantityNumber = Number(quantity);
  const costNumber = Number(totalCost);
  const canSubmit =
    !!activeBusinessId &&
    !!product &&
    Number.isFinite(quantityNumber) &&
    quantityNumber > 0 &&
    totalCost !== '' &&
    Number.isFinite(costNumber) &&
    costNumber >= 0 &&
    !!paidFrom &&
    /^\d{4}-\d{2}-\d{2}$/.test(purchaseDate) &&
    !submitting;

  async function handleSubmit() {
    if (!canSubmit || !activeBusinessId || !product) return;
    setSubmitting(true);
    setError(null);
    try {
      await recordProductPurchase({
        businessId: activeBusinessId,
        productId: product.id,
        quantity: quantityNumber,
        totalCost: costNumber,
        purchaseDate,
        supplier: supplier.trim() || null,
        accountId: paidFrom === 'credit' ? null : paidFrom,
        onCredit: paidFrom === 'credit',
      });
      toast.show('Purchase recorded');
      router.back();
    } catch (err) {
      setError(getErrorMessage(err, 'Could not record this purchase.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <ScreenHeader title="Buy finished goods" back />
      <Page narrow>
        <SectionLabel>Product</SectionLabel>
        <ChipRow options={products.map((p) => ({ value: p.id, label: p.name }))} value={productId} onChange={setProductId} />

        <Field label={`Quantity${product ? ` (${product.unit})` : ''}`}>
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
            placeholder="Total on the receipt"
            inputMode="decimal"
          />
        </Field>
        {quantityNumber > 0 && totalCost !== '' ? (
          <p className="text-sm font-medium tabular-nums text-muted">
            Cost per {product?.unit ?? 'unit'}: {formatMoney(costNumber / quantityNumber)}
            {product ? ` · sells for ${formatMoney(product.unit_price)}` : ''}
          </p>
        ) : null}

        <Field label="Date">
          <FormInput type="date" value={purchaseDate} max={toDateString(new Date())} onChange={(e) => setPurchaseDate(e.target.value)} />
        </Field>
        <Field label="Supplier">
          <FormInput value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="Optional" />
        </Field>

        <SectionLabel>Paid from</SectionLabel>
        <ChipRow
          options={[...accounts.map((a) => ({ value: a.id, label: a.name })), { value: 'credit', label: 'On credit (pay later)' }]}
          value={paidFrom}
          onChange={setPaidFrom}
        />

        {error ? <MessageBox tone="danger" message={error} /> : null}

        <PrimaryButton label="Record purchase" onClick={handleSubmit} disabled={!canSubmit} loading={submitting} />
      </Page>
    </>
  );
}
