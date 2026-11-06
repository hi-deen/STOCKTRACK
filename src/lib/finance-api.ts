import { formatMoney } from '@/lib/format';
import { supabase } from '@/lib/supabase';

// Profit, stock at cost and trends (202611080001_profit_tracking.sql).
// Sales are costed from the production run or purchase they were taken
// from, oldest first; a sale with nothing recorded to take from has no cost
// and is left out of profit rather than guessed.

export interface FinancePosition {
  cash_total: number;
  owed_to_business: number;
  owed_to_suppliers: number;
  raw_stock_value: number;
  finished_stock_value: number;
  uncosted_finished_units: number;
  working_capital: number;
}

export interface ProductProfit {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  sales: number;
  costed_sales: number;
  cost: number;
  gross_profit: number;
}

export interface ShopProfit {
  id: string;
  name: string;
  sales: number;
  costed_sales: number;
  gross_profit: number;
  outstanding: number;
}

export interface RunProfit {
  id: string;
  name: string;
  production_date: string;
  product_name: string;
  unit: string;
  made: number;
  used: number;
  sold: number;
  unit_cost: number | null;
  sales: number;
  cost: number;
  gross_profit: number;
}

export interface ProfitAndLoss {
  sales: number;
  discounts: number;
  costed_sales: number;
  uncosted_sales: number;
  cost_of_sales: number;
  delivery_count: number;
  gross_profit: number;
  expenses: number;
  write_offs: number;
  net_profit: number;
  products: ProductProfit[];
  shops: ShopProfit[];
  production_runs: RunProfit[];
}

export interface TrendMonth {
  month_start: string;
  sales: number;
  costed_sales: number;
  cost_of_sales: number;
  expenses: number;
  write_offs: number;
  net_profit: number;
  // Null before the money accounts' starting date.
  cash_at_end: number | null;
  owed_to_business_at_end: number;
  money_in: number;
  money_out: number;
}

export async function getFinancePosition(businessId: string): Promise<FinancePosition> {
  const { data, error } = await supabase.rpc('get_finance_position', { business_id_input: businessId });
  if (error) throw error;
  return data as FinancePosition;
}

export async function getProfitAndLoss(businessId: string, startDate: string, endDate: string): Promise<ProfitAndLoss> {
  const { data, error } = await supabase.rpc('get_profit_and_loss', {
    business_id_input: businessId,
    start_date_input: startDate,
    end_date_input: endDate,
  });
  if (error) throw error;
  return data as ProfitAndLoss;
}

export async function getFinanceTrend(businessId: string, months = 12): Promise<TrendMonth[]> {
  const { data, error } = await supabase.rpc('get_finance_trend', {
    business_id_input: businessId,
    months_input: months,
  });
  if (error) throw error;
  return data ?? [];
}

export function grossMargin(costedSales: number, grossProfit: number): number | null {
  return costedSales > 0 ? (grossProfit / costedSales) * 100 : null;
}

export function formatPercent(value: number | null): string {
  return value === null ? '—' : `${value.toFixed(1)}%`;
}

export interface FinanceAlert {
  tone: 'danger' | 'warning';
  message: string;
}

