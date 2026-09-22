export interface DashboardStats {
  total_outstanding: number;
  total_stock_value_this_month: number;
  total_payments_this_month: number;
  active_shops_count: number;
  shops_with_outstanding_balance_count: number;
  top_5_debtor_shops: { shop_id: string; shop_name: string; balance: number }[];
}

export interface ActivityItem {
  id: string;
  type: 'delivery' | 'payment';
  date: string;
  createdAt: string;
  shop_id: string;
  shop_name: string;
  description: string;
  amount: number;
  voided: boolean;
  edited: boolean;
}
