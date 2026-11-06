import { supabase } from '@/lib/supabase';

// Cash and Bank accounts, and every money movement in or out of them. See
// 202611070001_money_ledger.sql: balances are computed from payments,
// purchases, expenses and money_movements, never stored.

export type MoneyAccountKind = 'cash' | 'bank';

export interface MoneyAccount {
  id: string;
  business_id: string;
  name: string;
  kind: MoneyAccountKind;
  opening_balance: number;
  opening_date: string;
  is_active: boolean;
  created_at: string;
}

export interface MoneyPosition {
  accounts: {
    id: string;
    name: string;
    kind: MoneyAccountKind;
    opening_balance: number;
    opening_date: string;
    balance: number;
  }[];
  cash_total: number;
  owed_to_business: number;
  owed_to_suppliers: number;
  unpaid_purchase_count: number;
}

export interface MoneySummary {
  shop_payments: number;
  capital_in: number;
  loans_in: number;
  other_income: number;
  purchases: number;
  expenses: number;
  withdrawals: number;
  loan_repayments: number;
  adjustments: number;
  money_in: number;
  money_out: number;
  net_change: number;
}

export type MovementKind =
  | 'capital_in'
  | 'withdrawal'
  | 'loan_in'
  | 'loan_repayment'
  | 'other_income'
  | 'other_expense'
  | 'transfer'
  | 'adjustment';

export interface LedgerEntry {
  entry_date: string;
  account_id: string;
  account_name: string;
  // Signed: + money in, - money out.
  amount: number;
  kind: MovementKind | 'payment' | 'purchase' | 'expense' | 'transfer_in';
  description: string;
  reference_id: string;
}

export const MOVEMENT_KINDS: { value: MovementKind; label: string; hint: string }[] = [
  { value: 'capital_in', label: 'Owner capital in', hint: 'Money the owner puts into the business.' },
  { value: 'withdrawal', label: 'Owner withdrawal', hint: 'Money the owner takes out for personal use.' },
  { value: 'loan_in', label: 'Loan received', hint: 'Money borrowed by the business.' },
  { value: 'loan_repayment', label: 'Loan repayment', hint: 'Paying back money the business borrowed.' },
  { value: 'other_income', label: 'Other income', hint: 'Money in that is not a shop payment.' },
  { value: 'other_expense', label: 'Other spending', hint: 'Money out that is not a purchase or a recorded expense.' },
  { value: 'transfer', label: 'Transfer', hint: 'Moving money between Cash and Bank. The total stays the same.' },
  { value: 'adjustment', label: 'Cash count', hint: 'Enter what is actually in the account; the difference is recorded.' },
];

const ENTRY_LABELS: Record<LedgerEntry['kind'], string> = {
  payment: 'Shop payment',
  purchase: 'Purchase',
  expense: 'Expense',
  capital_in: 'Owner capital in',
  withdrawal: 'Owner withdrawal',
  loan_in: 'Loan received',
  loan_repayment: 'Loan repayment',
  other_income: 'Other income',
  other_expense: 'Other spending',
  transfer: 'Transfer out',
  transfer_in: 'Transfer in',
  adjustment: 'Cash count',
};

export function entryLabel(kind: LedgerEntry['kind']): string {
  return ENTRY_LABELS[kind] ?? kind;
}

// Entries recorded on the Money screen itself (the rest come from payments,
// purchases and expenses and are changed there).
export function isMoneyMovement(kind: LedgerEntry['kind']): boolean {
  return kind !== 'payment' && kind !== 'purchase' && kind !== 'expense';
}

export const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'transfer', label: 'Transfer' },
  { value: 'pos', label: 'POS' },
  { value: 'other', label: 'Other' },
];

export function todayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function listMoneyAccounts(businessId: string): Promise<MoneyAccount[]> {
  const { data, error } = await supabase
    .from('money_accounts')
    .select('*')
    .eq('business_id', businessId)
    .eq('is_active', true)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function updateMoneyAccountOpening(
  accountId: string,
  openingBalance: number,
  openingDate: string
): Promise<void> {
  const { error } = await supabase
    .from('money_accounts')
    .update({ opening_balance: openingBalance, opening_date: openingDate })
    .eq('id', accountId);
  if (error) throw error;
}

export async function getMoneyPosition(businessId: string): Promise<MoneyPosition> {
  const { data, error } = await supabase.rpc('get_money_position', { business_id_input: businessId });
  if (error) throw error;
  return data as MoneyPosition;
}

export async function getMoneySummary(businessId: string, startDate: string, endDate: string): Promise<MoneySummary> {
  const { data, error } = await supabase.rpc('get_money_summary', {
    business_id_input: businessId,
    start_date_input: startDate,
    end_date_input: endDate,
  });
  if (error) throw error;
  return data as MoneySummary;
}

export async function getMoneyLedger(businessId: string, startDate: string, endDate: string): Promise<LedgerEntry[]> {
  const { data, error } = await supabase.rpc('get_money_ledger', {
    business_id_input: businessId,
    start_date_input: startDate,
    end_date_input: endDate,
  });
  if (error) throw error;
  return data ?? [];
}

export interface MoneyMovementInput {
  businessId: string;
  kind: MovementKind;
  accountId: string;
  toAccountId: string | null;
  // Positive, except cash-count adjustments, which carry their sign.
  amount: number;
  movementDate: string;
  note: string | null;
  createdBy: string | null;
}

export async function recordMoneyMovement(input: MoneyMovementInput): Promise<void> {
  const { error } = await supabase.from('money_movements').insert({
    business_id: input.businessId,
    kind: input.kind,
    account_id: input.accountId,
    to_account_id: input.kind === 'transfer' ? input.toAccountId : null,
    amount: input.amount,
    movement_date: input.movementDate,
    note: input.note,
    created_by: input.createdBy,
  });
  if (error) throw error;
}

export async function deleteMoneyMovement(movementId: string): Promise<void> {
  const { error } = await supabase.from('money_movements').delete().eq('id', movementId);
  if (error) throw error;
}

// Paying for a purchase that was bought on credit.
export async function payPurchase(purchaseId: string, accountId: string, paidDate: string): Promise<void> {
  const { error } = await supabase.rpc('pay_stock_purchase', {
    purchase_id_input: purchaseId,
    account_id_input: accountId,
    paid_date_input: paidDate,
  });
  if (error) throw error;
}
