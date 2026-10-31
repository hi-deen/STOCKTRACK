import { supabase } from '@/lib/supabase';
import type { OperationsShopRow } from '@/types/catalog';

export async function getOperationsView(businessId: string): Promise<OperationsShopRow[]> {
  const { data, error } = await supabase.rpc('get_operations_view', {
    business_id_input: businessId,
  });
  if (error) throw error;
  return data ?? [];
}

export interface RecordDeliveryInput {
  businessId: string;
  shopId: string;
  productId: string;
  // Which of the product's selling units this sale was in — the
  // stock_deliveries BEFORE INSERT trigger (202608300006) converts this to
  // base units itself and applies the stock effect; the client never
  // computes quantity_base. Optional only for backward compatibility with
  // any caller that hasn't been updated yet — the trigger falls back to the
  // product's base unit when omitted.
  sellingUnitId?: string | null;
  quantity: number;
  unitPrice: number;
  notes: string | null;
  createdBy: string | null;
  // YYYY-MM-DD; defaults to today (DB default) when omitted.
  deliveryDate?: string;
}

export async function recordDelivery(input: RecordDeliveryInput): Promise<void> {
  const { error } = await supabase.from('stock_deliveries').insert({
    business_id: input.businessId,
    shop_id: input.shopId,
    product_id: input.productId,
    selling_unit_id: input.sellingUnitId ?? null,
    quantity: input.quantity,
    unit_price: input.unitPrice,
    total_amount: input.quantity * input.unitPrice,
    notes: input.notes,
    created_by: input.createdBy,
    ...(input.deliveryDate ? { delivery_date: input.deliveryDate } : {}),
  });
  if (error) throw error;
}

export interface RecordPaymentInput {
  businessId: string;
  shopId: string;
  amount: number;
  method: string | null;
  notes: string | null;
  createdBy: string | null;
  // YYYY-MM-DD; defaults to today (DB default) when omitted.
  paymentDate?: string;
}

export async function recordPayment(input: RecordPaymentInput): Promise<void> {
  const { error } = await supabase.from('payments').insert({
    business_id: input.businessId,
    shop_id: input.shopId,
    amount: input.amount,
    method: input.method,
    notes: input.notes,
    created_by: input.createdBy,
    ...(input.paymentDate ? { payment_date: input.paymentDate } : {}),
  });
  if (error) throw error;
}

// Same permission level as void (any business member, no time limit, no
// creator check) — enforced server-side; blocked once the record is
// voided. unit_price/total_amount are recomputed server-side from the
// product's current price, never trusted from the client. Signature
// updated for 202608300006's edit_stock_delivery, which now also takes a
// selling_unit_id and reverses/reapplies the delivery's finished-goods
// stock effect.
export async function editDelivery(
  deliveryId: string,
  productId: string,
  sellingUnitId: string,
  quantity: number,
  reason: string,
  // Owner-only: the RPC rejects a date change from non-owners.
  deliveryDate: string | null = null
): Promise<void> {
  const { error } = await supabase.rpc('edit_stock_delivery', {
    delivery_id_input: deliveryId,
    product_id_input: productId,
    selling_unit_id_input: sellingUnitId,
    quantity_input: quantity,
    reason_input: reason,
    delivery_date_input: deliveryDate,
  });
  if (error) throw error;
}

export async function editPayment(
  paymentId: string,
  amount: number,
  reason: string,
  paymentDate: string | null = null
): Promise<void> {
  const { error } = await supabase.rpc('edit_payment', {
    payment_id_input: paymentId,
    amount_input: amount,
    reason_input: reason,
    payment_date_input: paymentDate,
  });
  if (error) throw error;
}

export async function voidDelivery(deliveryId: string, reason: string): Promise<void> {
  const { error } = await supabase.rpc('void_delivery', {
    delivery_id_input: deliveryId,
    reason_input: reason,
  });
  if (error) throw error;
}

export async function voidPayment(paymentId: string, reason: string): Promise<void> {
  const { error } = await supabase.rpc('void_payment', {
    payment_id_input: paymentId,
    reason_input: reason,
  });
  if (error) throw error;
}

// Only ever succeeds for a non-voided record created by the caller within
// the last 10 minutes — enforced server-side; the client-side eligibility
// check exists only to decide whether to show the option at all.
export async function hardDeleteDelivery(deliveryId: string, reason: string): Promise<void> {
  const { error } = await supabase.rpc('hard_delete_stock_delivery', {
    delivery_id_input: deliveryId,
    reason_input: reason,
  });
  if (error) throw error;
}

export async function hardDeletePayment(paymentId: string, reason: string): Promise<void> {
  const { error } = await supabase.rpc('hard_delete_payment', {
    payment_id_input: paymentId,
    reason_input: reason,
  });
  if (error) throw error;
}

const HARD_DELETE_WINDOW_MS = 10 * 60 * 1000;

export function isHardDeleteEligible(
  record: { voided_at: string | null; created_at: string; created_by: string | null },
  currentUserId: string | null
): boolean {
  if (record.voided_at) return false;
  if (!record.created_by || !currentUserId || record.created_by !== currentUserId) return false;
  return Date.now() - new Date(record.created_at).getTime() < HARD_DELETE_WINDOW_MS;
}
