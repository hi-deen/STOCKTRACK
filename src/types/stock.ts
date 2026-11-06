// Types for the Stock/Batches/Finished Goods build (Parts A-I). Mirrors
// src/types/catalog.ts's convention: plain interfaces matching each table's
// columns exactly, nullability included.

export interface ProductUnit {
  id: string;
  business_id: string;
  product_id: string;
  name: string;
  base_unit_quantity: number;
  default_price: number;
  created_at: string;
}

export type StockItemCategory = 'raw_material' | 'packaging';

export interface StockItem {
  id: string;
  business_id: string;
  name: string;
  category: StockItemCategory;
  unit: string;
  reorder_level: number | null;
  current_quantity: number;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  low_stock_notified_at: string | null;
  low_stock_notified_quantity: number | null;
  is_low_stock: boolean;
}

export interface StockPurchase {
  id: string;
  business_id: string;
  stock_item_id: string;
  quantity: number;
  total_cost: number;
  unit_cost: number;
  remaining_quantity: number;
  // Null while bought on credit and not yet paid.
  account_id: string | null;
  on_credit: boolean;
  paid_date: string | null;
  purchase_date: string;
  supplier: string | null;
  created_by: string | null;
  created_at: string;
}

export type StockMovementReason =
  | 'purchase'
  | 'purchase_edit_reversal'
  | 'purchase_delete_reversal'
  | 'batch_production_in'
  | 'batch_production_out'
  | 'batch_edit_reversal'
  | 'batch_delete_reversal'
  | 'distribution_sale'
  | 'distribution_edit_reversal'
  | 'distribution_delete_reversal';

export interface StockMovement {
  id: string;
  business_id: string;
  stock_item_id: string | null;
  product_id: string | null;
  quantity_change: number;
  reason: StockMovementReason;
  reference_table: string | null;
  reference_id: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Batch {
  id: string;
  business_id: string;
  name: string;
  production_date: string;
  product_id: string;
  output_selling_unit_id: string | null;
  output_selling_unit_quantity: number | null;
  output_quantity_base: number;
  total_cost: number;
  cost_per_base_unit: number;
  notes: string | null;
  is_deleted: boolean;
  deleted_at: string | null;
  deleted_by: string | null;
  is_edited: boolean;
  edited_at: string | null;
  edited_by: string | null;
  created_by: string | null;
  created_at: string;
}

export interface BatchMaterial {
  id: string;
  batch_id: string;
  stock_item_id: string;
  quantity_used: number;
  total_cost: number;
  created_at: string;
}

export interface BatchMaterialLotConsumption {
  id: string;
  batch_material_id: string;
  stock_purchase_id: string;
  quantity_consumed: number;
  unit_cost_at_time: number;
  created_at: string;
}

export interface BatchOtherCost {
  id: string;
  batch_id: string;
  description: string;
  amount: number;
  created_at: string;
}

export interface ExpenseCategory {
  id: string;
  business_id: string;
  name: string;
  is_default: boolean;
  created_at: string;
}

export interface Expense {
  id: string;
  business_id: string;
  category_id: string;
  amount: number;
  expense_date: string;
  note: string | null;
  account_id: string | null;
  created_by: string | null;
  created_at: string;
}

export interface FinancialSummary {
  total_purchases: number;
  total_batch_costs: number;
  total_expenses: number;
  total_distribution_revenue: number;
}
