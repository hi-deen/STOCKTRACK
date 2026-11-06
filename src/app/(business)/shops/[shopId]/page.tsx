'use client';

import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';

import { ActionSheet, type SheetAction } from '@/components/bottom-sheet';
import { Card } from '@/components/card';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { EditDeliveryModal } from '@/components/edit-delivery-modal';
import { EditPaymentModal } from '@/components/edit-payment-modal';
import { EmptyState } from '@/components/empty-state';
import { ListRow } from '@/components/list-row';
import { MessageBox } from '@/components/message-box';
import { Page, SectionLabel } from '@/components/page';
import { PrimaryButton } from '@/components/primary-button';
import { PromptModal } from '@/components/prompt-modal';
import { ScreenHeader } from '@/components/screen-header';
import { SettingsDivider, SettingsRow } from '@/components/settings-row';
import { ShowMoreControls } from '@/components/show-more-controls';
import { Skeleton, SkeletonRows } from '@/components/skeleton';
import { useFocusEffect } from '@/hooks/use-focus-effect';
import { useBusinessAuth } from '@/lib/business-auth-context';
import { callPhone } from '@/lib/call-phone';
import { getErrorMessage } from '@/lib/error-message';
import { formatDate, formatMoney } from '@/lib/format';
import {
  editDelivery,
  editPayment,
  hardDeleteDelivery,
  hardDeletePayment,
  isHardDeleteEligible,
  voidDelivery,
  voidPayment,
} from '@/lib/operations-api';
import { listProducts } from '@/lib/products-api';
import { deleteShop, getShop, getShopBalance, listShopDeliveries, listShopPayments, updateShop } from '@/lib/shops-api';
import { getSignedPhotoUrl } from '@/lib/upload-photo';
import type { Product, Shop, ShopDelivery, ShopPayment } from '@/types/catalog';

type RecordTarget = { type: 'delivery' | 'payment'; id: string };

const INITIAL_VISIBLE = 5;
const SHOW_MORE_STEP = 10;

