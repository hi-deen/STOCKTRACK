create or replace function public.get_activity_in_range(business_id_input uuid, start_date date, end_date date)
returns table (
  entry_type text,
  entry_date date,
  shop_id uuid,
  shop_name text,
  shop_area text,
  description text,
  amount numeric,
  product_name text,
  quantity numeric,
  unit text
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
    'delivery'::text as entry_type,
    sd.delivery_date::date as entry_date,
    sd.shop_id,
    s.name as shop_name,
    s.area as shop_area,
    format('%s %s %s', sd.quantity, coalesce(p.unit, ''), coalesce(p.name, '')) as description,
    sd.total_amount as amount,
    p.name as product_name,
    sd.quantity,
    p.unit
  from public.stock_deliveries sd
  left join public.shops s on s.id = sd.shop_id
  left join public.products p on p.id = sd.product_id
  where sd.business_id = business_id_input
    and sd.delivery_date between start_date and end_date

  union all

  select
    'payment'::text as entry_type,
    p.payment_date::date as entry_date,
    p.shop_id,
    s.name as shop_name,
    s.area as shop_area,
    coalesce(p.method, 'payment') || ' payment' as description,
    p.amount,
    null::text as product_name,
    null::numeric as quantity,
    null::text as unit
  from public.payments p
  left join public.shops s on s.id = p.shop_id
  where p.business_id = business_id_input
    and p.payment_date between start_date and end_date

  order by entry_date desc, shop_name asc;
end;
$$;

grant execute on function public.get_activity_in_range(uuid, date, date) to authenticated;

create or replace function public.get_report_summary(business_id_input uuid, start_date date, end_date date)
returns table (
  total_stock_value numeric,
  total_payments_collected numeric,
  delivery_count bigint,
  payment_count bigint,
  unique_shops_visited bigint,
  net_outstanding_change numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total_stock_value numeric;
  v_total_payments_collected numeric;
  v_delivery_count bigint;
  v_payment_count bigint;
  v_unique_shops_visited bigint;
begin
  if not public.is_business_member(business_id_input) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select coalesce(sum(total_amount), 0)
  into v_total_stock_value
  from public.stock_deliveries
  where business_id = business_id_input
    and delivery_date between start_date and end_date;

  select coalesce(sum(amount), 0)
  into v_total_payments_collected
  from public.payments
  where business_id = business_id_input
    and payment_date between start_date and end_date;

  select count(*)
  into v_delivery_count
  from public.stock_deliveries
  where business_id = business_id_input
    and delivery_date between start_date and end_date;

  select count(*)
  into v_payment_count
  from public.payments
  where business_id = business_id_input
    and payment_date between start_date and end_date;

  select count(*)
  into v_unique_shops_visited
  from (
    select shop_id from public.stock_deliveries where business_id = business_id_input and delivery_date between start_date and end_date
    union
    select shop_id from public.payments where business_id = business_id_input and payment_date between start_date and end_date
  ) as visited_shops;

  return query
  select
    v_total_stock_value,
    v_total_payments_collected,
    v_delivery_count,
    v_payment_count,
    v_unique_shops_visited,
    v_total_stock_value - v_total_payments_collected;
end;
$$;

grant execute on function public.get_report_summary(uuid, date, date) to authenticated;
