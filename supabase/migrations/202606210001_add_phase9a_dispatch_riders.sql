create extension if not exists pgcrypto;

create table if not exists public.riders (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique,
  pin_hash text not null,
  full_name text not null,
  photo_path text,
  created_at timestamptz not null default now(),
  is_active boolean not null default true
);

create table if not exists public.rider_business_links (
  id uuid primary key default gen_random_uuid(),
  rider_id uuid references public.riders(id) on delete cascade,
  business_id uuid references public.businesses(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'active', 'declined', 'removed')),
  invited_by uuid references auth.users(id) on delete set null,
  requested_via text not null check (requested_via in ('owner_invite', 'rider_request')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (rider_id, business_id)
);

create table if not exists public.rider_invite_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  business_id uuid references public.businesses(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  status text not null check (status in ('active', 'used', 'expired')),
  used_by_rider_id uuid references public.riders(id) on delete set null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.rider_assignments (
  id uuid primary key default gen_random_uuid(),
  rider_business_link_id uuid references public.rider_business_links(id) on delete cascade,
  shop_id uuid references public.shops(id) on delete cascade,
  days_of_week integer[] not null,
  notes text,
  created_at timestamptz not null default now(),
  unique (rider_business_link_id, shop_id)
);

create table if not exists public.shop_products (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid references public.shops(id) on delete cascade,
  product_id uuid references public.products(id) on delete cascade,
  usual_quantity numeric,
  unique (shop_id, product_id)
);

alter table public.stock_deliveries
  add column if not exists delivered_by_rider_id uuid references public.riders(id) on delete set null;

alter table public.stock_deliveries
  add column if not exists proof_photo_path text;

alter table public.riders enable row level security;
alter table public.rider_business_links enable row level security;
alter table public.rider_invite_codes enable row level security;
alter table public.rider_assignments enable row level security;
alter table public.shop_products enable row level security;

insert into storage.buckets (id, name, public)
values ('rider-photos', 'rider-photos', false)
on conflict (id) do nothing;

drop policy if exists "Riders are selectable by owners for linked businesses" on public.riders;
create policy "Riders are selectable by owners for linked businesses"
  on public.riders
  for select
  using (
    auth.role() = 'service_role'
    or exists (
      select 1
      from public.rider_business_links rbl
      join public.business_members bm
        on bm.business_id = rbl.business_id
       and bm.user_id = auth.uid()
       and bm.role = 'owner'
      where rbl.rider_id = riders.id
    )
  );

drop policy if exists "Riders can be inserted only by service role" on public.riders;
create policy "Riders can be inserted only by service role"
  on public.riders
  for insert
  with check (auth.role() = 'service_role');

drop policy if exists "Riders can be updated only by service role" on public.riders;
create policy "Riders can be updated only by service role"
  on public.riders
  for update
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "Riders can be deleted only by service role" on public.riders;
create policy "Riders can be deleted only by service role"
  on public.riders
  for delete
  using (auth.role() = 'service_role');

drop policy if exists "Rider business links are selectable by owners" on public.rider_business_links;
create policy "Rider business links are selectable by owners"
  on public.rider_business_links
  for select
  using (
    exists (
      select 1
      from public.business_members bm
      where bm.business_id = rider_business_links.business_id
        and bm.user_id = auth.uid()
        and bm.role = 'owner'
    )
  );

drop policy if exists "Rider business links are insertable by owners" on public.rider_business_links;
create policy "Rider business links are insertable by owners"
  on public.rider_business_links
  for insert
  with check (
    exists (
      select 1
      from public.business_members bm
      where bm.business_id = rider_business_links.business_id
        and bm.user_id = auth.uid()
        and bm.role = 'owner'
    )
  );

drop policy if exists "Rider business links are updatable by owners" on public.rider_business_links;
create policy "Rider business links are updatable by owners"
  on public.rider_business_links
  for update
  using (
    exists (
      select 1
      from public.business_members bm
      where bm.business_id = rider_business_links.business_id
        and bm.user_id = auth.uid()
        and bm.role = 'owner'
    )
  )
  with check (
    exists (
      select 1
      from public.business_members bm
      where bm.business_id = rider_business_links.business_id
        and bm.user_id = auth.uid()
        and bm.role = 'owner'
    )
  );

drop policy if exists "Rider business links are deletable by owners" on public.rider_business_links;
create policy "Rider business links are deletable by owners"
  on public.rider_business_links
  for delete
  using (
    exists (
      select 1
      from public.business_members bm
      where bm.business_id = rider_business_links.business_id
        and bm.user_id = auth.uid()
        and bm.role = 'owner'
    )
  );

drop policy if exists "Rider invite codes are selectable by owners" on public.rider_invite_codes;
create policy "Rider invite codes are selectable by owners"
  on public.rider_invite_codes
  for select
  using (
    exists (
      select 1
      from public.business_members bm
      where bm.business_id = rider_invite_codes.business_id
        and bm.user_id = auth.uid()
        and bm.role = 'owner'
    )
  );

drop policy if exists "Rider invite codes are insertable by owners" on public.rider_invite_codes;
create policy "Rider invite codes are insertable by owners"
  on public.rider_invite_codes
  for insert
  with check (
    exists (
      select 1
      from public.business_members bm
      where bm.business_id = rider_invite_codes.business_id
        and bm.user_id = auth.uid()
        and bm.role = 'owner'
    )
  );

drop policy if exists "Rider invite codes are updatable by owners" on public.rider_invite_codes;
create policy "Rider invite codes are updatable by owners"
  on public.rider_invite_codes
  for update
  using (
    exists (
      select 1
      from public.business_members bm
      where bm.business_id = rider_invite_codes.business_id
        and bm.user_id = auth.uid()
        and bm.role = 'owner'
    )
  )
  with check (
    exists (
      select 1
      from public.business_members bm
      where bm.business_id = rider_invite_codes.business_id
        and bm.user_id = auth.uid()
        and bm.role = 'owner'
    )
  );

drop policy if exists "Rider assignments are selectable by owners" on public.rider_assignments;
create policy "Rider assignments are selectable by owners"
  on public.rider_assignments
  for select
  using (
    exists (
      select 1
      from public.rider_business_links rbl
      join public.business_members bm
        on bm.business_id = rbl.business_id
       and bm.user_id = auth.uid()
       and bm.role = 'owner'
      where rbl.id = rider_assignments.rider_business_link_id
    )
  );

drop policy if exists "Rider assignments are insertable by owners" on public.rider_assignments;
create policy "Rider assignments are insertable by owners"
  on public.rider_assignments
  for insert
  with check (
    exists (
      select 1
      from public.rider_business_links rbl
      join public.business_members bm
        on bm.business_id = rbl.business_id
       and bm.user_id = auth.uid()
       and bm.role = 'owner'
      where rbl.id = rider_assignments.rider_business_link_id
    )
  );

drop policy if exists "Rider assignments are updatable by owners" on public.rider_assignments;
create policy "Rider assignments are updatable by owners"
  on public.rider_assignments
  for update
  using (
    exists (
      select 1
      from public.rider_business_links rbl
      join public.business_members bm
        on bm.business_id = rbl.business_id
       and bm.user_id = auth.uid()
       and bm.role = 'owner'
      where rbl.id = rider_assignments.rider_business_link_id
    )
  )
  with check (
    exists (
      select 1
      from public.rider_business_links rbl
      join public.business_members bm
        on bm.business_id = rbl.business_id
       and bm.user_id = auth.uid()
       and bm.role = 'owner'
      where rbl.id = rider_assignments.rider_business_link_id
    )
  );

drop policy if exists "Rider assignments are deletable by owners" on public.rider_assignments;
create policy "Rider assignments are deletable by owners"
  on public.rider_assignments
  for delete
  using (
    exists (
      select 1
      from public.rider_business_links rbl
      join public.business_members bm
        on bm.business_id = rbl.business_id
       and bm.user_id = auth.uid()
       and bm.role = 'owner'
      where rbl.id = rider_assignments.rider_business_link_id
    )
  );

drop policy if exists "Shop products are scoped to business membership" on public.shop_products;
create policy "Shop products are scoped to business membership"
  on public.shop_products
  for all
  using (
    exists (
      select 1
      from public.shops s
      where s.id = shop_products.shop_id
        and s.business_id in (select * from public.get_user_business_ids())
    )
    and exists (
      select 1
      from public.products p
      where p.id = shop_products.product_id
        and p.business_id in (select * from public.get_user_business_ids())
    )
    and exists (
      select 1
      from public.shops s
      join public.products p on p.business_id = s.business_id
      where s.id = shop_products.shop_id
        and p.id = shop_products.product_id
    )
  )
  with check (
    exists (
      select 1
      from public.shops s
      where s.id = shop_products.shop_id
        and s.business_id in (select * from public.get_user_business_ids())
    )
    and exists (
      select 1
      from public.products p
      where p.id = shop_products.product_id
        and p.business_id in (select * from public.get_user_business_ids())
    )
    and exists (
      select 1
      from public.shops s
      join public.products p on p.business_id = s.business_id
      where s.id = shop_products.shop_id
        and p.id = shop_products.product_id
    )
  );

create or replace function public.generate_rider_invite_code(business_id_input uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  generated_code text;
begin
  if not public.is_business_owner(business_id_input) then
    raise exception 'Only owners can generate rider invite codes';
  end if;

  generated_code := upper(substr(md5(random()::text), 1, 8));

  while exists (select 1 from public.rider_invite_codes where code = generated_code) loop
    generated_code := upper(substr(md5(random()::text), 1, 8));
  end loop;

  insert into public.rider_invite_codes (code, business_id, created_by, status, expires_at)
  values (
    generated_code,
    business_id_input,
    auth.uid(),
    'active',
    now() + interval '30 days'
  );

  return generated_code;
end;
$$;

grant execute on function public.generate_rider_invite_code(uuid) to authenticated;

create or replace function public.get_business_riders(business_id_input uuid)
returns table (
  id uuid,
  rider_id uuid,
  business_id uuid,
  status text,
  requested_via text,
  invited_by uuid,
  created_at timestamptz,
  responded_at timestamptz,
  rider_phone text,
  rider_full_name text,
  rider_photo_path text,
  rider_is_active boolean
)
language sql
security definer
set search_path = public
as $$
  select
    rbl.id,
    rbl.rider_id,
    rbl.business_id,
    rbl.status,
    rbl.requested_via,
    rbl.invited_by,
    rbl.created_at,
    rbl.responded_at,
    r.phone,
    r.full_name,
    r.photo_path,
    r.is_active
  from public.rider_business_links rbl
  join public.riders r on r.id = rbl.rider_id
  where rbl.business_id = business_id_input
    and public.is_business_owner(business_id_input)
  order by r.full_name asc;
$$;

grant execute on function public.get_business_riders(uuid) to authenticated;

create or replace function public.update_rider_assignment(
  rider_business_link_id_input uuid,
  shop_id_input uuid,
  days_of_week_input int[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid;
begin
  select rbl.business_id
  into v_business_id
  from public.rider_business_links rbl
  where rbl.id = rider_business_link_id_input;

  if v_business_id is null or not public.is_business_owner(v_business_id) then
    raise exception 'Only owners can update rider assignments';
  end if;

  insert into public.rider_assignments (
    rider_business_link_id,
    shop_id,
    days_of_week,
    notes
  )
  values (
    rider_business_link_id_input,
    shop_id_input,
    days_of_week_input,
    null
  )
  on conflict (rider_business_link_id, shop_id)
  do update set
    days_of_week = excluded.days_of_week,
    notes = excluded.notes;
end;
$$;

grant execute on function public.update_rider_assignment(uuid, uuid, int[]) to authenticated;
