import { supabase } from '@/lib/supabase';

export interface SoleOwnership {
  business_id: string;
  business_name: string;
  other_members_count: number;
}

export async function getSoleOwnerships(): Promise<SoleOwnership[]> {
  const { data, error } = await supabase.rpc('get_sole_ownerships');
  if (error) throw error;
  return data ?? [];
}

export async function transferBusinessOwnership(
  businessId: string,
  newOwnerUserId: string
): Promise<void> {
  const { error } = await supabase.rpc('transfer_business_ownership', {
    business_id_input: businessId,
    new_owner_user_id_input: newOwnerUserId,
  });
  if (error) throw error;
}

export async function deleteBusinessEntirely(businessId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_business_entirely', {
    business_id_input: businessId,
  });
  if (error) throw error;
}

// Re-verifies the current password by attempting a fresh sign-in — there
// is no dedicated "reauthenticate" call in supabase-js, and this is the
// standard way to confirm a password without a separate secret-checking
// RPC (which SQL can't do anyway; password hashing is Supabase Auth's own
// internal logic, not something exposed to Postgres).
export async function verifyCurrentPassword(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error('Incorrect password.');
}

// Calls the same-origin /api/account/delete route, which forwards the
// session token to the delete-account Edge Function (the function verifies
// it itself and never trusts a client-supplied user id).
export async function deleteMyAccount(): Promise<void> {
  const response = await fetch('/api/account/delete', { method: 'POST' });
  const body = await response.json().catch(() => ({}) as { error?: string });
  if (!response.ok) {
    throw new Error(body?.error ?? 'Could not delete your account.');
  }
}
