create or replace function public.is_business_member(business_id_input uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.business_members bm
    where bm.business_id = business_id_input
      and bm.user_id = auth.uid()
  );
$$;

create or replace function public.get_user_business_ids()
returns setof uuid
language sql
security definer
set search_path = public
as $$
  select distinct bm.business_id
  from public.business_members bm
  where bm.user_id = auth.uid();
$$;

create or replace function public.is_business_owner(business_id_input uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.business_members bm
    where bm.business_id = business_id_input
      and bm.user_id = auth.uid()
      and bm.role = 'owner'
  );
$$;

grant execute on function public.is_business_member(uuid) to authenticated;
grant execute on function public.get_user_business_ids() to authenticated;
grant execute on function public.is_business_owner(uuid) to authenticated;

drop policy if exists "Businesses are viewable by members" on public.businesses;
drop policy if exists "Businesses can be created by authenticated users" on public.businesses;
drop policy if exists "Businesses can be updated by owners" on public.businesses;
drop policy if exists "Businesses can be deleted by owners" on public.businesses;
drop policy if exists "Members are viewable by the user or by a business member" on public.business_members;
drop policy if exists "Members can be inserted by the creator" on public.business_members;
drop policy if exists "Invite codes are viewable by owners" on public.invite_codes;
drop policy if exists "Invite codes can be created by owners" on public.invite_codes;

create policy "Businesses are viewable by members"
  on public.businesses
  for select
  using (id in (select * from public.get_user_business_ids()));

create policy "Businesses can be created by authenticated users"
  on public.businesses
  for insert
  with check (auth.role() = 'authenticated');

create policy "Businesses can be updated by owners"
  on public.businesses
  for update
  using (public.is_business_owner(id));

create policy "Businesses can be deleted by owners"
  on public.businesses
  for delete
  using (public.is_business_owner(id));

create policy "Members are viewable by the user or by a business member"
  on public.business_members
  for select
  using (
    business_id in (select * from public.get_user_business_ids())
    or user_id = auth.uid()
  );

create policy "Members can be inserted by the creator"
  on public.business_members
  for insert
  with check (
    auth.uid() = user_id and role = 'owner'
  );

create policy "Invite codes are viewable by owners"
  on public.invite_codes
  for select
  using (public.is_business_owner(business_id));

create policy "Invite codes can be created by owners"
  on public.invite_codes
  for insert
  with check (public.is_business_owner(business_id));
