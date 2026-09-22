import { normalizeEmbedded } from '@/lib/supabase-utils';
import { supabase } from '@/lib/supabase';
import type { Reminder, ReminderSuggestion } from '@/types/reminders';

export async function getReminderSuggestions(businessId: string): Promise<ReminderSuggestion[]> {
  const { data, error } = await supabase.rpc('get_reminder_suggestions', {
    business_id_input: businessId,
  });
  if (error) throw error;
  return data ?? [];
}

export async function listPendingReminders(businessId: string): Promise<Reminder[]> {
  const { data, error } = await supabase
    .from('reminders')
    .select('id, shop_id, type, title, message, due_date, status, shops(name)')
    .eq('business_id', businessId)
    .eq('status', 'pending')
    .order('due_date', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => {
    const shop = normalizeEmbedded<{ name: string }>(row.shops as never);
    return {
      id: row.id,
      shop_id: row.shop_id,
      shop_name: shop?.name ?? null,
      type: row.type,
      title: row.title,
      message: row.message,
      due_date: row.due_date,
      status: row.status,
    };
  });
}

export interface CreateReminderInput {
  businessId: string;
  shopId: string | null;
  type: 'payment' | 'restock' | 'custom';
  title: string;
  message: string;
  dueDate: string;
  createdBy: string | null;
}

export async function createReminder(input: CreateReminderInput): Promise<void> {
  const { error } = await supabase.from('reminders').insert({
    business_id: input.businessId,
    shop_id: input.shopId,
    type: input.type,
    title: input.title,
    message: input.message,
    due_date: input.dueDate,
    created_by: input.createdBy,
  });
  if (error) throw error;
}

export async function setReminderStatus(
  reminderId: string,
  status: 'done' | 'dismissed'
): Promise<void> {
  const { error } = await supabase
    .from('reminders')
    .update({ status, completed_at: new Date().toISOString() })
    .eq('id', reminderId);
  if (error) throw error;
}
