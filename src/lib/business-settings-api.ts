import { supabase } from '@/lib/supabase';
import type { BusinessSettings } from '@/types/riders-management';

const DEFAULT_SETTINGS: BusinessSettings = {
  payment_reminder_days: 14,
  restock_reminder_days: 7,
  business_display_name: null,
};

export async function getBusinessSettings(businessId: string): Promise<BusinessSettings> {
  const { data, error } = await supabase
    .from('business_settings')
    .select('payment_reminder_days, restock_reminder_days, business_display_name')
    .eq('business_id', businessId)
    .maybeSingle();
  if (error) throw error;
  return data ?? DEFAULT_SETTINGS;
}

export async function saveBusinessSettings(
  businessId: string,
  input: BusinessSettings
): Promise<void> {
  const { error } = await supabase.rpc('upsert_business_settings', {
    business_id_input: businessId,
    payment_days: input.payment_reminder_days,
    restock_days: input.restock_reminder_days,
    display_name: input.business_display_name,
  });
  if (error) throw error;
}
