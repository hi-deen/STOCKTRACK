import { supabase } from '@/lib/supabase';
import type { BusinessMember } from '@/types/riders-management';

export async function getBusinessMembers(businessId: string): Promise<BusinessMember[]> {
  const { data, error } = await supabase.rpc('get_business_members', {
    business_id_input: businessId,
  });
  if (error) throw error;
  return data ?? [];
}

export async function generateInviteCode(businessId: string): Promise<string> {
  const { data, error } = await supabase.rpc('generate_invite_code', {
    business_id_input: businessId,
  });
  if (error) throw error;
  return data as string;
}

export async function removeBusinessMember(businessId: string, userId: string): Promise<void> {
  const { error } = await supabase.rpc('remove_business_member', {
    business_id_input: businessId,
    user_id_input: userId,
  });
  if (error) throw error;
}
