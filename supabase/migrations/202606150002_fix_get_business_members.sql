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
    au.email::text as email,
    bm.role::text as role,
    bm.joined_at::timestamptz as joined_at
  from public.business_members bm
  left join auth.users au on au.id = bm.user_id
  where bm.business_id = business_id_input
  order by bm.joined_at asc, au.email asc;
end;
$$;

grant execute on function public.get_business_members(uuid) to authenticated;
