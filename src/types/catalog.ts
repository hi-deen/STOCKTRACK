export interface Shop {
  id: string;
  business_id: string;
  name: string;
  owner_name: string | null;
  phone: string | null;
  area: string | null;
  address: string | null;
  notes: string | null;
  is_active: boolean;
  photo_path: string | null;
  created_at: string;
}

export interface Product {
  id: string;
  business_id: string;
  name: string;
  unit: string;
  unit_price: number;
  is_active: boolean;
  created_at: string;
  // Added by the Stock/Batches build (202608300003/202608300005).
  reorder_level: number | null;
  current_stock: number;
  low_stock_notified_at: string | null;
  low_stock_notified_quantity: number | null;
  is_low_stock: boolean;
}

export interface ShopProductRow {
  product_id: string;
  usual_quantity: number | null;
}

export interface ShopDelivery {
  id: string;
  product_id: string | null;
  selling_unit_id: string | null;
  quantity: number;
  unit_price: number;
  total_amount: number;
  delivery_date: string;
  voided_at: string | null;
  is_edited: boolean;
  edited_at: string | null;
  created_at: string;
  created_by: string | null;
  product_name: string | null;
  product_unit: string | null;
}

export interface ShopPayment {
  id: string;
  amount: number;
  payment_date: string;
  method: string | null;
  voided_at: string | null;
  is_edited: boolean;
  edited_at: string | null;
  created_at: string;
  created_by: string | null;
}

export interface OperationsShopRow {
  shop_id: string;
  shop_name: string;
  area: string | null;
  address: string | null;
  phone: string | null;
  photo_path: string | null;
  balance: number;
  last_restock_date: string | null;
  days_since_restock: number | null;
  restocked_today: boolean;
  today_delivery_summary: string | null;
  payments_today_total: number;
  payment_status_today: 'full' | 'partial' | 'none';
  last_payment_method_today: string | null;
}
