import { supabase } from '@/lib/supabase';
import type { StockItem, StockItemCategory } from '@/types/stock';

export interface StockItemInput {
  name: string;
  category: StockItemCategory;
  unit: string;
  reorder_level: number | null;
}

export async function listStockItems(businessId: string): Promise<StockItem[]> {
  const { data, error } = await supabase
    .from('stock_items')
    .select('*')
    .eq('business_id', businessId)
    .order('name', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getStockItem(stockItemId: string): Promise<StockItem> {
  const { data, error } = await supabase.from('stock_items').select('*').eq('id', stockItemId).single();
  if (error) throw error;
  return data;
}

export async function createStockItem(businessId: string, input: StockItemInput): Promise<StockItem> {
  const { data, error } = await supabase
    .from('stock_items')
    .insert({ ...input, business_id: businessId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateStockItem(
  stockItemId: string,
  input: Partial<StockItemInput & { is_active: boolean }>
): Promise<StockItem> {
  const { data, error } = await supabase
    .from('stock_items')
    .update(input)
    .eq('id', stockItemId)
    .select()
    .single();
  if (error) throw error;
  return data;
}
