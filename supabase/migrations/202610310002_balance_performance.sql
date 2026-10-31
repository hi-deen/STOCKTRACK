-- Performance: these tables had no indexes beyond their primary keys, and
-- every balance was computed one shop at a time.
--
-- get_shop_balances returns all of a business's balances in one query, using
-- the same formula as get_shop_balance (non-voided deliveries minus
-- non-voided payments). It includes soft-deleted shops, as get_shop_balance
-- does; callers filter them. get_business_dashboard_stats and
-- get_operations_view are the live definitions, changed only to use it, so
-- their results are unchanged.

create index if not exists stock_deliveries_shop_date_idx
  on public.stock_deliveries (shop_id, delivery_date desc, created_at desc);
create index if not exists stock_deliveries_business_date_idx
  on public.stock_deliveries (business_id, delivery_date desc, created_at desc);
create index if not exists payments_shop_date_idx
  on public.payments (shop_id, payment_date desc, created_at desc);
create index if not exists payments_business_date_idx
  on public.payments (business_id, payment_date desc, created_at desc);
create index if not exists shops_business_id_idx
  on public.shops (business_id);

create or replace function public.get_shop_balances(business_id_input uuid)
returns table(shop_id uuid, balance numeric)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_business_member(business_id_input) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  return query
  select
    s.id,
    coalesce(d.total, 0) - coalesce(p.total, 0)
  from public.shops s
  left join (
    select sd.shop_id as sid, sum(sd.total_amount) as total
    from public.stock_deliveries sd
    where sd.business_id = business_id_input
      and sd.voided_at is null
    group by sd.shop_id
  ) d on d.sid = s.id
  left join (
    select pa.shop_id as sid, sum(pa.amount) as total
    from public.payments pa
    where pa.business_id = business_id_input
      and pa.voided_at is null
    group by pa.shop_id
  ) p on p.sid = s.id
  where s.business_id = business_id_input;
end;
$$;

revoke execute on function public.get_shop_balances(uuid) from public, anon;
grant execute on function public.get_shop_balances(uuid) to authenticated;

