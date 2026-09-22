import { supabase } from '@/lib/supabase';
import type { ProductUnit } from '@/types/stock';

export interface ProductUnitInput {
  name: string;
  base_unit_quantity: number;
  default_price: number;
}

export async function listProductUnits(productId: string): Promise<ProductUnit[]> {
  const { data, error } = await supabase
    .from('product_units')
    .select('*')
    .eq('product_id', productId)
    .order('base_unit_quantity', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createProductUnit(
  businessId: string,
  productId: string,
  input: ProductUnitInput
): Promise<ProductUnit> {
  const { data, error } = await supabase
    .from('product_units')
    .insert({ ...input, business_id: businessId, product_id: productId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateProductUnit(
  unitId: string,
  input: Partial<ProductUnitInput>
): Promise<ProductUnit> {
  const { data, error } = await supabase
    .from('product_units')
    .update(input)
    .eq('id', unitId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// The base ("= 1 base unit") selling unit is auto-created per product and
// deliberately not deletable from here — the caller (the product edit
// screen) hides the delete action for it, matching the migration's "every
// product must always have at least one selling unit equal to 1 base unit"
// rule. This function itself does not special-case it since the DB has no
// constraint preventing the delete; the UI is the only guard.
export async function deleteProductUnit(unitId: string): Promise<void> {
  const { error } = await supabase.from('product_units').delete().eq('id', unitId);
  if (error) throw error;
}
