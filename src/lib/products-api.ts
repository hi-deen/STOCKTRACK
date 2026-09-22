import { supabase } from '@/lib/supabase';
import type { Product } from '@/types/catalog';

export interface ProductInput {
  name: string;
  unit: string;
  unit_price: number;
  // Low-stock threshold in base units, added by the Stock/Batches build
  // (202608300003) — null means no alert configured.
  reorder_level?: number | null;
}

export async function listProducts(businessId: string): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('business_id', businessId)
    .order('name', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createProduct(businessId: string, input: ProductInput): Promise<Product> {
  const { data, error } = await supabase
    .from('products')
    .insert({ ...input, business_id: businessId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateProduct(
  productId: string,
  input: Partial<ProductInput & { is_active: boolean }>
): Promise<Product> {
  const { data, error } = await supabase
    .from('products')
    .update(input)
    .eq('id', productId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteProduct(productId: string): Promise<void> {
  const { error } = await supabase.from('products').delete().eq('id', productId);
  if (error) throw error;
}