CREATE OR REPLACE FUNCTION public.get_business_dashboard_stats(business_id_input uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  select
    coalesce(sum(sb.balance) filter (where sb.balance > 0), 0),
    count(*) filter (where sb.balance > 0),
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'shop_id', top_rows.shop_id,
            'shop_name', top_rows.shop_name,
            'balance', top_rows.balance
          ) order by top_rows.balance desc
        )
        from (
          select s2.id as shop_id, s2.name as shop_name, sb2.balance
          from public.get_shop_balances(business_id_input) sb2
          join public.shops s2 on s2.id = sb2.shop_id
          where s2.deleted_at is null
            and sb2.balance > 0
          order by sb2.balance desc
          limit 5
        ) as top_rows
      ),
      '[]'::jsonb
    )
  into v_total_outstanding, v_shops_with_outstanding_balance_count, v_top_debtors
  from public.get_shop_balances(business_id_input) sb
  join public.shops s on s.id = sb.shop_id
  where s.deleted_at is null;

  select coalesce(sum(total_amount), 0)
  into v_total_stock_value_this_month
  from public.stock_deliveries
  where business_id = business_id_input
    and voided_at is null
    and delivery_date >= date_trunc('month', current_date)
    and delivery_date < date_trunc('month', current_date) + interval '1 month';

  select coalesce(sum(amount), 0)
  into v_total_payments_this_month
  from public.payments
  where business_id = business_id_input
    and voided_at is null
    and payment_date >= date_trunc('month', current_date)
    and payment_date < date_trunc('month', current_date) + interval '1 month';

  select count(*)
  into v_active_shops_count
  from public.shops
  where business_id = business_id_input
    and is_active = true
    and deleted_at is null;

  return jsonb_build_object(
    'total_outstanding', v_total_outstanding,
    'total_stock_value_this_month', v_total_stock_value_this_month,
    'total_payments_this_month', v_total_payments_this_month,
    'active_shops_count', v_active_shops_count,
    'shops_with_outstanding_balance_count', v_shops_with_outstanding_balance_count,
    'top_5_debtor_shops', v_top_debtors
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_operations_view(business_id_input uuid)
 RETURNS TABLE(shop_id uuid, shop_name text, area text, address text, phone text, photo_path text, balance numeric, last_restock_date date, days_since_restock integer, restocked_today boolean, today_delivery_summary text, payments_today_total numeric, payment_status_today text, last_payment_method_today text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_business_member(business_id_input) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  return query
  select
    s.id as shop_id,
    s.name as shop_name,
    s.area,
    s.address,
    s.phone,
    s.photo_path,
    sb.balance as balance,
    (
      select max(sd.delivery_date)
      from public.stock_deliveries sd
      where sd.shop_id = s.id
        and sd.voided_at is null
    )::date as last_restock_date,
    case
      when (
        select max(sd.delivery_date)
        from public.stock_deliveries sd
        where sd.shop_id = s.id
          and sd.voided_at is null
      ) is null then null
      else current_date - (
        select max(sd.delivery_date)
        from public.stock_deliveries sd
        where sd.shop_id = s.id
          and sd.voided_at is null
      )
    end::integer as days_since_restock,
    exists (
      select 1
      from public.stock_deliveries sd
      where sd.shop_id = s.id
        and sd.business_id = business_id_input
        and sd.voided_at is null
        and sd.delivery_date = current_date
    ) as restocked_today,
    (
      select string_agg(
        concat(
          sd.quantity::text,
          ' ',
          coalesce(p.unit, ''),
          ' ',
          coalesce(p.name, '')
        ),
        ', '
      )
      from public.stock_deliveries sd
      left join public.products p on p.id = sd.product_id
      where sd.shop_id = s.id
        and sd.business_id = business_id_input
        and sd.voided_at is null
        and sd.delivery_date = current_date
    ) as today_delivery_summary,
    coalesce(
      (
        select sum(pa.amount)
        from public.payments pa
        where pa.shop_id = s.id
          and pa.business_id = business_id_input
          and pa.voided_at is null
          and pa.payment_date = current_date
      ),
      0
    ) as payments_today_total,
    case
      when coalesce(
        (
          select sum(pa.amount)
          from public.payments pa
          where pa.shop_id = s.id
            and pa.business_id = business_id_input
            and pa.voided_at is null
            and pa.payment_date = current_date
        ),
        0
      ) > 0 and sb.balance <= 0 then 'full'
      when coalesce(
        (
          select sum(pa.amount)
          from public.payments pa
          where pa.shop_id = s.id
            and pa.business_id = business_id_input
            and pa.voided_at is null
            and pa.payment_date = current_date
        ),
        0
      ) > 0 and sb.balance > 0 then 'partial'
      else 'none'
    end as payment_status_today,
    (
      select pa.method
      from public.payments pa
      where pa.shop_id = s.id
        and pa.business_id = business_id_input
        and pa.voided_at is null
        and pa.payment_date = current_date
      order by pa.created_at desc, pa.id desc
      limit 1
    ) as last_payment_method_today
  from public.shops s
  join public.get_shop_balances(business_id_input) sb on sb.shop_id = s.id
  where s.business_id = business_id_input
    and s.is_active = true
    and s.deleted_at is null
  order by
    coalesce(s.area, '') asc,
    case when (
      select max(sd.delivery_date)
      from public.stock_deliveries sd
      where sd.shop_id = s.id
        and sd.voided_at is null
    ) is null then 0 else 1 end,
    (
      select max(sd.delivery_date)
      from public.stock_deliveries sd
      where sd.shop_id = s.id
        and sd.voided_at is null
    ) desc,
    s.name asc;
end;
$function$;
