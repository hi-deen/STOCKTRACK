'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';

import { ActionSheet, type SheetAction } from '@/components/bottom-sheet';
import { EmptyState } from '@/components/empty-state';
import { Fab } from '@/components/fab';
import { ListRow } from '@/components/list-row';
import { MessageBox } from '@/components/message-box';
import { Page } from '@/components/page';
import { PromptModal } from '@/components/prompt-modal';
import { ScreenHeader } from '@/components/screen-header';
import { SkeletonRows } from '@/components/skeleton';
import { useToast } from '@/components/toast';
import { useFocusEffect } from '@/hooks/use-focus-effect';
import { useBusinessAuth } from '@/lib/business-auth-context';
import { getErrorMessage } from '@/lib/error-message';
import { deleteProductPurchase, listProductPurchases, payProductPurchase, type ProductPurchase } from '@/lib/finance-api';
import { formatDate, formatMoney } from '@/lib/format';
import { listMoneyAccounts, todayString, type MoneyAccount } from '@/lib/money-api';
import { listProducts } from '@/lib/products-api';
import type { Product } from '@/types/catalog';

export default function ProductPurchasesPage() {
  const router = useRouter();
  const toast = useToast();
  const { activeBusinessId, can } = useBusinessAuth();

  const [purchases, setPurchases] = useState<ProductPurchase[] | null>(null);
  const [products, setProducts] = useState<Map<string, Product>>(new Map());
  const [accounts, setAccounts] = useState<MoneyAccount[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ProductPurchase | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeBusinessId) return;
    try {
      const [purchaseData, productData, accountData] = await Promise.all([
        listProductPurchases(activeBusinessId),
        listProducts(activeBusinessId),
        listMoneyAccounts(activeBusinessId),
      ]);
      setPurchases(purchaseData);
      setProducts(new Map(productData.map((p) => [p.id, p])));
      setAccounts(accountData);
      setLoadError(null);
    } catch (err) {
      setLoadError(getErrorMessage(err, 'Could not load purchases.'));
    }
  }, [activeBusinessId]);

  useFocusEffect(load);

  async function handlePay(accountId: string) {
    if (!selected) return;
    try {
      await payProductPurchase(selected.id, accountId, todayString());
      toast.show('Marked as paid');
      await load();
    } catch (err) {
      toast.show(getErrorMessage(err, 'Could not mark this as paid.'));
    }
  }

  async function handleDelete(reason: string) {
    if (!selected) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteProductPurchase(selected.id, reason.trim());
      setDeleteOpen(false);
      toast.show('Purchase deleted');
      await load();
    } catch (err) {
      setDeleteError(getErrorMessage(err, 'Could not delete this purchase.'));
    } finally {
      setDeleting(false);
    }
  }

  if (!activeBusinessId) return null;

  const canPay = can('manage_money');
  const canDelete = can('manage_stock_records');
  const sheetActions: SheetAction[] = [];
  if (selected && !selected.account_id && canPay) {
    sheetActions.push({ icon: 'cash-outline', label: 'Mark as paid', onPress: () => setPayOpen(true) });
  }
  if (canDelete) {
    sheetActions.push({
      icon: 'trash-outline',
      label: 'Delete purchase',
      tone: 'danger',
      onPress: () => {
        setDeleteError(null);
        setDeleteOpen(true);
      },
    });
  }
  const selectedName = selected ? (products.get(selected.product_id)?.name ?? 'Product') : '';

  return (
    <>
      <ScreenHeader title="Bought-in goods" back primaryActions={[{ icon: 'refresh', label: 'Refresh', onPress: load }]} />
      <Page narrow>
        <p className="text-sm font-medium text-muted">
          Finished products you buy to resell. Each purchase adds stock, and sales of it are costed at what you paid.
        </p>

        {purchases === null && !loadError ? <SkeletonRows /> : null}
        {loadError ? <MessageBox tone="danger" message={loadError} /> : null}

        {purchases !== null && purchases.length === 0 ? (
          <EmptyState icon="cart-outline" title="No purchases yet" message="Goods you buy to resell will appear here." />
        ) : null}

        <div>
          {(purchases ?? []).map((purchase) => {
            const product = products.get(purchase.product_id);
            const tappable = (!purchase.account_id && canPay) || canDelete;
            return (
              <ListRow
                key={purchase.id}
                onClick={
                  tappable
                    ? () => {
                        setSelected(purchase);
                        setSheetOpen(true);
                      }
                    : undefined
                }
                title={product?.name ?? 'Product'}
                subtitle={`${purchase.quantity.toLocaleString()} ${product?.unit ?? ''} · ${formatDate(purchase.purchase_date)}${purchase.supplier ? ` · ${purchase.supplier}` : ''}${purchase.account_id ? '' : ' · On credit'}`}
                trailingText={formatMoney(purchase.total_cost)}
              />
            );
          })}
        </div>
      </Page>
      {can('record_stock') ? <Fab label="Record purchase" onPress={() => router.push('/stock/product-purchases/new')} /> : null}
      <ActionSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} title={selectedName} actions={sheetActions} />
      <ActionSheet
        visible={payOpen}
        onClose={() => setPayOpen(false)}
        title="Paid from"
        actions={accounts.map((account) => ({
          icon: 'wallet-outline' as const,
          label: `Paid from ${account.name} today`,
          onPress: () => handlePay(account.id),
        }))}
      />
      <PromptModal
        visible={deleteOpen}
        title="Delete purchase"
        description={`This removes the ${selectedName} purchase and its stock. It can't be undone.`}
        placeholder="Reason for deleting"
        submitLabel="Delete"
        loading={deleting}
        error={deleteError}
        onCancel={() => setDeleteOpen(false)}
        onSubmit={handleDelete}
      />
    </>
  );
}
