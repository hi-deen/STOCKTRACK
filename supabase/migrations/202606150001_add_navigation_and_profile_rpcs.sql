create or replace function public.get_business_members(business_id_input uuid)
returns table (
  user_id uuid,
  email text,
  role text,
  joined_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_business_member(business_id_input) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  return query
  select
    bm.user_id,
    au.email,
    bm.role,
    bm.joined_at
  from public.business_members bm
  left join auth.users au on au.id = bm.user_id
  where bm.business_id = business_id_input
  order by bm.joined_at asc, au.email asc;
end;
$$;

grant execute on function public.get_business_members(uuid) to authenticated;

create or replace function public.upsert_business_settings(
  business_id_input uuid,
  payment_days int,
  restock_days int,
  display_name text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_business_owner(business_id_input) then
    raise exception 'Only owners can update business settings' using errcode = '42501';
  end if;

  insert into public.business_settings (business_id, payment_reminder_days, restock_reminder_days, business_display_name)
  values (
    business_id_input,
    coalesce(payment_days, 14),
    coalesce(restock_days, 7),
    nullif(display_name, '')
  )
  on conflict (business_id) do update set
    payment_reminder_days = excluded.payment_reminder_days,
    restock_reminder_days = excluded.restock_reminder_days,
    business_display_name = excluded.business_display_name;
end;
$$;

grant execute on function public.upsert_business_settings(uuid, int, int, text) to authenticated;

create or replace function public.add_business(business_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_business_id uuid;
begin
  insert into public.businesses (name, owner_id)
  values (business_name, auth.uid())
  returning id into new_business_id;

  insert into public.business_members (business_id, user_id, role)
  values (new_business_id, auth.uid(), 'owner');

  return new_business_id;
end;
$$;

grant execute on function public.add_business(text) to authenticated;
