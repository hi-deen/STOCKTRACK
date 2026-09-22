'use client';

import { useEffect, type Dispatch, type SetStateAction } from 'react';

import { PressableCard } from '@/components/card';
import { Field, FormInput } from '@/components/form-input';
import { SectionLabel } from '@/components/page';
import type { BatchInput } from '@/lib/batches-api';
import { toDateString } from '@/lib/format';
import { listProductUnits } from '@/lib/product-units-api';
import type { Product } from '@/types/catalog';
import type { ProductUnit, StockItem } from '@/types/stock';

export interface MaterialRow {
  key: string;
  stockItemId: string | null;
  quantity: string;
}

export interface OtherCostRow {
  key: string;
  description: string;
  amount: string;
}

export interface BatchFormState {
  name: string;
  productionDate: string;
  productId: string | null;
  outputUnitId: string | null;
  outputUnits: ProductUnit[];
  outputQuantity: string;
  materials: MaterialRow[];
  otherCosts: OtherCostRow[];
}

let rowKeySeq = 0;
export function nextRowKey(): string {
  rowKeySeq += 1;
  return String(rowKeySeq);
}

export function emptyBatchForm(): BatchFormState {
  return {
    name: '',
    productionDate: toDateString(new Date()),
    productId: null,
    outputUnitId: null,
    outputUnits: [],
    outputQuantity: '',
    materials: [{ key: nextRowKey(), stockItemId: null, quantity: '' }],
    otherCosts: [],
  };
}

function validMaterials(state: BatchFormState) {
  return state.materials.filter((r) => r.stockItemId && Number.isFinite(Number(r.quantity)) && Number(r.quantity) > 0);
}

export function isBatchFormValid(state: BatchFormState): boolean {
  const out = Number(state.outputQuantity);
  return (
    state.name.trim().length > 0 &&
    !!state.productId &&
    !!state.outputUnitId &&
    /^\d{4}-\d{2}-\d{2}$/.test(state.productionDate) &&
    Number.isFinite(out) &&
    out > 0 &&
    validMaterials(state).length > 0
  );
}

export function toBatchInput(state: BatchFormState): BatchInput {
  return {
    name: state.name.trim(),
    productionDate: state.productionDate,
    productId: state.productId as string,
    outputSellingUnitId: state.outputUnitId as string,
    outputSellingUnitQuantity: Number(state.outputQuantity),
    materials: validMaterials(state).map((r) => ({
      stock_item_id: r.stockItemId as string,
      quantity_used: Number(r.quantity),
    })),
    otherCosts: state.otherCosts
      .filter((r) => r.description.trim() && Number.isFinite(Number(r.amount)) && Number(r.amount) >= 0)
      .map((r) => ({ description: r.description.trim(), amount: Number(r.amount) })),
  };
}

interface BatchFormFieldsProps {
  state: BatchFormState;
  setState: Dispatch<SetStateAction<BatchFormState>>;
  products: Product[];
  stockItems: StockItem[];
  // When editing, prefer the batch's existing output unit if it still belongs
  // to the selected product.
  preferredUnitId?: string | null;
}

const money = /[^0-9.]/g;

