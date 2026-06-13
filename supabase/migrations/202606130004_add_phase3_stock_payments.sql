create table if not exists public.stock_deliveries (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  shop_id uuid references public.shops(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  quantity numeric not null default 0,
  unit_price numeric not null default 0,
  total_amount numeric not null default 0,
  delivery_date date not null default current_date,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  shop_id uuid references public.shops(id) on delete cascade,
  amount numeric not null default 0,
  payment_date date not null default current_date,
  method text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.stock_deliveries enable row level security;
alter table public.payments enable row level security;

create policy "Stock deliveries scoped to business membership"
  on public.stock_deliveries
  for all
  using (business_id in (select * from public.get_user_business_ids()))
  with check (business_id in (select * from public.get_user_business_ids()));

create policy "Payments scoped to business membership"
  on public.payments
  for all
  using (business_id in (select * from public.get_user_business_ids()))
  with check (business_id in (select * from public.get_user_business_ids()));

grant select, insert, update, delete on public.stock_deliveries to authenticated;
grant select, insert, update, delete on public.payments to authenticated;

drop function if exists public.get_shop_balance(uuid);
create or replace function public.get_shop_balance(shop_id_input uuid)
returns numeric
language sql
security definer
set search_path = public
as $$
  select coalesce(
    (
      select coalesce(sum(total_amount), 0)
      from public.stock_deliveries
      where shop_id = shop_id_input
    ),
    0
  ) - coalesce(
    (
      select coalesce(sum(amount), 0)
      from public.payments
      where shop_id = shop_id_input
    ),
    0
  );
$$;

grant execute on function public.get_shop_balance(uuid) to authenticated;

drop view if exists public.shop_balances;
create view public.shop_balances as
select
  s.id,
  s.business_id,
  s.name,
  s.is_active,
  public.get_shop_balance(s.id) as balance,
  coalesce(
    (
      select sum(sd.total_amount)
      from public.stock_deliveries sd
      where sd.shop_id = s.id
    ),
    0
  ) as total_delivered,
  coalesce(
    (
      select sum(p.amount)
      from public.payments p
      where p.shop_id = s.id
    ),
    0
  ) as total_paid,
  (
    select max(sd.delivery_date)
    from public.stock_deliveries sd
    where sd.shop_id = s.id
  ) as last_delivery_date,
  (
    select max(p.payment_date)
    from public.payments p
    where p.shop_id = s.id
  ) as last_payment_date
from public.shops s;

grant select on public.shop_balances to authenticated;

drop function if exists public.get_business_dashboard_stats(uuid);
create or replace function public.get_business_dashboard_stats(business_id_input uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total_outstanding numeric;
  v_total_stock_value_this_month numeric;
  v_total_payments_this_month numeric;
  v_active_shops_count bigint;
  v_shops_with_outstanding_balance_count bigint;
  v_top_debtors jsonb;
begin
  if not public.is_business_member(business_id_input) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select coalesce(sum(balance), 0)
  into v_total_outstanding
  from (
    select public.get_shop_balance(s.id) as balance
    from public.shops s
    where s.business_id = business_id_input
  ) as shop_balances
  where balance > 0;

  select coalesce(sum(total_amount), 0)
  into v_total_stock_value_this_month
  from public.stock_deliveries
  where business_id = business_id_input
    and delivery_date >= date_trunc('month', current_date)
    and delivery_date < date_trunc('month', current_date) + interval '1 month';

  select coalesce(sum(amount), 0)
  into v_total_payments_this_month
  from public.payments
  where business_id = business_id_input
    and payment_date >= date_trunc('month', current_date)
    and payment_date < date_trunc('month', current_date) + interval '1 month';

  select count(*)
  into v_active_shops_count
  from public.shops
  where business_id = business_id_input
    and is_active = true;

  select count(*)
  into v_shops_with_outstanding_balance_count
  from (
    select public.get_shop_balance(s.id) as balance
    from public.shops s
    where s.business_id = business_id_input
  ) as shop_balances
  where balance > 0;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'shop_id', shop_id,
        'shop_name', shop_name,
        'balance', balance
      ) order by balance desc
    ),
    '[]'::jsonb
  )
  into v_top_debtors
  from (
    select s.id as shop_id, s.name as shop_name, public.get_shop_balance(s.id) as balance
    from public.shops s
    where s.business_id = business_id_input
      and public.get_shop_balance(s.id) > 0
    order by balance desc
    limit 5
  ) as top_rows;

  return jsonb_build_object(
    'total_outstanding', v_total_outstanding,
    'total_stock_value_this_month', v_total_stock_value_this_month,
    'total_payments_this_month', v_total_payments_this_month,
    'active_shops_count', v_active_shops_count,
    'shops_with_outstanding_balance_count', v_shops_with_outstanding_balance_count,
    'top_5_debtor_shops', v_top_debtors
  );
end;
$$;

grant execute on function public.get_business_dashboard_stats(uuid) to authenticated;
