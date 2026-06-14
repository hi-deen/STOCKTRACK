export type Product = {
  id: string;
  business_id: string;
  name: string;
  unit: string;
  unit_price: number;
  is_active: boolean;
  created_at: string;
};

export type Shop = {
  id: string;
  business_id: string;
  name: string;
  owner_name: string | null;
  phone: string | null;
  area: string | null;
  address: string | null;
  notes: string | null;
  photo_path: string | null;
  is_active: boolean;
  created_at: string;
  created_by: string | null;
};

export type ShopOperationsRow = {
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
  payment_status_today: "none" | "partial" | "full";
  last_payment_method_today: string | null;
};

export type StockDelivery = {
  id: string;
  business_id: string;
  shop_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  delivery_date: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  shop_name?: string;
  product_name?: string;
  product_unit?: string;
};

export type Payment = {
  id: string;
  business_id: string;
  shop_id: string;
  amount: number;
  payment_date: string;
  method: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  shop_name?: string;
};

export type ShopBalance = {
  id: string;
  business_id: string;
  name: string;
  is_active: boolean;
  balance: number;
  total_delivered: number;
  total_paid: number;
  last_delivery_date: string | null;
  last_payment_date: string | null;
};

export type DashboardStats = {
  total_outstanding: number;
  total_stock_value_this_month: number;
  total_payments_this_month: number;
  active_shops_count: number;
  shops_with_outstanding_balance_count: number;
  top_5_debtor_shops: Array<{ shop_id: string; shop_name: string; balance: number }>;
};
