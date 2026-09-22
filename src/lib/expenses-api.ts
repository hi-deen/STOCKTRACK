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

export async function updateExpense(expenseId: string, input: Partial<ExpenseInput>): Promise<Expense> {
  const { data, error } = await supabase
    .from('expenses')
    .update(input)
    .eq('id', expenseId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteExpense(expenseId: string): Promise<void> {
  const { error } = await supabase.from('expenses').delete().eq('id', expenseId);
  if (error) throw error;
}