// Plain-language warnings worked out from the figures on the screen.
export function financeAlerts(position: FinancePosition, pnl: ProfitAndLoss, trend: TrendMonth[]): FinanceAlert[] {
  const alerts: FinanceAlert[] = [];

  if (pnl.uncosted_sales > 0) {
    alerts.push({
      tone: 'warning',
      message: `${formatMoney(pnl.uncosted_sales)} of sales in this period have no production run or purchase recorded to cost them, so they are left out of profit. Record production runs (and purchases of goods you resell) to fix this.`,
    });
  }

  if (pnl.costed_sales > 0 && pnl.net_profit < 0) {
    alerts.push({ tone: 'danger', message: `The business made a loss of ${formatMoney(-pnl.net_profit)} in this period.` });
  }

  for (const product of pnl.products) {
    if (product.costed_sales > 0 && product.gross_profit < 0) {
      alerts.push({ tone: 'danger', message: `${product.name} is selling for less than it costs to make or buy.` });
    }
  }

  const recent = trend.filter((m) => m.costed_sales > 0);
  if (recent.length >= 2) {
    const [previous, latest] = recent.slice(-2);
    const before = grossMargin(previous.costed_sales, previous.costed_sales - previous.cost_of_sales) ?? 0;
    const now = grossMargin(latest.costed_sales, latest.costed_sales - latest.cost_of_sales) ?? 0;
    if (before - now >= 5) {
      alerts.push({
        tone: 'warning',
        message: `Gross margin fell from ${before.toFixed(1)}% to ${now.toFixed(1)}%. Check material prices and selling prices.`,
      });
    }
  }

  if (trend.length >= 4) {
    const now = trend[trend.length - 1].owed_to_business_at_end;
    const then = trend[trend.length - 4].owed_to_business_at_end;
    if (then > 0 && now > then * 1.2) {
      alerts.push({
        tone: 'warning',
        message: `What shops owe you grew ${Math.round(((now - then) / then) * 100)}% in three months, to ${formatMoney(now)}.`,
      });
    }
  }

  const lastThree = trend.slice(-3);
  const monthlyOut = lastThree.length > 0 ? lastThree.reduce((sum, m) => sum + m.money_out, 0) / lastThree.length : 0;
  if (monthlyOut > 0) {
    const weeks = (position.cash_total / monthlyOut) * 4.3;
    if (weeks < 4) {
      alerts.push({
        tone: 'danger',
        message: `Cash on hand covers about ${Math.max(0, Math.floor(weeks))} week${Math.floor(weeks) === 1 ? '' : 's'} of spending at the recent rate.`,
      });
    } else if (weeks < 8) {
      alerts.push({ tone: 'warning', message: `Cash on hand covers about ${Math.floor(weeks)} weeks of spending at the recent rate.` });
    }
  }

  if (position.owed_to_suppliers > position.cash_total && position.owed_to_suppliers > 0) {
    alerts.push({
      tone: 'warning',
      message: `You owe suppliers ${formatMoney(position.owed_to_suppliers)}, more than the cash on hand.`,
    });
  }

  return alerts;
}

// ---- bought-in goods and write-offs ----

export interface ProductPurchase {
  id: string;
  business_id: string;
  product_id: string;
  quantity: number;
  total_cost: number;
  purchase_date: string;
  supplier: string | null;
  account_id: string | null;
  on_credit: boolean;
  paid_date: string | null;
  created_by: string | null;
  created_at: string;
}

export async function listProductPurchases(businessId: string, limit = 200): Promise<ProductPurchase[]> {
  const { data, error } = await supabase
    .from('product_purchases')
    .select('*')
    .eq('business_id', businessId)
    .order('purchase_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export interface ProductPurchaseInput {
  businessId: string;
  productId: string;
  // In the product's base unit.
  quantity: number;
  totalCost: number;
  purchaseDate: string;
  supplier: string | null;
  accountId: string | null;
  onCredit: boolean;
}

export async function recordProductPurchase(input: ProductPurchaseInput): Promise<void> {
  const { error } = await supabase.rpc('record_product_purchase', {
    business_id_input: input.businessId,
    product_id_input: input.productId,
    quantity_input: input.quantity,
    total_cost_input: input.totalCost,
    purchase_date_input: input.purchaseDate,
    supplier_input: input.supplier,
    account_id_input: input.accountId,
    on_credit_input: input.onCredit,
  });
  if (error) throw error;
}

export async function deleteProductPurchase(purchaseId: string, reason: string): Promise<void> {
  const { error } = await supabase.rpc('delete_product_purchase', {
    purchase_id_input: purchaseId,
    reason_input: reason,
  });
  if (error) throw error;
}

export async function payProductPurchase(purchaseId: string, accountId: string, paidDate: string): Promise<void> {
  const { error } = await supabase.rpc('pay_product_purchase', {
    purchase_id_input: purchaseId,
    account_id_input: accountId,
    paid_date_input: paidDate,
  });
  if (error) throw error;
}

export async function writeOffProduct(
  businessId: string,
  productId: string,
  quantity: number,
  reason: string,
  date: string
): Promise<void> {
  const { error } = await supabase.rpc('write_off_product', {
    business_id_input: businessId,
    product_id_input: productId,
    quantity_input: quantity,
    reason_input: reason,
    write_off_date_input: date,
  });
  if (error) throw error;
}
