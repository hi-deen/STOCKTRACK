'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';

import { BackToTopButton } from '@/components/back-to-top-button';
import { ActionSheet } from '@/components/bottom-sheet';
import { ChipRow } from '@/components/chip-row';
import { EmptyState } from '@/components/empty-state';
import { Fab } from '@/components/fab';
import { FormInput } from '@/components/form-input';
import { ListRow } from '@/components/list-row';
import { MessageBox } from '@/components/message-box';
import { Page } from '@/components/page';
import { PromptModal } from '@/components/prompt-modal';
import { ScreenHeader } from '@/components/screen-header';
import { ShowMoreControls } from '@/components/show-more-controls';
import { SkeletonRows } from '@/components/skeleton';
import { useToast } from '@/components/toast';
import { useFocusEffect } from '@/hooks/use-focus-effect';
import { useBusinessAuth } from '@/lib/business-auth-context';
import { getErrorMessage } from '@/lib/error-message';
import { formatDate, formatMoney, toDateString } from '@/lib/format';
import { listStockItems } from '@/lib/stock-items-api';
import { deletePurchase, listPurchases, purchaseQuantityLabel } from '@/lib/stock-purchases-api';
import type { StockItem, StockPurchase } from '@/types/stock';

const PAGE_SIZE = 50;
// Search and the period filter run in the browser over this many rows.
const FETCH_LIMIT = 500;

type Period = 'all' | 'month' | 'last_month';

function monthBounds(offset: number): { start: string; end: string } {
  const now = new Date();
  return {
    start: toDateString(new Date(now.getFullYear(), now.getMonth() + offset, 1)),
    end: toDateString(new Date(now.getFullYear(), now.getMonth() + offset + 1, 0)),
  };
}

export default function PurchasesListPage() {
  const router = useRouter();
  const toast = useToast();
  const { activeBusinessId, activeMembership } = useBusinessAuth();
  const isOwner = activeMembership?.role === 'owner';

  const [purchases, setPurchases] = useState<StockPurchase[] | null>(null);
  const [items, setItems] = useState<Map<string, StockItem>>(new Map());
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState<Period>('all');
  const [shownCount, setShownCount] = useState(PAGE_SIZE);
  const [selected, setSelected] = useState<StockPurchase | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeBusinessId) return;
    try {
      const [purchasesData, itemsData] = await Promise.all([listPurchases(activeBusinessId, FETCH_LIMIT), listStockItems(activeBusinessId)]);
      setPurchases(purchasesData);
      setItems(new Map(itemsData.map((i) => [i.id, i])));
      setLoadError(null);
    } catch (err) {
      setLoadError(getErrorMessage(err, 'Could not load purchases.'));
    }
  }, [activeBusinessId]);

  useFocusEffect(load);

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
  const bounds = period === 'all' ? null : monthBounds(period === 'month' ? 0 : -1);
  const filtered = (purchases ?? []).filter((p) => {
    if (bounds && (p.purchase_date < bounds.start || p.purchase_date > bounds.end)) return false;
    if (searchText === '') return true;
    const itemName = items.get(p.stock_item_id)?.name ?? '';
    return `${itemName} ${p.supplier ?? ''}`.toLowerCase().includes(searchText);
  });

  const selectedItemName = selected ? (items.get(selected.stock_item_id)?.name ?? 'Unknown item') : '';

  return (
    <>
      <ScreenHeader title="Purchases" back primaryActions={[{ icon: 'refresh', label: 'Refresh', onPress: load }]} />
      <Page narrow>
        {isOwner ? null : <p className="text-sm font-medium text-muted">Only the business owner can edit or delete purchases.</p>}

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
            <ChipRow
              options={[
                { value: 'all', label: 'All' },
                { value: 'month', label: 'This month' },
                { value: 'last_month', label: 'Last month' },
              ]}
              value={period}
              onChange={(next) => {
                setPeriod(next);
                setShownCount(PAGE_SIZE);
              }}
            />
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
                  isOwner
                    ? () => {
                        setSelected(purchase);
                        setSheetOpen(true);
                      }
                    : undefined
                }
                title={item?.name ?? 'Unknown item'}
                subtitle={`${purchaseQuantityLabel(purchase, item?.unit ?? '')} · ${formatDate(purchase.purchase_date)}${purchase.supplier ? ` · ${purchase.supplier}` : ''}`}
                trailingText={formatMoney(purchase.total_cost)}
              />
            );
          })}
        </div>
        <ShowMoreControls onShowMore={filtered.length > shownCount ? () => setShownCount((n) => n + PAGE_SIZE) : undefined} />
      </Page>
      <Fab label="Record purchase" onPress={() => router.push('/stock/purchases/new')} />
      <ActionSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={selectedItemName}
        actions={[
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
          },
        ]}
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
