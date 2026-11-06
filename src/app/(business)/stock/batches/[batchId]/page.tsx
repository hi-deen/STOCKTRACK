'use client';

import { useParams, useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';

import {
  BatchFormFields,
  emptyBatchForm,
  isBatchFormValid,
  nextRowKey,
  toBatchInput,
  type BatchFormState,
} from '@/components/batch-form';
import { ListRow } from '@/components/list-row';
import { MessageBox } from '@/components/message-box';
import { Page, SectionLabel } from '@/components/page';
import { PrimaryButton } from '@/components/primary-button';
import { PromptModal } from '@/components/prompt-modal';
import { type HeaderAction, ScreenHeader } from '@/components/screen-header';
import { Skeleton } from '@/components/skeleton';
import { useToast } from '@/components/toast';
import { useFocusEffect } from '@/hooks/use-focus-effect';
import { deleteBatch, editBatch, getBatch, listBatchMaterials, listBatchOtherCosts } from '@/lib/batches-api';
import { useBusinessAuth } from '@/lib/business-auth-context';
import { getErrorMessage } from '@/lib/error-message';
import { formatDate, formatMoney } from '@/lib/format';
import { listProducts } from '@/lib/products-api';
import { listStockItems } from '@/lib/stock-items-api';
import type { Product } from '@/types/catalog';
import type { Batch, BatchMaterial, BatchOtherCost, StockItem } from '@/types/stock';

export default function BatchDetailPage() {
  const router = useRouter();
  const toast = useToast();
  const { activeBusinessId, can } = useBusinessAuth();
  const { batchId } = useParams<{ batchId: string }>();
  const canEditStockRecords = can('manage_stock_records');

  const [batch, setBatch] = useState<Batch | null>(null);
  const [materials, setMaterials] = useState<BatchMaterial[]>([]);
  const [otherCosts, setOtherCosts] = useState<BatchOtherCost[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<BatchFormState>(emptyBatchForm);

  const [editReasonOpen, setEditReasonOpen] = useState(false);
  const [deleteReasonOpen, setDeleteReasonOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeBusinessId || !batchId || editing) return;
    try {
      const [batchData, materialsData, otherCostsData, productsData, itemsData] = await Promise.all([
        getBatch(batchId),
        listBatchMaterials(batchId),
        listBatchOtherCosts(batchId),
        listProducts(activeBusinessId),
        listStockItems(activeBusinessId),
      ]);
      setBatch(batchData);
      setMaterials(materialsData);
      setOtherCosts(otherCostsData);
      setProducts(productsData);
      setStockItems(itemsData);
      setLoadError(null);
    } catch (err) {
      setLoadError(getErrorMessage(err, 'Could not load this production run.'));
    }
  }, [activeBusinessId, batchId, editing]);

  useFocusEffect(load);

  function startEditing() {
    if (!batch) return;
    setForm({
      name: batch.name,
      productionDate: batch.production_date.slice(0, 10),
      productId: batch.product_id,
      outputUnitId: batch.output_selling_unit_id,
      outputUnits: [],
      outputQuantity: String(batch.output_selling_unit_quantity ?? ''),
      materials: materials.map((m) => ({ key: nextRowKey(), stockItemId: m.stock_item_id, quantity: String(m.quantity_used) })),
      otherCosts: otherCosts.map((c) => ({ key: nextRowKey(), description: c.description, amount: String(c.amount) })),
    });
    setEditing(true);
  }

  async function handleEditSubmit(reason: string) {
    if (!isBatchFormValid(form) || !batchId) return;
    setActionLoading(true);
    setActionError(null);
    try {
      await editBatch(batchId, toBatchInput(form), reason);
      setEditReasonOpen(false);
      setEditing(false);
      toast.show('Saved');
    } catch (err) {
      setActionError(getErrorMessage(err, 'Could not save these changes.'));
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDeleteSubmit(reason: string) {
    if (!batchId) return;
    setActionLoading(true);
    setActionError(null);
    try {
      await deleteBatch(batchId, reason);
      setDeleteReasonOpen(false);
      toast.show('Production run deleted');
      router.back();
    } catch (err) {
      setActionError(getErrorMessage(err, 'Could not delete this production run.'));
    } finally {
      setActionLoading(false);
    }
  }

  const overflowActions: HeaderAction[] =
    batch && !editing
      ? [
          ...(canEditStockRecords ? [{ icon: 'create-outline' as const, label: 'Edit production run', onPress: startEditing }] : []),
          ...(canEditStockRecords
            ? [{ icon: 'trash-outline' as const, label: 'Delete production run', onPress: () => setDeleteReasonOpen(true) }]
            : []),
        ]
      : [];

  const product = batch ? products.find((p) => p.id === batch.product_id) : null;

  return (
    <>
      <ScreenHeader title={editing ? 'Edit production run' : (batch?.name ?? 'Production run')} back overflowActions={overflowActions} />
      <Page narrow>
        {!batch && !loadError ? <Skeleton height={96} radius={16} /> : null}
        {loadError ? <MessageBox tone="danger" message={loadError} /> : null}

        {batch && !editing ? (
          <>
            <p className="text-muted">
              {product?.name ?? 'Unknown product'} · {formatDate(batch.production_date)}
              {batch.is_edited ? ' · Edited' : ''}
            </p>

            <div className="grid grid-cols-3 gap-4 rounded-lg border border-line bg-surface p-4">
              <div>
                <p className="text-sm font-medium text-muted">Output</p>
                <p className="text-sm font-bold tabular-nums">
                  {batch.output_quantity_base.toLocaleString()} {product?.unit ?? ''}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted">Total cost</p>
                <p className="text-sm font-bold tabular-nums">{formatMoney(batch.total_cost)}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted">Cost per {product?.unit ?? 'unit'}</p>
                <p className="text-sm font-bold tabular-nums">{formatMoney(batch.cost_per_base_unit)}</p>
              </div>
            </div>

            <SectionLabel>Materials &amp; packaging used</SectionLabel>
            <div>
              {materials.map((m) => {
                const item = stockItems.find((i) => i.id === m.stock_item_id);
                return (
                  <ListRow
                    key={m.id}
                    title={item?.name ?? 'Unknown item'}
                    subtitle={`${m.quantity_used.toLocaleString()} ${item?.unit ?? ''}`}
                    trailingText={formatMoney(m.total_cost)}
                  />
                );
              })}
            </div>

            {otherCosts.length > 0 ? (
              <>
                <SectionLabel>Other costs</SectionLabel>
                <div>
                  {otherCosts.map((c) => (
                    <ListRow key={c.id} title={c.description} trailingText={formatMoney(c.amount)} />
                  ))}
                </div>
              </>
            ) : null}

            {actionError ? <MessageBox tone="danger" message={actionError} /> : null}
          </>
        ) : null}

        {batch && editing ? (
          <>
            <BatchFormFields
              state={form}
              setState={setForm}
              products={products}
              stockItems={stockItems}
              preferredUnitId={batch.output_selling_unit_id}
            />
            {actionError && !editReasonOpen ? <MessageBox tone="danger" message={actionError} /> : null}
            <PrimaryButton label="Save changes" onClick={() => setEditReasonOpen(true)} disabled={!isBatchFormValid(form)} />
            <PrimaryButton label="Cancel" variant="outline" onClick={() => setEditing(false)} />
          </>
        ) : null}
      </Page>

      <PromptModal
        visible={editReasonOpen}
        title="Reason for edit"
        description="What changed and why — kept in the audit log."
        submitLabel="Save changes"
        loading={actionLoading}
        error={actionError}
        onCancel={() => setEditReasonOpen(false)}
        onSubmit={handleEditSubmit}
      />

      <PromptModal
        visible={deleteReasonOpen}
        title="Delete production run?"
        description="This puts the materials/packaging and output stock back to how they were before this production run. Its history stays visible, just marked deleted."
        submitLabel="Delete production run"
        loading={actionLoading}
        error={actionError}
        onCancel={() => setDeleteReasonOpen(false)}
        onSubmit={handleDeleteSubmit}
      />
    </>
  );
}
