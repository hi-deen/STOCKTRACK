'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';

import { BackToTopButton } from '@/components/back-to-top-button';
import { ActionSheet, type SheetAction } from '@/components/bottom-sheet';
import { EmptyState } from '@/components/empty-state';
import { Fab } from '@/components/fab';
import { FormInput } from '@/components/form-input';
import { ListRow } from '@/components/list-row';
import { MessageBox } from '@/components/message-box';
import { Page } from '@/components/page';
import { PeriodFilter } from '@/components/period-filter';
import { PromptModal } from '@/components/prompt-modal';
import { ScreenHeader } from '@/components/screen-header';
import { ShowMoreControls } from '@/components/show-more-controls';
import { SkeletonRows } from '@/components/skeleton';
import { useToast } from '@/components/toast';
import { useFocusEffect } from '@/hooks/use-focus-effect';
import { usePeriod } from '@/hooks/use-period';
import { useBusinessAuth } from '@/lib/business-auth-context';
import { getErrorMessage } from '@/lib/error-message';
import { formatDate, formatMoney } from '@/lib/format';
import { listStockItems } from '@/lib/stock-items-api';
import { deletePurchase, listPurchases, purchaseQuantityLabel } from '@/lib/stock-purchases-api';
import type { StockItem, StockPurchase } from '@/types/stock';
import { listMoneyAccounts, payPurchase, todayString, type MoneyAccount } from '@/lib/money-api';

const PAGE_SIZE = 50;
// Search and the period filter run in the browser over this many rows.
const FETCH_LIMIT = 500;

export default function PurchasesListPage() {
  const router = useRouter();
  const toast = useToast();
  const { activeBusinessId, can } = useBusinessAuth();
  const canEditStockRecords = can('manage_stock_records');

  const [purchases, setPurchases] = useState<StockPurchase[] | null>(null);
  const [items, setItems] = useState<Map<string, StockItem>>(new Map());
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const period = usePeriod('all');
  const [shownCount, setShownCount] = useState(PAGE_SIZE);
  const [selected, setSelected] = useState<StockPurchase | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [accounts, setAccounts] = useState<MoneyAccount[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeBusinessId) return;
    try {
      const [purchasesData, itemsData] = await Promise.all([listPurchases(activeBusinessId, FETCH_LIMIT), listStockItems(activeBusinessId)]);
      setPurchases(purchasesData);
      setItems(new Map(itemsData.map((i) => [i.id, i])));
      setAccounts(await listMoneyAccounts(activeBusinessId));
      setLoadError(null);
    } catch (err) {
      setLoadError(getErrorMessage(err, 'Could not load purchases.'));
    }
  }, [activeBusinessId]);

  useFocusEffect(load);

  async function handlePay(accountId: string) {
    if (!selected) return;
    try {
      await payPurchase(selected.id, accountId, todayString());
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
      await deletePurchase(selected.id, reason.trim());
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

  const searchText = search.trim().toLowerCase();
  const filtered = (purchases ?? []).filter((p) => {
    if (period.preset !== 'all' && (p.purchase_date < period.start || p.purchase_date > period.end)) return false;
    if (searchText === '') return true;
    const itemName = items.get(p.stock_item_id)?.name ?? '';
    return `${itemName} ${p.supplier ?? ''}`.toLowerCase().includes(searchText);
  });

  const selectedItemName = selected ? (items.get(selected.stock_item_id)?.name ?? 'Unknown item') : '';

  const canPay = can('manage_money');
  const sheetActions: SheetAction[] = [];
  if (selected && !selected.account_id && canPay) {
    sheetActions.push({ icon: 'cash-outline', label: 'Mark as paid', onPress: () => setPayOpen(true) });
  }
  if (canEditStockRecords) {
    sheetActions.push(
      { icon: 'create-outline', label: 'Edit purchase', onPress: () => router.push(`/stock/purchases/${selected?.id}/edit`) },
      {
        icon: 'trash-outline',
        label: 'Delete purchase',
        tone: 'danger',
        onPress: () => {
          if (selected && selected.remaining_quantity < selected.quantity) {
            toast.show('Used in production runs. Edit or delete those runs first.');
            return;
          }
          setDeleteError(null);
          setDeleteOpen(true);
        },
      }
    );
  }

  return (
    <>
      <ScreenHeader
        title="Purchases"
        back
        primaryActions={[{ icon: 'refresh', label: 'Refresh', onPress: load }]}
        overflowActions={[{ icon: 'cart-outline', label: 'Bought-in goods', onPress: () => router.push('/stock/product-purchases') }]}
      />
      <Page narrow>
        {canEditStockRecords ? null : <p className="text-sm font-medium text-muted">You do not have permission to edit or delete purchases.</p>}

        {purchases === null && !loadError ? <SkeletonRows /> : null}
        {loadError ? <MessageBox tone="danger" message={loadError} /> : null}

        {purchases !== null && purchases.length === 0 ? (
          <EmptyState
            icon="cart-outline"
            title="No purchases yet"
            message="Recorded purchases will appear here."
            actionLabel="Record purchase"
            onAction={() => router.push('/stock/purchases/new')}
          />
        ) : null}

        {purchases !== null && purchases.length > 0 ? (
          <div className="space-y-2">
            <FormInput
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setShownCount(PAGE_SIZE);
              }}
              placeholder="Search item or supplier"
            />
            <PeriodFilter period={period} includeAll />
          </div>
        ) : null}

        {purchases !== null && purchases.length > 0 && filtered.length === 0 ? (
          <p className="text-sm font-medium text-muted">No purchases match.</p>
        ) : null}

        <div>
          {filtered.slice(0, shownCount).map((purchase) => {
            const item = items.get(purchase.stock_item_id);
            return (
              <ListRow
                key={purchase.id}
                onClick={
                  canEditStockRecords || (!purchase.account_id && can('manage_money'))
                    ? () => {
                        setSelected(purchase);
                        setSheetOpen(true);
                      }
                    : undefined
                }
                title={item?.name ?? 'Unknown item'}
                subtitle={`${purchaseQuantityLabel(purchase, item?.unit ?? '')} · ${formatDate(purchase.purchase_date)}${purchase.supplier ? ` · ${purchase.supplier}` : ''}${purchase.account_id ? '' : ' · On credit'}`}
                trailingText={formatMoney(purchase.total_cost)}
              />
            );
          })}
        </div>
        <ShowMoreControls onShowMore={filtered.length > shownCount ? () => setShownCount((n) => n + PAGE_SIZE) : undefined} />
      </Page>
      {can('record_stock') ? (
        <Fab label="Record purchase" onPress={() => router.push('/stock/purchases/new')} />
      ) : null}
      <ActionSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={selectedItemName}
        actions={sheetActions}
      />
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
        description={`This removes ${selected?.quantity.toLocaleString() ?? ''} ${items.get(selected?.stock_item_id ?? '')?.unit ?? ''} of ${selectedItemName} from stock. It can't be undone.`}
        placeholder="Reason for deleting"
        submitLabel="Delete"
        loading={deleting}
        error={deleteError}
        onCancel={() => setDeleteOpen(false)}
        onSubmit={handleDelete}
      />
      <BackToTopButton />
    </>
  );
}
