create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  name text not null,
  unit text not null,
  unit_price numeric not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.shops (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  name text not null,
  owner_name text,
  phone text,
  area text,
  address text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

alter table public.products enable row level security;
alter table public.shops enable row level security;

create policy "Products scoped to business membership"
  on public.products
  for all
  using (business_id in (select * from public.get_user_business_ids()))
  with check (business_id in (select * from public.get_user_business_ids()));

create policy "Shops scoped to business membership"
  on public.shops
  for all
  using (business_id in (select * from public.get_user_business_ids()))
  with check (business_id in (select * from public.get_user_business_ids()));
