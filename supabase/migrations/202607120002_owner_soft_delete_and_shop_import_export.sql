alter table public.stock_deliveries
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by uuid references auth.users(id) on delete set null,
  add column if not exists void_reason text;

alter table public.payments
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by uuid references auth.users(id) on delete set null,
  add column if not exists void_reason text;

create or replace function public.void_delivery(delivery_id_input uuid, reason_input text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  delivery_row public.stock_deliveries%rowtype;
begin
  select *
  into delivery_row
  from public.stock_deliveries
  where id = delivery_id_input
  limit 1;

  if not found then
    raise exception 'Delivery not found';
  end if;

  if delivery_row.voided_at is not null then
    raise exception 'Delivery is already voided';
  end if;

  if not public.is_business_member(delivery_row.business_id) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  update public.stock_deliveries
  set
    voided_at = now(),
    voided_by = auth.uid(),
    void_reason = reason_input
  where id = delivery_id_input;
end;
$$;

grant execute on function public.void_delivery(uuid, text) to authenticated;

create or replace function public.void_payment(payment_id_input uuid, reason_input text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  payment_row public.payments%rowtype;
begin
  select *
  into payment_row
  from public.payments
  where id = payment_id_input
  limit 1;

  if not found then
    raise exception 'Payment not found';
  end if;

  if payment_row.voided_at is not null then
    raise exception 'Payment is already voided';
  end if;

  if not public.is_business_member(payment_row.business_id) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  update public.payments
  set
    voided_at = now(),
    voided_by = auth.uid(),
    void_reason = reason_input
  where id = payment_id_input;
end;
$$;

grant execute on function public.void_payment(uuid, text) to authenticated;

create or replace function public.export_shops(business_id_input uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.is_business_member(business_id_input) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'name', s.name,
        'owner_name', s.owner_name,
        'phone', s.phone,
        'area', s.area,
        'address', s.address,
        'notes', s.notes,
        'usual_order_summary', coalesce(
          (
            select string_agg(
              trim(concat(sp.usual_quantity::text, ' ', coalesce(p.unit, ''), ' ', p.name)),
              ', ' order by p.name
            )
            from public.shop_products sp
            join public.products p on p.id = sp.product_id
            where sp.shop_id = s.id
              and sp.usual_quantity is not null
              and sp.usual_quantity > 0
          ),
          null
        )
      )
      order by s.name
    ),
    '[]'::jsonb
  )
  into result
  from public.shops s
  where s.business_id = business_id_input
    and s.is_active = true;

  return result;
end;
$$;

grant execute on function public.export_shops(uuid) to authenticated;

create or replace function public.import_shops(business_id_input uuid, shops_json jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  imported_count integer := 0;
  skipped_count integer := 0;
  inserted_name text;
  normalized_name text;
begin
  if not public.is_business_member(business_id_input) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if not public.is_business_owner(business_id_input) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  for item in select * from jsonb_array_elements(coalesce(shops_json, '[]'::jsonb))
  loop
    inserted_name := nullif(trim(item->> 'name'), '');
    if inserted_name is null then
      continue;
    end if;

    normalized_name := lower(inserted_name);

    if exists (
      select 1
      from public.shops s
      where s.business_id = business_id_input
        and lower(s.name) = normalized_name
    ) then
      skipped_count := skipped_count + 1;
      continue;
    end if;

    insert into public.shops (
      business_id,
      name,
      owner_name,
      phone,
      area,
      address,
      notes,
      created_by,
      is_active
    )
    values (
      business_id_input,
      inserted_name,
      nullif(trim(item->> 'owner_name'), ''),
      nullif(trim(item->> 'phone'), ''),
      nullif(trim(item->> 'area'), ''),
      nullif(trim(item->> 'address'), ''),
      nullif(trim(item->> 'notes'), ''),
      auth.uid(),
      true
    );

    imported_count := imported_count + 1;
  end loop;

  return jsonb_build_object(
    'imported', imported_count,
    'skipped', skipped_count,
    'errors', jsonb_build_array()
  );
end;
$$;

grant execute on function public.import_shops(uuid, jsonb) to authenticated;

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
        and voided_at is null
    ),
    0
  ) - coalesce(
    (
      select coalesce(sum(amount), 0)
      from public.payments
      where shop_id = shop_id_input
        and voided_at is null
    ),
    0
  );
