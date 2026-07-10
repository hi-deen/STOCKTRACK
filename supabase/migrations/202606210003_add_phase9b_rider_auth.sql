create extension if not exists pgcrypto;

create table if not exists public.rider_sessions (
  id uuid primary key default gen_random_uuid(),
  rider_id uuid not null references public.riders(id) on delete cascade,
  token uuid not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days'
);

alter table public.rider_sessions enable row level security;

create or replace function public.rider_signup(
  phone_input text,
  pin_input text,
  full_name_input text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  new_rider_id uuid;
begin
  if exists (
    select 1
    from public.riders
    where lower(phone) = lower(phone_input)
  ) then
    raise exception 'Phone number already registered';
  end if;

  insert into public.riders (phone, pin_hash, full_name, is_active)
  values (
    phone_input,
    crypt(pin_input::text, gen_salt('bf'::text)),
    full_name_input,
    true
  )
  returning id into new_rider_id;

  return new_rider_id;
end;
$$;

grant execute on function public.rider_signup(text, text, text) to anon;
grant execute on function public.rider_signup(text, text, text) to authenticated;

create or replace function public.rider_login(
  phone_input text,
  pin_input text
)
returns table (
  rider_id uuid,
  token uuid,
  full_name text
)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  rider_row public.riders%rowtype;
  new_token uuid;
begin
  select *
  into rider_row
  from public.riders
  where lower(phone) = lower(phone_input)
    and is_active = true
  limit 1;

  if not found or extensions.crypt(pin_input::text, rider_row.pin_hash) <> rider_row.pin_hash then
    raise exception 'Invalid phone or PIN';
  end if;

  new_token := gen_random_uuid();

  insert into public.rider_sessions (rider_id, token, expires_at)
  values (rider_row.id, new_token, now() + interval '30 days');

  return query
  select rider_row.id, new_token, rider_row.full_name;
end;
$$;

grant execute on function public.rider_login(text, text) to anon;
grant execute on function public.rider_login(text, text) to authenticated;

create or replace function public.rider_session_check(
  token_input uuid
)
returns table (
  rider_id uuid,
  full_name text
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    rs.rider_id,
    r.full_name
  from public.rider_sessions rs
  join public.riders r on r.id = rs.rider_id
  where rs.token = token_input
    and rs.expires_at > now();
$$;

grant execute on function public.rider_session_check(uuid) to anon;
grant execute on function public.rider_session_check(uuid) to authenticated;

create or replace function public.get_rider_home_data(
  token_input uuid
)
returns table (
  link_id uuid,
  business_id uuid,
  business_name text,
  status text,
  requested_via text,
  assigned_shop_count bigint
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  rider_id_value uuid;
begin
  select rs.rider_id
  into rider_id_value
  from public.rider_sessions rs
  where rs.token = token_input
    and rs.expires_at > now();

  if rider_id_value is null then
    raise exception 'Invalid session';
  end if;

  return query
  select
    rbl.id,
    b.id,
    b.name,
    rbl.status,
    rbl.requested_via,
    count(distinct ra.shop_id)::bigint
  from public.rider_business_links rbl
  join public.businesses b on b.id = rbl.business_id
  left join public.rider_assignments ra on ra.rider_business_link_id = rbl.id
  where rbl.rider_id = rider_id_value
  group by rbl.id, b.id, b.name, rbl.status, rbl.requested_via
  order by b.name;
end;
$$;

grant execute on function public.get_rider_home_data(uuid) to anon;
grant execute on function public.get_rider_home_data(uuid) to authenticated;

create or replace function public.update_rider_link_status(
  token_input uuid,
  link_id_input uuid,
  status_input text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  rider_id_value uuid;
begin
  select rs.rider_id
  into rider_id_value
  from public.rider_sessions rs
  where rs.token = token_input
    and rs.expires_at > now();

  if rider_id_value is null then
    raise exception 'Invalid session';
  end if;

  if status_input not in ('active', 'declined') then
    raise exception 'Invalid status';
  end if;

  update public.rider_business_links rbl
  set
    status = status_input,
    responded_at = now()
  where rbl.id = link_id_input
    and rbl.rider_id = rider_id_value
    and rbl.status = 'pending';

  if not found then
    raise exception 'Pending request not found';
  end if;
end;
$$;

grant execute on function public.update_rider_link_status(uuid, uuid, text) to anon;
grant execute on function public.update_rider_link_status(uuid, uuid, text) to authenticated;

create or replace function public.redeem_rider_invite_code(
  token_input uuid,
  code_input text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  rider_id_value uuid;
  code_row public.rider_invite_codes%rowtype;
  business_id_value uuid;
begin
  select rs.rider_id
  into rider_id_value
  from public.rider_sessions rs
  where rs.token = token_input
    and rs.expires_at > now();

  if rider_id_value is null then
    raise exception 'Invalid session';
  end if;

  select *
  into code_row
  from public.rider_invite_codes
  where upper(code) = upper(code_input)
    and status = 'active'
    and expires_at > now()
  limit 1;

  if not found then
    raise exception 'Invalid invite code';
  end if;

  business_id_value := code_row.business_id;

  if exists (
    select 1
    from public.rider_business_links rbl
    where rbl.rider_id = rider_id_value
      and rbl.business_id = business_id_value
  ) then
    raise exception 'You are already linked to this business';
  end if;

  insert into public.rider_business_links (
    rider_id,
    business_id,
    status,
    requested_via
  )
  values (
    rider_id_value,
    business_id_value,
    'active',
    'rider_request'
  );

  update public.rider_invite_codes
  set
    status = 'used',
    used_by_rider_id = rider_id_value
  where id = code_row.id;
end;
$$;

grant execute on function public.redeem_rider_invite_code(uuid, text) to anon;
grant execute on function public.redeem_rider_invite_code(uuid, text) to authenticated;
