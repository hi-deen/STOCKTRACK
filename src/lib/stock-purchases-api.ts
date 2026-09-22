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

// Insert-only, on purpose — see 202608300003's header comment. There is no
// editPurchase/deletePurchase here because the DB grants no update/delete.
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