$$;

grant execute on function public.get_shop_balance(uuid) to authenticated;

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
    and sd.voided_at is null
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
    and p.voided_at is null
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
    and voided_at is null
    and delivery_date between start_date and end_date;

  select coalesce(sum(amount), 0)
  into v_total_payments_collected
  from public.payments
  where business_id = business_id_input
    and voided_at is null
    and payment_date between start_date and end_date;

  select count(*)
  into v_delivery_count
  from public.stock_deliveries
  where business_id = business_id_input
    and voided_at is null
    and delivery_date between start_date and end_date;

  select count(*)
  into v_payment_count
  from public.payments
  where business_id = business_id_input
    and voided_at is null
    and payment_date between start_date and end_date;

  select count(*)
  into v_unique_shops_visited
  from (
    select shop_id from public.stock_deliveries where business_id = business_id_input and voided_at is null and delivery_date between start_date and end_date
    union
    select shop_id from public.payments where business_id = business_id_input and voided_at is null and payment_date between start_date and end_date
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

create or replace function public.get_operations_view(business_id_input uuid)
returns table (
  shop_id uuid,
  shop_name text,
  area text,
  address text,
  phone text,
  photo_path text,
  balance numeric,
  last_restock_date date,
  days_since_restock integer,
  restocked_today boolean,
  today_delivery_summary text,
  payments_today_total numeric,
  payment_status_today text,
  last_payment_method_today text
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
    s.id as shop_id,
    s.name as shop_name,
    s.area,
    s.address,
    s.phone,
    s.photo_path,
    public.get_shop_balance(s.id) as balance,
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
      ) > 0 and public.get_shop_balance(s.id) <= 0 then 'full'
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
      ) > 0 and public.get_shop_balance(s.id) > 0 then 'partial'
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
  where s.business_id = business_id_input
    and s.is_active = true
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
$$;

grant execute on function public.get_operations_view(uuid) to authenticated;

create or replace function public.get_rider_route(token_input uuid)
returns table (
  business_id uuid,
  business_name text,
  shop_id uuid,
  shop_name text,
  area text,
  address text,
  phone text,
  photo_path text,
  usual_order_summary text,
  restocked_today boolean,
  today_delivery_summary text
)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
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
    raise exception 'Invalid or expired session';
  end if;

  return query
  select
    rbl.business_id,
    b.name as business_name,
    s.id as shop_id,
    s.name as shop_name,
    s.area,
    s.address,
    s.phone,
    s.photo_path,
    coalesce(
      (
        select string_agg(
          trim(concat(sp.usual_quantity::text, ' ', coalesce(p.unit, ''), ' ', p.name)),
          ', ' order by p.name
        )
        from public.shop_products sp
        join public.products p on p.id = sp.product_id
        where sp.shop_id = s.id
          and sp.usual_quantity is not null
          and sp.usual_quantity > 0
      ),
      null
    ) as usual_order_summary,
    exists (
      select 1
      from public.stock_deliveries sd
      where sd.shop_id = s.id
        and sd.business_id = rbl.business_id
        and sd.voided_at is null
        and sd.delivery_date = current_date
        and sd.delivered_by_rider_id = rider_id_value
    ) as restocked_today,
    (
      select string_agg(
        concat(sd.quantity::text, ' ', coalesce(p.unit, ''), ' ', coalesce(p.name, '')),
        ', '
      )
      from public.stock_deliveries sd
      left join public.products p on p.id = sd.product_id
      where sd.shop_id = s.id
        and sd.business_id = rbl.business_id
        and sd.voided_at is null
        and sd.delivery_date = current_date
        and sd.delivered_by_rider_id = rider_id_value
    ) as today_delivery_summary
  from public.rider_business_links rbl
  join public.businesses b on b.id = rbl.business_id
  join public.rider_assignments ra on ra.rider_business_link_id = rbl.id
  join public.shops s on s.id = ra.shop_id
  where rbl.rider_id = rider_id_value
    and rbl.status = 'active'
    and extract(dow from current_date)::int = any(ra.days_of_week)
  order by b.name asc, s.area asc, s.name asc;
end;
$$;

grant execute on function public.get_rider_route(uuid) to anon;
grant execute on function public.get_rider_route(uuid) to authenticated;
