alter table public.shops add column if not exists photo_path text;

insert into storage.buckets (id, name, public)
values ('shop-photos', 'shop-photos', false)
on conflict (id) do nothing;

create policy if not exists "Shop photos are viewable by business members"
  on storage.objects
  for select
  using (
    bucket_id = 'shop-photos'
    and (
      split_part(name, '/', 1)::uuid in (select * from public.get_user_business_ids())
      or (storage.foldername(name))[1]::uuid in (select * from public.get_user_business_ids())
    )
  );

create policy if not exists "Shop photos can be uploaded by business members"
  on storage.objects
  for insert
  with check (
    bucket_id = 'shop-photos'
    and (
      split_part(name, '/', 1)::uuid in (select * from public.get_user_business_ids())
      or (storage.foldername(name))[1]::uuid in (select * from public.get_user_business_ids())
    )
  );

create policy if not exists "Shop photos can be updated by business members"
  on storage.objects
  for update
  using (
    bucket_id = 'shop-photos'
    and (
      split_part(name, '/', 1)::uuid in (select * from public.get_user_business_ids())
      or (storage.foldername(name))[1]::uuid in (select * from public.get_user_business_ids())
    )
  )
  with check (
    bucket_id = 'shop-photos'
    and (
      split_part(name, '/', 1)::uuid in (select * from public.get_user_business_ids())
      or (storage.foldername(name))[1]::uuid in (select * from public.get_user_business_ids())
    )
  );

create policy if not exists "Shop photos can be deleted by business members"
  on storage.objects
  for delete
  using (
    bucket_id = 'shop-photos'
    and (
      split_part(name, '/', 1)::uuid in (select * from public.get_user_business_ids())
      or (storage.foldername(name))[1]::uuid in (select * from public.get_user_business_ids())
    )
  );

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
    )::date as last_restock_date,
    case
      when (
        select max(sd.delivery_date)
        from public.stock_deliveries sd
        where sd.shop_id = s.id
      ) is null then null
      else current_date - (
        select max(sd.delivery_date)
        from public.stock_deliveries sd
        where sd.shop_id = s.id
      )
    end::integer as days_since_restock,
    exists (
      select 1
      from public.stock_deliveries sd
      where sd.shop_id = s.id
        and sd.business_id = business_id_input
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
        and sd.delivery_date = current_date
    ) as today_delivery_summary,
    coalesce(
      (
        select sum(pa.amount)
        from public.payments pa
        where pa.shop_id = s.id
          and pa.business_id = business_id_input
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
    ) is null then 0 else 1 end,
    (
      select max(sd.delivery_date)
      from public.stock_deliveries sd
      where sd.shop_id = s.id
    ) desc,
    s.name asc;
end;
$$;

grant execute on function public.get_operations_view(uuid) to authenticated;
