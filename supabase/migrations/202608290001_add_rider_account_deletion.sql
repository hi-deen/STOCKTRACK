-- Rider self-service account deletion (Google Play data-deletion compliance).
-- Riders authenticate with phone + PIN (no auth.users row), so this mirrors
-- rider_login / rider_session_check rather than the owner delete-account Edge Function.

create or replace function public.rider_delete_account(
  token_input uuid,
  pin_input text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  rider_row public.riders%rowtype;
begin
  select r.*
  into rider_row
  from public.rider_sessions rs
  join public.riders r on r.id = rs.rider_id
  where rs.token = token_input
    and rs.expires_at > now()
  limit 1;

  if not found then
    raise exception 'Invalid or expired session' using errcode = 'P0001';
  end if;

  if extensions.crypt(pin_input::text, rider_row.pin_hash) <> rider_row.pin_hash then
    raise exception 'Incorrect PIN' using errcode = 'P0001';
  end if;

  -- Deleting the rider cascades to rider_sessions, rider_business_links and
  -- rider_assignments. Historical records (stock_deliveries.delivered_by_rider_id,
  -- rider_invite_codes.used_by_rider_id) are ON DELETE SET NULL and are retained
  -- in anonymized form.
  delete from public.riders where id = rider_row.id;

  return jsonb_build_object('deleted', true);
end;
$$;

grant execute on function public.rider_delete_account(uuid, text) to anon;
grant execute on function public.rider_delete_account(uuid, text) to authenticated;
