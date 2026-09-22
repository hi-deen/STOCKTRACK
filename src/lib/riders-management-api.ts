import { normalizeEmbedded } from '@/lib/supabase-utils';
import { supabase } from '@/lib/supabase';
import type { BusinessRiderLink, RiderAssignmentRow } from '@/types/riders-management';

export async function getBusinessRiders(businessId: string): Promise<BusinessRiderLink[]> {
  const { data, error } = await supabase.rpc('get_business_riders', {
    business_id_input: businessId,
  });
  if (error) throw error;
  return data ?? [];
}

export async function generateRiderInviteCode(businessId: string): Promise<string> {
  const { data, error } = await supabase.rpc('generate_rider_invite_code', {
    business_id_input: businessId,
  });
  if (error) throw error;
  return data as string;
}

export async function removeRiderLink(linkId: string): Promise<void> {
  const { error } = await supabase.rpc('remove_rider_link', {
    rider_business_link_id_input: linkId,
  });
  if (error) throw error;
}

export async function listRiderAssignments(linkId: string): Promise<RiderAssignmentRow[]> {
  const { data, error } = await supabase
    .from('rider_assignments')
    .select('id, shop_id, days_of_week, shops(name)')
    .eq('rider_business_link_id', linkId);
  if (error) throw error;
  return (data ?? []).map((row) => {
    const shop = normalizeEmbedded<{ name: string }>(row.shops as never);
    return {
      id: row.id,
      shop_id: row.shop_id,
      shop_name: shop?.name ?? 'Unknown shop',
      days_of_week: (row.days_of_week as number[] | null) ?? [],
    };
  });
}

export async function upsertRiderAssignment(
  linkId: string,
  shopId: string,
  daysOfWeek: number[]
): Promise<void> {
  const { error } = await supabase.rpc('update_rider_assignment', {
    rider_business_link_id_input: linkId,
    shop_id_input: shopId,
    days_of_week_input: daysOfWeek,
  });
  if (error) throw error;
}

export async function deleteRiderAssignment(assignmentId: string): Promise<void> {
  const { error } = await supabase.from('rider_assignments').delete().eq('id', assignmentId);
  if (error) throw error;
}