export default function ShopDetailPage() {
  const router = useRouter();
  const { activeBusinessId, userId, can } = useBusinessAuth();
  const canRemoveShops = can('remove_shops');
  const { shopId } = useParams<{ shopId: string }>();

  const [shop, setShop] = useState<Shop | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [deliveries, setDeliveries] = useState<ShopDelivery[]>([]);
  const [payments, setPayments] = useState<ShopPayment[]>([]);
  const [visibleDeliveries, setVisibleDeliveries] = useState(INITIAL_VISIBLE);
  const [visiblePayments, setVisiblePayments] = useState(INITIAL_VISIBLE);
  const [products, setProducts] = useState<Product[]>([]);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [voidTarget, setVoidTarget] = useState<RecordTarget | null>(null);
  const [voidLoading, setVoidLoading] = useState(false);
  const [voidError, setVoidError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<RecordTarget | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [editDeliveryTarget, setEditDeliveryTarget] = useState<ShopDelivery | null>(null);
  const [editPaymentTarget, setEditPaymentTarget] = useState<ShopPayment | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [actionRecord, setActionRecord] = useState<RecordTarget | null>(null);

  const [confirmShopDelete, setConfirmShopDelete] = useState(false);
  const [deletingShop, setDeletingShop] = useState(false);
  const [deleteShopError, setDeleteShopError] = useState<string | null>(null);

  const [confirmToggle, setConfirmToggle] = useState(false);
  const [updatingActiveState, setUpdatingActiveState] = useState(false);
  const [activeStateError, setActiveStateError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!shopId) return;
    try {
      const shopData = await getShop(shopId);
      setShop(shopData);
      const [balanceData, deliveriesData, paymentsData, productsData, signedUrl] = await Promise.all([
        getShopBalance(shopId),
        listShopDeliveries(shopId),
        listShopPayments(shopId),
        activeBusinessId ? listProducts(activeBusinessId) : Promise.resolve([]),
        shopData.photo_path ? getSignedPhotoUrl('shop-photos', shopData.photo_path) : Promise.resolve(null),
      ]);
      setBalance(balanceData);
      setDeliveries(deliveriesData);
      setPayments(paymentsData);
      setProducts(productsData);
      setPhotoUrl(signedUrl);
      setLoadError(null);
    } catch (err) {
      setLoadError(getErrorMessage(err, 'Could not load this shop.'));
    }
  }, [shopId, activeBusinessId]);

  useFocusEffect(load);

  async function handleVoidSubmit(reason: string) {
    if (!voidTarget) return;
    setVoidLoading(true);
    setVoidError(null);
    try {
      if (voidTarget.type === 'delivery') await voidDelivery(voidTarget.id, reason);
      else await voidPayment(voidTarget.id, reason);
      setVoidTarget(null);
      await load();
    } catch (err) {
      setVoidError(getErrorMessage(err, 'Could not void this record.'));
    } finally {
      setVoidLoading(false);
    }
  }

  async function handleDeleteSubmit(reason: string) {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      if (deleteTarget.type === 'delivery') await hardDeleteDelivery(deleteTarget.id, reason);
      else await hardDeletePayment(deleteTarget.id, reason);
      setDeleteTarget(null);
      await load();
    } catch (err) {
      setDeleteError(getErrorMessage(err, 'Could not delete this record.'));
    } finally {
      setDeleteLoading(false);
    }
  }

  async function handleEditDeliverySubmit(productId: string, sellingUnitId: string, quantity: number, reason: string, date: string | null) {
    if (!editDeliveryTarget) return;
    setEditLoading(true);
    setEditError(null);
    try {
      await editDelivery(editDeliveryTarget.id, productId, sellingUnitId, quantity, reason, date);
      setEditDeliveryTarget(null);
      await load();
    } catch (err) {
      setEditError(getErrorMessage(err, 'Could not save these changes.'));
    } finally {
      setEditLoading(false);
    }
  }

  async function handleEditPaymentSubmit(amount: number, reason: string, date: string | null) {
    if (!editPaymentTarget) return;
    setEditLoading(true);
    setEditError(null);
    try {
      await editPayment(editPaymentTarget.id, amount, reason, date);
      setEditPaymentTarget(null);
      await load();
    } catch (err) {
      setEditError(getErrorMessage(err, 'Could not save these changes.'));
    } finally {
      setEditLoading(false);
    }
  }

  async function runDeleteShop() {
    setDeletingShop(true);
    setDeleteShopError(null);
    try {
      await deleteShop(shopId);
      router.replace('/shops');
    } catch (err) {
      setConfirmShopDelete(false);
      setDeleteShopError(getErrorMessage(err, 'Could not delete this shop.'));
    } finally {
      setDeletingShop(false);
    }
  }

  async function runToggleActive() {
    if (!shop) return;
    setUpdatingActiveState(true);
    setActiveStateError(null);
    try {
      setShop(await updateShop(shopId, { is_active: !shop.is_active }));
      setConfirmToggle(false);
    } catch (err) {
      setConfirmToggle(false);
      setActiveStateError(getErrorMessage(err, 'Could not update this shop.'));
    } finally {
      setUpdatingActiveState(false);
    }
  }

  function openRecordActions(record: ShopDelivery | ShopPayment, type: 'delivery' | 'payment') {
    // Voided records have nothing left to correct — the server blocks edits.
    if (record.voided_at) return;
    if (!can('correct_sales') && !can('delete_sales')) return;
    setActionRecord({ type, id: record.id });
  }

  function buildRecordActions(): SheetAction[] {
    if (!actionRecord) return [];
    const { type } = actionRecord;
    const record: ShopDelivery | ShopPayment | undefined =
      type === 'delivery' ? deliveries.find((d) => d.id === actionRecord.id) : payments.find((p) => p.id === actionRecord.id);
    if (!record) return [];
    const actions: SheetAction[] = [];
    if (can('correct_sales')) {
      actions.push(
        {
          icon: 'create-outline',
          label: 'Edit',
          onPress: () =>
            type === 'delivery' ? setEditDeliveryTarget(record as ShopDelivery) : setEditPaymentTarget(record as ShopPayment),
        },
        {
          icon: 'arrow-undo-outline',
          label: 'Correct entry',
          tone: 'danger',
          onPress: () => setVoidTarget({ type, id: record.id }),
        }
      );
    }
    if (can('delete_sales') && isHardDeleteEligible(record, userId)) {
      actions.push({
        icon: 'trash-outline',
        label: 'Delete entirely',
        tone: 'danger',
        onPress: () => setDeleteTarget({ type, id: record.id }),
      });
    }
    return actions;
  }

  if (!shopId) return null;

  return (
    <>
      <ScreenHeader
        title={shop?.name ?? 'Shop'}
        subtitle={shop?.area?.trim() || undefined}
        back
        primaryActions={[{ icon: 'refresh', label: 'Refresh', onPress: load }]}
        overflowActions={
          shop ? [{ icon: 'create-outline', label: 'Edit shop', onPress: () => router.push(`/shops/${shopId}/edit`) }] : []
        }
      />
      <Page>
        {!shop && !loadError ? (
          <div className="space-y-4">
            <Skeleton height={96} radius={16} />
            <SkeletonRows count={4} />
          </div>
        ) : null}
        {loadError ? <MessageBox tone="danger" message={loadError} /> : null}

        {shop ? (
          <>
            {!shop.is_active ? <p className="text-muted">Inactive</p> : null}

            <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
              <div className="space-y-4">
                {photoUrl ? (
                  <div className="relative h-48 w-full overflow-hidden rounded-lg">
                    <Image src={photoUrl} alt={shop.name} fill sizes="(min-width: 1024px) 480px, 100vw" className="object-cover" />
                  </div>
                ) : null}

                {/* The single most important number on this screen. */}
                <Card className="!bg-primary-soft">
                  <p className="text-[13px] font-bold uppercase tracking-wider text-muted">Balance</p>
                  <p className={`text-4xl font-bold tabular-nums ${balance !== null && balance > 0 ? 'text-danger' : 'text-success'}`}>
                    {formatMoney(balance)}
                  </p>
                  <p className="text-sm font-medium text-muted">
                    {balance === null ? '' : balance > 0 ? 'Outstanding' : 'Settled'}
                  </p>
                </Card>

                {shop.owner_name || shop.phone || shop.area || shop.address || shop.notes ? (
                  <Card className="space-y-1">
                    {shop.owner_name ? <p>{shop.owner_name}</p> : null}
                    {shop.phone ? (
                      <button type="button" onClick={() => callPhone(shop.phone!)} className="block text-primary">
                        {shop.phone}
                      </button>
                    ) : null}
                    {shop.area ? <p className="text-muted">{shop.area}</p> : null}
                    {shop.address ? <p className="text-muted">{shop.address}</p> : null}
                    {shop.notes ? <p className="text-muted">{shop.notes}</p> : null}
                  </Card>
                ) : null}

                {shop.phone ? (
                  <PrimaryButton
                    label={`Call ${shop.owner_name || 'shop'}`}
                    variant="outline"
                    onClick={() => callPhone(shop.phone!)}
                  />
                ) : null}

                <PrimaryButton label="Usual order" variant="outline" onClick={() => router.push(`/shops/${shopId}/usual-order`)} />
              </div>

              <div className="space-y-2">
                <SectionLabel>Recent deliveries</SectionLabel>
                {deliveries.length === 0 ? (
                  <EmptyState icon="cube-outline" title="No deliveries yet" message="Deliveries recorded for this shop will show here." />
                ) : (
                  deliveries.slice(0, visibleDeliveries).map((d) => (
                    <ListRow
                      key={d.id}
                      onClick={d.voided_at ? undefined : () => openRecordActions(d, 'delivery')}
                      title={`${d.quantity} ${d.product_unit ?? ''} ${d.product_name ?? ''}`}
                      subtitle={`${formatDate(d.delivery_date)}${d.is_edited ? ' · Edited' : ''}${d.voided_at ? ' · Voided' : ''}`}
                      trailingText={formatMoney(d.total_amount)}
                      trailingClassName={d.voided_at ? 'text-muted line-through' : 'text-fg'}
                    />
                  ))
                )}
                <ShowMoreControls
                  onShowMore={
                    visibleDeliveries < deliveries.length ? () => setVisibleDeliveries((n) => n + SHOW_MORE_STEP) : undefined
                  }
                  onOpenAll={
                    deliveries.length > INITIAL_VISIBLE ? () => router.push(`/shops/${shopId}/history?type=deliveries`) : undefined
                  }
                  openAllLabel="Open all deliveries"
                />

                <SectionLabel className="pt-2">Recent payments</SectionLabel>
                {payments.length === 0 ? (
                  <EmptyState icon="cash-outline" title="No payments yet" message="Payments recorded for this shop will show here." />
                ) : (
                  payments.slice(0, visiblePayments).map((p) => (
                    <ListRow
                      key={p.id}
                      onClick={p.voided_at ? undefined : () => openRecordActions(p, 'payment')}
                      title={p.method ?? 'Payment'}
                      subtitle={`${formatDate(p.payment_date)}${p.is_edited ? ' · Edited' : ''}${p.voided_at ? ' · Voided' : ''}`}
                      trailingText={formatMoney(p.amount)}
                      trailingClassName={p.voided_at ? 'text-muted line-through' : 'text-fg'}
                    />
                  ))
                )}
                <ShowMoreControls
                  onShowMore={
                    visiblePayments < payments.length ? () => setVisiblePayments((n) => n + SHOW_MORE_STEP) : undefined
                  }
                  onOpenAll={
                    payments.length > INITIAL_VISIBLE ? () => router.push(`/shops/${shopId}/history?type=payments`) : undefined
                  }
                  openAllLabel="Open all payments"
                />
              </div>
            </div>

            {canRemoveShops ? (
              <section className="space-y-1">
                <SectionLabel>Danger zone</SectionLabel>
                <div className="-mx-4 lg:mx-0">
                  <SettingsRow
                    icon={shop.is_active ? 'pause-circle-outline' : 'play-circle-outline'}
                    title={shop.is_active ? 'Deactivate shop' : 'Reactivate shop'}
                    subtitle={
                      shop.is_active ? 'Hide from active lists and rider routes' : 'Show in active lists and rider routes again'
                    }
                    onPress={() => {
                      if (!updatingActiveState) setConfirmToggle(true);
                    }}
                  />
                  <SettingsDivider />
                  <SettingsRow
                    icon="trash-outline"
                    title="Delete shop"
                    subtitle="Permanently delete this shop"
                    tone="danger"
                    onPress={() => {
                      if (!deletingShop) setConfirmShopDelete(true);
                    }}
                  />
                </div>
                {activeStateError ? <MessageBox tone="danger" message={activeStateError} /> : null}
                {deleteShopError ? <MessageBox tone="danger" message={deleteShopError} /> : null}
              </section>
            ) : null}
          </>
        ) : null}
      </Page>

      <ActionSheet
        visible={!!actionRecord}
        onClose={() => setActionRecord(null)}
        title={actionRecord?.type === 'delivery' ? 'Delivery' : 'Payment'}
        actions={buildRecordActions()}
      />

      <PromptModal
        visible={!!voidTarget}
        title={voidTarget?.type === 'delivery' ? 'Correct this delivery?' : 'Correct this payment?'}
        description="This voids the entry — it's removed from the balance immediately but stays visible in history as voided. This cannot be undone."
        placeholder="Reason for voiding"
        submitLabel="Correct entry"
        loading={voidLoading}
        error={voidError}
        onCancel={() => {
          setVoidTarget(null);
          setVoidError(null);
        }}
        onSubmit={handleVoidSubmit}
      />

      <PromptModal
        visible={!!deleteTarget}
        title={deleteTarget?.type === 'delivery' ? 'Delete this delivery?' : 'Delete this payment?'}
        description="This permanently removes the record — only possible within 10 minutes of recording it yourself. The deletion is still recorded in the activity log."
        placeholder="Reason for deleting"
        submitLabel="Delete entirely"
        loading={deleteLoading}
        error={deleteError}
        onCancel={() => {
          setDeleteTarget(null);
          setDeleteError(null);
        }}
        onSubmit={handleDeleteSubmit}
      />

      <EditDeliveryModal
        visible={!!editDeliveryTarget}
        products={products.filter((p) => p.is_active || p.id === editDeliveryTarget?.product_id)}
        initialProductId={editDeliveryTarget?.product_id ?? null}
        initialSellingUnitId={editDeliveryTarget?.selling_unit_id ?? null}
        initialQuantity={editDeliveryTarget?.quantity ?? 0}
        initialDate={editDeliveryTarget?.delivery_date ?? ''}
        canEditDate={can('delete_sales')}
        loading={editLoading}
        error={editError}
        onCancel={() => {
          setEditDeliveryTarget(null);
          setEditError(null);
        }}
        onSubmit={handleEditDeliverySubmit}
      />

      <EditPaymentModal
        visible={!!editPaymentTarget}
        initialAmount={editPaymentTarget?.amount ?? 0}
        initialDate={editPaymentTarget?.payment_date ?? ''}
        canEditDate={can('delete_sales')}
        loading={editLoading}
        error={editError}
        onCancel={() => {
          setEditPaymentTarget(null);
          setEditError(null);
        }}
        onSubmit={handleEditPaymentSubmit}
      />

      <ConfirmDialog
        visible={confirmShopDelete}
        title="Delete this shop?"
        message={`${shop?.name ?? 'This shop'} will be permanently deleted. This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        loading={deletingShop}
        onConfirm={runDeleteShop}
        onCancel={() => setConfirmShopDelete(false)}
      />

      <ConfirmDialog
        visible={confirmToggle}
        title={shop?.is_active ? 'Deactivate this shop?' : 'Reactivate this shop?'}
        message={
          shop?.is_active
            ? `${shop.name} will no longer appear in active lists or rider routes. You can reactivate it anytime — this doesn't delete anything.`
            : `${shop?.name ?? 'This shop'} will appear in active lists and rider routes again.`
        }
        confirmLabel={shop?.is_active ? 'Deactivate' : 'Reactivate'}
        loading={updatingActiveState}
        onConfirm={runToggleActive}
        onCancel={() => setConfirmToggle(false)}
      />
    </>
  );
}
