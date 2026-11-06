import { supabase } from '@/lib/supabase';
import type { AssignableRole, Permission } from '@/lib/permissions';
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

// Owner-only, enforced by the RPC. The owner's own role can't be changed.
export async function setMemberRole(businessId: string, userId: string, role: AssignableRole): Promise<void> {
  const { error } = await supabase.rpc('set_member_role', {
    business_id_input: businessId,
    user_id_input: userId,
    role_input: role,
  });
  if (error) throw error;
}

// Everything the signed-in member may do in this business.
export async function getMyPermissions(businessId: string): Promise<Permission[]> {
  const { data, error } = await supabase.rpc('get_my_permissions', { business_id_input: businessId });
  if (error) throw error;
  return (data ?? []) as Permission[];
}

export async function getRolePermissions(
  businessId: string
): Promise<{ role: AssignableRole; permission: Permission }[]> {
  const { data, error } = await supabase
    .from('business_role_permissions')
    .select('role, permission')
    .eq('business_id', businessId);
  if (error) throw error;
  return data ?? [];
}

// Owner-only. Replaces the role's whole permission list.
export async function setRolePermissions(
  businessId: string,
  role: AssignableRole,
  permissions: Permission[]
): Promise<void> {
  const { error } = await supabase.rpc('set_role_permissions', {
    business_id_input: businessId,
    role_input: role,
    permissions_input: permissions,
  });
  if (error) throw error;
}
