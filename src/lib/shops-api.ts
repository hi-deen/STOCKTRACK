import { supabase } from '@/lib/supabase';
import type { Shop, ShopDelivery, ShopPayment, ShopProductRow } from '@/types/catalog';

export interface ShopInput {
  name: string;
  owner_name: string | null;
  phone: string | null;
  area: string | null;
  address: string | null;
  notes: string | null;
}

export async function listShops(businessId: string): Promise<Shop[]> {
  const { data, error } = await supabase
    .from('shops')
    .select('*')
    .eq('business_id', businessId)
    .order('name', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getShop(shopId: string): Promise<Shop> {
  const { data, error } = await supabase.from('shops').select('*').eq('id', shopId).single();
  if (error) throw error;
  return data;
}

export async function createShop(businessId: string, input: ShopInput): Promise<Shop> {
  const { data, error } = await supabase
    .from('shops')
    .insert({ ...input, business_id: businessId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateShop(
  shopId: string,
  input: Partial<ShopInput & { is_active: boolean; photo_path: string }>
): Promise<Shop> {
  const { data, error } = await supabase
    .from('shops')
    .update(input)
    .eq('id', shopId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getShopBalance(shopId: string): Promise<number> {
  const { data, error } = await supabase.rpc('get_shop_balance', { shop_id_input: shopId });
  if (error) throw error;
  return (data as number) ?? 0;
}

export async function getShopBalances(businessId: string): Promise<{ shop_id: string; balance: number }[]> {
  const { data, error } = await supabase.rpc('get_shop_balances', { business_id_input: businessId });
  if (error) throw error;
  return data ?? [];
}

export async function listShopDeliveries(
  shopId: string,
  limit = 25,
  offset = 0
): Promise<ShopDelivery[]> {
  const { data, error } = await supabase
    .from('stock_deliveries')
    .select(
      'id, product_id, selling_unit_id, quantity, unit_price, total_amount, delivery_date, voided_at, is_edited, edited_at, created_at, created_by, products(name, unit)'
    )
    .eq('shop_id', shopId)
    .order('delivery_date', { ascending: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  return (data ?? []).map((row) => {
    const product = row.products as unknown as
      | { name: string; unit: string }
      | { name: string; unit: string }[]
      | null;
    const p = Array.isArray(product) ? product[0] : product;
    return {
      id: row.id,
      product_id: row.product_id,
      selling_unit_id: row.selling_unit_id,
      quantity: row.quantity,
      unit_price: row.unit_price,
      total_amount: row.total_amount,
      delivery_date: row.delivery_date,
      voided_at: row.voided_at,
      is_edited: row.is_edited,
      edited_at: row.edited_at,
      created_at: row.created_at,
      created_by: row.created_by,
      product_name: p?.name ?? null,
      product_unit: p?.unit ?? null,
    };
  });
}

export async function listShopPayments(
  shopId: string,
  limit = 25,
  offset = 0
): Promise<ShopPayment[]> {
  const { data, error } = await supabase
    .from('payments')
    .select('id, amount, payment_date, method, voided_at, is_edited, edited_at, created_at, created_by')
    .eq('shop_id', shopId)
    .order('payment_date', { ascending: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  return data ?? [];
}

export async function deleteShop(shopId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_shop', { shop_id_input: shopId });
  if (error) throw error;
}

export async function listShopProducts(shopId: string): Promise<ShopProductRow[]> {
  const { data, error } = await supabase
    .from('shop_products')
    .select('product_id, usual_quantity')
    .eq('shop_id', shopId);
  if (error) throw error;
  return data ?? [];
}

export async function upsertShopProducts(
  shopId: string,
  rows: { product_id: string; usual_quantity: number }[]
): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await supabase
    .from('shop_products')
    .upsert(
      rows.map((r) => ({ shop_id: shopId, product_id: r.product_id, usual_quantity: r.usual_quantity })),
      { onConflict: 'shop_id,product_id' }
    );
  if (error) throw error;
}

export async function deleteShopProducts(shopId: string, productIds: string[]): Promise<void> {
  if (productIds.length === 0) return;
  const { error } = await supabase
    .from('shop_products')
    .delete()
    .eq('shop_id', shopId)
    .in('product_id', productIds);
  if (error) throw error;
}

export async function exportShops(businessId: string): Promise<unknown> {
  const { data, error } = await supabase.rpc('export_shops', { business_id_input: businessId });
  if (error) throw error;
  return data;
}

export async function importShops(
  businessId: string,
  shopsJson: unknown
): Promise<{ imported: number; skipped: number; errors: unknown[] }> {
  const { data, error } = await supabase.rpc('import_shops', {
    business_id_input: businessId,
    shops_json: shopsJson,
  });
  if (error) throw error;
  return data as { imported: number; skipped: number; errors: unknown[] };
}
