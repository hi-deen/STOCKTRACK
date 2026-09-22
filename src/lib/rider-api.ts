import { supabase } from '@/lib/supabase';
import type {
  RiderHomeLink,
  RiderLoginResult,
  RiderRouteStop,
  RiderShopProduct,
} from '@/types/rider';

export async function riderSignup(
  phone: string,
  pin: string,
  fullName: string
): Promise<void> {
  const { error } = await supabase.rpc('rider_signup', {
    phone_input: phone,
    pin_input: pin,
    full_name_input: fullName,
  });
  if (error) throw error;
}

export async function riderLogin(phone: string, pin: string): Promise<RiderLoginResult> {
  const { data, error } = await supabase.rpc('rider_login', {
    phone_input: phone,
    pin_input: pin,
  });
  if (error) throw error;
  const row = data?.[0];
  if (!row) throw new Error('Invalid phone or PIN');
  return row;
}

export async function riderSessionCheck(
  token: string
): Promise<{ rider_id: string; full_name: string } | null> {
  const { data, error } = await supabase.rpc('rider_session_check', { token_input: token });
  if (error) throw error;
  return data?.[0] ?? null;
}

export async function getRiderHomeData(token: string): Promise<RiderHomeLink[]> {
  const { data, error } = await supabase.rpc('get_rider_home_data', { token_input: token });
  if (error) throw error;
  return data ?? [];
}

export async function updateRiderLinkStatus(
  token: string,
  linkId: string,
  status: 'active' | 'declined'
): Promise<void> {
  const { error } = await supabase.rpc('update_rider_link_status', {
    token_input: token,
    link_id_input: linkId,
    status_input: status,
  });
  if (error) throw error;
}

export async function redeemRiderInviteCode(token: string, code: string): Promise<void> {
  const { error } = await supabase.rpc('redeem_rider_invite_code', {
    token_input: token,
    code_input: code,
  });
  if (error) throw error;
}

export async function getRiderRoute(token: string): Promise<RiderRouteStop[]> {
  const { data, error } = await supabase.rpc('get_rider_route', { token_input: token });
  if (error) throw error;
  return data ?? [];
}

export async function getShopProductsForRider(
  token: string,
  shopId: string
): Promise<RiderShopProduct[]> {
  const { data, error } = await supabase.rpc('get_shop_products_for_rider', {
    token_input: token,
    shop_id_input: shopId,
  });
  if (error) throw error;
  return data ?? [];
}

export async function recordRiderDelivery(
  token: string,
  shopId: string,
  productId: string,
  quantity: number,
  proofPhotoPath: string
): Promise<string> {
  const { data, error } = await supabase.rpc('record_rider_delivery', {
    token_input: token,
    shop_id_input: shopId,
    product_id_input: productId,
    quantity_input: quantity,
    proof_photo_path_input: proofPhotoPath,
  });
  if (error) throw error;
  return data as string;
}
