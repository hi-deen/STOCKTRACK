import { supabase } from '@/lib/supabase';
import type { BusinessMembership } from '@/types/business';

// Direct table read, not an RPC: the business_members SELECT policy already
// allows `user_id = auth.uid()`, so this needs no new database function.
// Explicitly filtering by user_id matters here — the policy also allows
// reading co-members' rows for businesses you belong to, which we don't want.
export async function fetchMyMemberships(userId: string): Promise<BusinessMembership[]> {
  const { data, error } = await supabase
    .from('business_members')
    .select('business_id, role, joined_at, businesses(name)')
    .eq('user_id', userId)
    .order('joined_at', { ascending: true });
  if (error) throw error;

  return (data ?? []).map((row) => {
    const business = row.businesses as unknown as { name: string } | { name: string }[] | null;
    const businessName = Array.isArray(business) ? business[0]?.name : business?.name;
    return {
      business_id: row.business_id as string,
      role: row.role as 'owner' | 'staff',
      business_name: businessName ?? 'Unnamed business',
    };
  });
}

export async function createBusiness(name: string): Promise<string> {
  const { data, error } = await supabase.rpc('create_business', { business_name: name });
  if (error) throw error;
  return data as string;
}

export async function redeemBusinessInviteCode(code: string): Promise<string> {
  const { data, error } = await supabase.rpc('redeem_invite_code', { code_input: code });
  if (error) throw error;
  return data as string;
}

// Staff-only self-removal — the server rejects this for an owner (they
// must transfer ownership or delete the business instead).
export async function leaveBusiness(businessId: string): Promise<void> {
  const { error } = await supabase.rpc('leave_business', { business_id_input: businessId });
  if (error) throw error;
}
