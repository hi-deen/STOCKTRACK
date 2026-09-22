import { supabase } from '@/lib/supabase';
import type { Batch, BatchMaterial, BatchOtherCost } from '@/types/stock';

export interface BatchMaterialInput {
  stock_item_id: string;
  quantity_used: number;
}

export interface BatchOtherCostInput {
  description: string;
  amount: number;
}

export interface BatchInput {
  name: string;
  productionDate: string;
  productId: string;
  outputSellingUnitId: string;
  outputSellingUnitQuantity: number;
  materials: BatchMaterialInput[];
  otherCosts: BatchOtherCostInput[];
}

export async function listBatches(businessId: string, limit = 50): Promise<Batch[]> {
  const { data, error } = await supabase
    .from('batches')
    .select('*')
    .eq('business_id', businessId)
    .eq('is_deleted', false)
    .order('production_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function getBatch(batchId: string): Promise<Batch> {
  const { data, error } = await supabase.from('batches').select('*').eq('id', batchId).single();
  if (error) throw error;
  return data;
}

export async function listBatchMaterials(batchId: string): Promise<BatchMaterial[]> {
  const { data, error } = await supabase
    .from('batch_materials')
    .select('*')
    .eq('batch_id', batchId);
  if (error) throw error;
  return data ?? [];
}

export async function listBatchOtherCosts(batchId: string): Promise<BatchOtherCost[]> {
  const { data, error } = await supabase
    .from('batch_other_costs')
    .select('*')
    .eq('batch_id', batchId);
  if (error) throw error;
  return data ?? [];
}

// Rejects the whole batch (nothing created, nothing charged) if any
// material/packaging line is short on remaining FIFO stock — see
// 202608300004's header comment. Returns the new batch's id.
export async function createBatch(businessId: string, input: BatchInput): Promise<string> {
  const { data, error } = await supabase.rpc('create_batch', {
    business_id_input: businessId,
    name_input: input.name,
    production_date_input: input.productionDate,
    product_id_input: input.productId,
    output_selling_unit_id_input: input.outputSellingUnitId,
    output_selling_unit_quantity_input: input.outputSellingUnitQuantity,
    materials_json: input.materials,
    other_costs_json: input.otherCosts,
  });
  if (error) throw error;
  return data as string;
}

// Open to any business member, matching edit_delivery/edit_payment — see
// 202608300004's header comment.
export async function editBatch(batchId: string, input: BatchInput, reason: string): Promise<void> {
  const { error } = await supabase.rpc('edit_batch', {
    batch_id_input: batchId,
    name_input: input.name,
    production_date_input: input.productionDate,
    product_id_input: input.productId,
    output_selling_unit_id_input: input.outputSellingUnitId,
    output_selling_unit_quantity_input: input.outputSellingUnitQuantity,
    materials_json: input.materials,
    other_costs_json: input.otherCosts,
    reason_input: reason,
  });
  if (error) throw error;
}

// Owner-only (enforced server-side) — soft-delete, matching
// hard_delete_stock_delivery's owner-only rule. See 202608300004.
export async function deleteBatch(batchId: string, reason: string): Promise<void> {
  const { error } = await supabase.rpc('delete_batch', {
    batch_id_input: batchId,
    reason_input: reason,
  });
  if (error) throw error;
}
