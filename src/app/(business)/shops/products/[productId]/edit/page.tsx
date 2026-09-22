'use client';

import { useParams, useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';

import { ConfirmDialog } from '@/components/confirm-dialog';
import { Field, FormInput } from '@/components/form-input';
import { ListRow } from '@/components/list-row';
import { MessageBox } from '@/components/message-box';
import { Page, SectionLabel } from '@/components/page';
import { PrimaryButton } from '@/components/primary-button';
import { ProductUnitModal } from '@/components/product-unit-modal';
import { ScreenHeader } from '@/components/screen-header';
import { SettingsRow } from '@/components/settings-row';
import { SkeletonRows } from '@/components/skeleton';
import { SwitchRow } from '@/components/switch-row';
import { useToast } from '@/components/toast';
import { useFocusEffect } from '@/hooks/use-focus-effect';
import { useBusinessAuth } from '@/lib/business-auth-context';
import { getErrorMessage } from '@/lib/error-message';
import { formatMoney } from '@/lib/format';
import { createProductUnit, deleteProductUnit, listProductUnits, updateProductUnit } from '@/lib/product-units-api';
import { deleteProduct, listProducts, updateProduct } from '@/lib/products-api';
import type { Product } from '@/types/catalog';
import type { ProductUnit } from '@/types/stock';

export default function EditProductPage() {
  const router = useRouter();
  const toast = useToast();
  const { activeBusinessId, activeMembership } = useBusinessAuth();
  const { productId } = useParams<{ productId: string }>();
  const isOwner = activeMembership?.role === 'owner';

  const [product, setProduct] = useState<Product | null>(null);
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [reorderLevel, setReorderLevel] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [dirty, setDirty] = useState(false);

  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [units, setUnits] = useState<ProductUnit[] | null>(null);
  const [unitsError, setUnitsError] = useState<string | null>(null);
  const [unitModalTarget, setUnitModalTarget] = useState<ProductUnit | 'new' | null>(null);
  const [unitModalLoading, setUnitModalLoading] = useState(false);
  const [unitModalError, setUnitModalError] = useState<string | null>(null);
  const [unitToDelete, setUnitToDelete] = useState<ProductUnit | null>(null);

  const load = useCallback(async () => {
    if (!activeBusinessId || !productId || dirty) return;
    try {
      const all = await listProducts(activeBusinessId);
      const found = all.find((p) => p.id === productId);
      if (!found) {
        setLoadError('Product not found.');
        return;
      }
      setProduct(found);
      setName(found.name);
      setUnit(found.unit);
      setUnitPrice(String(found.unit_price));
      setReorderLevel(found.reorder_level === null ? '' : String(found.reorder_level));
      setIsActive(found.is_active);
      setLoadError(null);
    } catch (err) {
      setLoadError(getErrorMessage(err, 'Could not load this product.'));
    }
  }, [activeBusinessId, productId, dirty]);

  const loadUnits = useCallback(async () => {
    if (!productId) return;
    try {
      setUnits(await listProductUnits(productId));
      setUnitsError(null);
    } catch (err) {
      setUnitsError(getErrorMessage(err, 'Could not load selling units.'));
    }
  }, [productId]);

  const refresh = useCallback(() => {
    void load();
    void loadUnits();
  }, [load, loadUnits]);

  useFocusEffect(refresh);

  async function handleUnitModalSubmit(input: { name: string; base_unit_quantity: number; default_price: number }) {
    if (!activeBusinessId || !productId || !unitModalTarget) return;
    setUnitModalLoading(true);
    setUnitModalError(null);
    try {
      if (unitModalTarget === 'new') await createProductUnit(activeBusinessId, productId, input);
      else await updateProductUnit(unitModalTarget.id, input);
      setUnitModalTarget(null);
      await loadUnits();
    } catch (err) {
      setUnitModalError(getErrorMessage(err, 'Could not save this selling unit.'));
    } finally {
      setUnitModalLoading(false);
    }
  }

  async function runDeleteUnit() {
    if (!unitToDelete) return;
    try {
      await deleteProductUnit(unitToDelete.id);
      await loadUnits();
    } catch (err) {
      setUnitsError(getErrorMessage(err, 'Could not delete this selling unit.'));
    } finally {
      setUnitToDelete(null);
    }
  }

  const priceNumber = Number(unitPrice);
  const reorderNumber = reorderLevel.trim() ? Number(reorderLevel) : null;
  const canSubmit =
    name.trim().length > 0 &&
    unit.trim().length > 0 &&
    Number.isFinite(priceNumber) &&
    priceNumber >= 0 &&
    (reorderNumber === null || Number.isFinite(reorderNumber)) &&
    !!productId;

  async function handleSubmit() {
    if (!canSubmit || isSubmitting || !productId) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await updateProduct(productId, {
        name: name.trim(),
        unit: unit.trim(),
        unit_price: priceNumber,
        reorder_level: reorderNumber,
        is_active: isActive,
      });
      toast.show('Saved');
      router.back();
    } catch (err) {
      setError(getErrorMessage(err, 'Could not save this product.'));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function runDeleteProduct() {
    if (!productId) return;
    setIsDeleting(true);
    setError(null);
    try {
      await deleteProduct(productId);
      router.back();
    } catch (err) {
      setConfirmDelete(false);
      setError(getErrorMessage(err, 'Could not delete this product.'));
    } finally {
      setIsDeleting(false);
    }
  }

  const touch = <T,>(set: (v: T) => void) => (v: T) => {
    setDirty(true);
    set(v);
  };

  return (
    <>
      <ScreenHeader back title="Edit product" />
      <Page narrow>
        {!product && !loadError ? <SkeletonRows count={5} avatar={false} /> : null}
        {loadError ? <MessageBox tone="danger" message={loadError} /> : null}

        {product ? (
          <>
            <p className="text-muted">
              Current stock: {product.current_stock.toLocaleString()} {product.unit}
            </p>

            <Field label="Name">
              <FormInput value={name} onChange={(e) => touch(setName)(e.target.value)} />
            </Field>
            <Field label="Unit">
              <FormInput value={unit} onChange={(e) => touch(setUnit)(e.target.value)} />
            </Field>
            <Field label="Unit price">
              <FormInput
                value={unitPrice}
                onChange={(e) => touch(setUnitPrice)(e.target.value.replace(/[^0-9.]/g, ''))}
                inputMode="decimal"
              />
            </Field>
            <Field label="Reorder level (optional)">
              <FormInput
                value={reorderLevel}
                onChange={(e) => touch(setReorderLevel)(e.target.value.replace(/[^0-9.]/g, ''))}
                placeholder="Alert when stock drops to this or below"
                inputMode="decimal"
              />
            </Field>
            <SwitchRow label="Active" value={isActive} onChange={touch(setIsActive)} />

            {error ? <MessageBox tone="danger" message={error} /> : null}

            <PrimaryButton label="Save changes" onClick={handleSubmit} disabled={!canSubmit} loading={isSubmitting} />
            <div className="-mx-4">
              <SettingsRow
                icon="trash-outline"
                title="Delete product"
                subtitle="Remove from your catalog"
                tone="danger"
                onPress={() => {
                  if (!isDeleting) setConfirmDelete(true);
                }}
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <SectionLabel>Selling units</SectionLabel>
              {isOwner ? (
                <button type="button" className="text-sm font-medium text-primary" onClick={() => setUnitModalTarget('new')}>
                  + Add
                </button>
              ) : null}
            </div>
            <p className="text-sm font-medium text-muted">
              Other ways this product can be sold (e.g. a bag of 70 pieces), each with its own price. Every product always
              has a base unit worth 1 — it can&apos;t be deleted.
            </p>

            {unitsError ? <MessageBox tone="danger" message={unitsError} /> : null}
            {units === null && !unitsError ? <SkeletonRows count={2} avatar={false} /> : null}

            {(units ?? []).map((u) => (
              <ListRow
                key={u.id}
                onClick={isOwner ? () => setUnitModalTarget(u) : undefined}
                title={u.name}
                subtitle={`= ${u.base_unit_quantity} ${unit} · ${formatMoney(u.default_price)}`}
                trailing={
                  isOwner && u.base_unit_quantity !== 1 ? (
                    <span
                      role="button"
                      tabIndex={0}
                      className="text-sm font-medium text-danger"
                      onClick={(e) => {
                        e.stopPropagation();
                        setUnitToDelete(u);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.stopPropagation();
                          setUnitToDelete(u);
                        }
                      }}>
                      Delete
                    </span>
                  ) : undefined
                }
              />
            ))}
          </>
        ) : null}
      </Page>

      <ProductUnitModal
        visible={!!unitModalTarget}
        editingUnit={unitModalTarget === 'new' || !unitModalTarget ? null : unitModalTarget}
        loading={unitModalLoading}
        error={unitModalError}
        onCancel={() => {
          setUnitModalTarget(null);
          setUnitModalError(null);
        }}
        onSubmit={handleUnitModalSubmit}
      />

      <ConfirmDialog
        visible={confirmDelete}
        title="Delete product?"
        message="This removes it from your catalog and from any shop usual-order settings. Past deliveries are not affected."
        confirmLabel="Delete"
        destructive
        loading={isDeleting}
        onConfirm={runDeleteProduct}
        onCancel={() => setConfirmDelete(false)}
      />

      <ConfirmDialog
        visible={!!unitToDelete}
        title="Delete selling unit?"
        message={`"${unitToDelete?.name ?? ''}" will no longer be selectable.`}
        confirmLabel="Delete"
        destructive
        onConfirm={runDeleteUnit}
        onCancel={() => setUnitToDelete(null)}
      />
    </>
  );
}
