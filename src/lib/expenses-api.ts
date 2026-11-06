import { supabase } from '@/lib/supabase';
import type { Expense, ExpenseCategory } from '@/types/stock';

export async function listExpenseCategories(businessId: string): Promise<ExpenseCategory[]> {
  const { data, error } = await supabase
    .from('expense_categories')
    .select('*')
    .eq('business_id', businessId)
    .order('name', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createExpenseCategory(businessId: string, name: string): Promise<ExpenseCategory> {
  const { data, error } = await supabase
    .from('expense_categories')
    .insert({ business_id: businessId, name })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// The four starter categories (is_default) can still be renamed/removed —
// the DB places no special protection on them beyond auto-seeding them for
// every business. Left to the UI to decide whether to allow it.
export async function deleteExpenseCategory(categoryId: string): Promise<void> {
  const { error } = await supabase.from('expense_categories').delete().eq('id', categoryId);
  if (error) throw error;
}

export interface ExpenseInput {
  category_id: string;
  amount: number;
  expense_date: string;
  note: string | null;
  // Cash or Bank; the database falls back to Cash.
  account_id?: string | null;
}

export async function listExpenses(businessId: string, limit = 50): Promise<Expense[]> {
  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .eq('business_id', businessId)
    .order('expense_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function createExpense(
  businessId: string,
  input: ExpenseInput,
  createdBy: string | null
): Promise<Expense> {
  const { data, error } = await supabase
    .from('expenses')
    .insert({ ...input, business_id: businessId, created_by: createdBy })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getExpense(expenseId: string): Promise<Expense> {
  const { data, error } = await supabase.from('expenses').select('*').eq('id', expenseId).single();
  if (error) throw error;
  return data;
}

export interface EditExpenseInput {
  expenseId: string;
  categoryId: string;
  amount: number;
  expenseDate: string;
  note: string | null;
  reason: string;
}

// Owner-only, enforced by the RPC; the table grants no direct update/delete.
export async function editExpense(input: EditExpenseInput): Promise<void> {
  const { error } = await supabase.rpc('edit_expense', {
    expense_id_input: input.expenseId,
    category_id_input: input.categoryId,
    amount_input: input.amount,
    expense_date_input: input.expenseDate,
    note_input: input.note,
    reason_input: input.reason,
  });
  if (error) throw error;
}

export async function deleteExpense(expenseId: string, reason: string): Promise<void> {
  const { error } = await supabase.rpc('delete_expense', {
    expense_id_input: expenseId,
    reason_input: reason,
  });
  if (error) throw error;
}
