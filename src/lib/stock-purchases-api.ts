import { supabase } from '@/lib/supabase';
import type { StockPurchase } from '@/types/stock';

export interface RecordPurchaseInput {
  businessId: string;
  stockItemId: string;
  quantity: number;
  totalCost: number;
  purchaseDate: string;
  supplier: string | null;
  createdBy: string | null;
}

export async function recordPurchase(input: RecordPurchaseInput): Promise<void> {
  const { error } = await supabase.from('stock_purchases').insert({
    business_id: input.businessId,
    stock_item_id: input.stockItemId,
    quantity: input.quantity,
    total_cost: input.totalCost,
    purchase_date: input.purchaseDate,
    supplier: input.supplier,
    created_by: input.createdBy,
  });
  if (error) throw error;
}

// "12 of 50 kg left" once batches have drawn on a purchase, else "50 kg".
export function purchaseQuantityLabel(purchase: StockPurchase, unit: string): string {
  const quantity = `${purchase.quantity.toLocaleString()} ${unit}`;
  if (purchase.remaining_quantity >= purchase.quantity) return quantity;
  return `${purchase.remaining_quantity.toLocaleString()} of ${quantity} left`;
}

export interface EditPurchaseInput {
  purchaseId: string;
  stockItemId: string;
  quantity: number;
  totalCost: number;
  purchaseDate: string;
  supplier: string | null;
  reason: string;
}

// Owner-only, enforced by the RPC. It also keeps stock and the FIFO lot in
// step, which is why the table itself grants no update/delete.
export async function editPurchase(input: EditPurchaseInput): Promise<void> {
  const { error } = await supabase.rpc('edit_stock_purchase', {
    purchase_id_input: input.purchaseId,
    stock_item_id_input: input.stockItemId,
    quantity_input: input.quantity,
    total_cost_input: input.totalCost,
    purchase_date_input: input.purchaseDate,
    supplier_input: input.supplier,
    reason_input: input.reason,
  });
  if (error) throw error;
}

export async function deletePurchase(purchaseId: string, reason: string): Promise<void> {
  const { error } = await supabase.rpc('delete_stock_purchase', {
    purchase_id_input: purchaseId,
    reason_input: reason,
  });
  if (error) throw error;
}

export async function getPurchase(purchaseId: string): Promise<StockPurchase> {
  const { data, error } = await supabase.from('stock_purchases').select('*').eq('id', purchaseId).single();
  if (error) throw error;
  return data;
}

export async function listPurchases(businessId: string, limit = 50): Promise<StockPurchase[]> {
  const { data, error } = await supabase
    .from('stock_purchases')
    .select('*')
    .eq('business_id', businessId)
    .order('purchase_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function listPurchasesForItem(stockItemId: string, limit = 50): Promise<StockPurchase[]> {
  const { data, error } = await supabase
    .from('stock_purchases')
    .select('*')
    .eq('stock_item_id', stockItemId)
    .order('purchase_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}
