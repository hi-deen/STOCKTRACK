export interface ReportSummary {
  total_stock_value: number;
  total_payments_collected: number;
  delivery_count: number;
  payment_count: number;
  unique_shops_visited: number;
  net_outstanding_change: number;
}

export interface ActivityLogEntry {
  entry_type: 'delivery' | 'payment';
  entry_date: string;
  shop_id: string | null;
  shop_name: string | null;
  shop_area: string | null;
  description: string;
  amount: number;
  product_name: string | null;
  quantity: number | null;
  unit: string | null;
}