export function BatchFormFields({ state, setState, products, stockItems, preferredUnitId }: BatchFormFieldsProps) {
  const { productId } = state;

  // Reload the output units when the product changes; keep the current pick
  // if it still belongs to the product, else prefer the batch's original
  // unit, else the base unit (base_unit_quantity === 1).
  useEffect(() => {
    if (!productId) {
      setState((s) => (s.outputUnits.length || s.outputUnitId ? { ...s, outputUnits: [], outputUnitId: null } : s));
      return;
    }
    let cancelled = false;
    listProductUnits(productId).then((data) => {
      if (cancelled) return;
      setState((s) => {
        const keep = data.some((u) => u.id === s.outputUnitId)
          ? s.outputUnitId
          : preferredUnitId && data.some((u) => u.id === preferredUnitId)
            ? preferredUnitId
            : (data.find((u) => u.base_unit_quantity === 1)?.id ?? data[0]?.id ?? null);
        return { ...s, outputUnits: data, outputUnitId: keep };
      });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run when the product changes
  }, [productId]);

  const patch = (p: Partial<BatchFormState>) => setState((s) => ({ ...s, ...p }));
  const updateMaterial = (key: string, p: Partial<MaterialRow>) =>
    setState((s) => ({ ...s, materials: s.materials.map((r) => (r.key === key ? { ...r, ...p } : r)) }));
  const updateCost = (key: string, p: Partial<OtherCostRow>) =>
    setState((s) => ({ ...s, otherCosts: s.otherCosts.map((r) => (r.key === key ? { ...r, ...p } : r)) }));

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Batch name">
          <FormInput value={state.name} onChange={(e) => patch({ name: e.target.value })} placeholder="e.g. Batch 1 - bread" />
        </Field>
        <Field label="Production date">
          <FormInput
            type="date"
            value={state.productionDate}
            max={toDateString(new Date())}
            onChange={(e) => patch({ productionDate: e.target.value })}
          />
        </Field>
      </div>

      <SectionLabel>Output product</SectionLabel>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((p) => (
          <PressableCard key={p.id} selected={p.id === productId} onClick={() => patch({ productId: p.id })}>
            <span className="text-sm font-bold">{p.name}</span>
          </PressableCard>
        ))}
      </div>

      {state.outputUnits.length > 0 ? (
        <>
          <SectionLabel>Output unit</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {state.outputUnits.map((unit) => (
              <PressableCard
                key={unit.id}
                selected={unit.id === state.outputUnitId}
                onClick={() => patch({ outputUnitId: unit.id })}
                className="!w-auto">
                <span className="text-sm font-bold">{unit.name}</span>
              </PressableCard>
            ))}
          </div>
        </>
      ) : null}

      <Field label="Output quantity (in the unit above)">
        <FormInput
          value={state.outputQuantity}
          onChange={(e) => patch({ outputQuantity: e.target.value.replace(money, '') })}
          placeholder="e.g. 20"
          inputMode="decimal"
        />
      </Field>

      <SectionLabel>Materials &amp; packaging used</SectionLabel>
      {state.materials.map((row) => {
        const selectedItem = stockItems.find((i) => i.id === row.stockItemId) ?? null;
        const quantityNumber = Number(row.quantity);
        const short = !!selectedItem && Number.isFinite(quantityNumber) && quantityNumber > selectedItem.current_quantity;
        return (
          <div key={row.key} className="space-y-3 rounded-lg border border-line p-3">
            <div className="flex flex-wrap gap-2">
              {stockItems.map((item) => (
                <PressableCard
                  key={item.id}
                  selected={item.id === row.stockItemId}
                  onClick={() => updateMaterial(row.key, { stockItemId: item.id })}
                  className="!w-auto">
                  <span className="block text-sm font-bold">{item.name}</span>
                  <span className="block text-sm font-medium text-muted">
                    {item.current_quantity.toLocaleString()} {item.unit} available
                  </span>
                </PressableCard>
              ))}
            </div>
            <FormInput
              value={row.quantity}
              onChange={(e) => updateMaterial(row.key, { quantity: e.target.value.replace(money, '') })}
              placeholder="Quantity used"
              inputMode="decimal"
              error={short ? `Only ${selectedItem?.current_quantity.toLocaleString()} available` : null}
            />
            {state.materials.length > 1 ? (
              <button
                type="button"
                className="text-sm font-medium text-danger"
                onClick={() => setState((s) => ({ ...s, materials: s.materials.filter((r) => r.key !== row.key) }))}>
                Remove
              </button>
            ) : null}
          </div>
        );
      })}
      <button
        type="button"
        className="text-sm font-medium text-primary"
        onClick={() =>
          setState((s) => ({ ...s, materials: [...s.materials, { key: nextRowKey(), stockItemId: null, quantity: '' }] }))
        }>
        + Add material
      </button>

      <SectionLabel>Other costs (labor, gas, etc.)</SectionLabel>
      {state.otherCosts.map((row) => (
        <div key={row.key} className="space-y-3 rounded-lg border border-line p-3">
          <FormInput
            value={row.description}
            onChange={(e) => updateCost(row.key, { description: e.target.value })}
            placeholder="Description"
          />
          <FormInput
            value={row.amount}
            onChange={(e) => updateCost(row.key, { amount: e.target.value.replace(money, '') })}
            placeholder="Amount"
            inputMode="decimal"
          />
          <button
            type="button"
            className="text-sm font-medium text-danger"
            onClick={() => setState((s) => ({ ...s, otherCosts: s.otherCosts.filter((r) => r.key !== row.key) }))}>
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        className="text-sm font-medium text-primary"
        onClick={() =>
          setState((s) => ({ ...s, otherCosts: [...s.otherCosts, { key: nextRowKey(), description: '', amount: '' }] }))
        }>
        + Add other cost
      </button>
    </>
  );
}
