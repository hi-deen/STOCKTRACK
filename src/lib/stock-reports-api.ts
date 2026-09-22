import { supabase } from '@/lib/supabase';
import type { Product } from '@/types/catalog';
import type { FinancialSummary, StockItem } from '@/types/stock';

export async function getFinancialSummary(
  businessId: string,
  startDate: string,
  endDate: string
): Promise<FinancialSummary> {
  const { data, error } = await supabase.rpc('get_financial_summary', {
    business_id_input: businessId,
    start_date_input: startDate,
    end_date_input: endDate,
  });
  if (error) throw error;
  const row = (data as FinancialSummary[] | null)?.[0];
  return (
    row ?? {
      total_purchases: 0,
      total_batch_costs: 0,
      total_expenses: 0,
      total_distribution_revenue: 0,
    }
  );
}

// current_quantity/is_low_stock are always up to date (generated column +
// trigger-maintained total, see 202608300005) — plain queries, no RPC
// needed for either of these.
export async function listLowStockItems(businessId: string): Promise<StockItem[]> {
  const { data, error } = await supabase
    .from('stock_items')
    .select('*')
    .eq('business_id', businessId)
    .eq('is_active', true)
    .eq('is_low_stock', true)
    .order('name', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function listLowStockProducts(businessId: string): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('business_id', businessId)
    .eq('is_active', true)
    .eq('is_low_stock', true)
    .order('name', { ascending: true });
  if (error) throw error;
  return data ?? [];
}
