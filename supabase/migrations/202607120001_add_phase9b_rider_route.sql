create extension if not exists pgcrypto;

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

create or replace function public.record_rider_delivery(
  token_input uuid,
  shop_id_input uuid,
  product_id_input uuid,
  quantity_input numeric,
  proof_photo_path_input text
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  rider_id_value uuid;
  unit_price_value numeric;
  business_id_value uuid;
  delivery_id_value uuid;
begin
  if quantity_input is null or quantity_input <= 0 then
    raise exception 'Quantity must be greater than zero';
  end if;

  if proof_photo_path_input is null or trim(proof_photo_path_input) = '' then
    raise exception 'Proof photo is required';
  end if;

  select rs.rider_id
  into rider_id_value
  from public.rider_sessions rs
  where rs.token = token_input
    and rs.expires_at > now();

  if rider_id_value is null then
    raise exception 'Invalid or expired session';
  end if;

  if not exists (
    select 1
    from public.rider_business_links rbl
    join public.rider_assignments ra on ra.rider_business_link_id = rbl.id
    where rbl.rider_id = rider_id_value
      and rbl.status = 'active'
      and ra.shop_id = shop_id_input
      and extract(dow from current_date)::int = any(ra.days_of_week)
  ) then
    raise exception 'This shop is not assigned to this rider today';
  end if;

  select p.unit_price
  into unit_price_value
  from public.products p
  where p.id = product_id_input
  limit 1;

  if unit_price_value is null then
    raise exception 'Invalid product';
  end if;

  select s.business_id
  into business_id_value
  from public.shops s
  where s.id = shop_id_input
  limit 1;

  if business_id_value is null then
    raise exception 'Invalid shop';
  end if;

  insert into public.stock_deliveries (
    business_id,
    shop_id,
    product_id,
    quantity,
    unit_price,
    total_amount,
    delivery_date,
    delivered_by_rider_id,
    proof_photo_path
  )
  values (
    business_id_value,
    shop_id_input,
    product_id_input,
    quantity_input,
    unit_price_value,
    quantity_input * unit_price_value,
    current_date,
    rider_id_value,
    proof_photo_path_input
  )
  returning id into delivery_id_value;

  return delivery_id_value;
end;
$$;

grant execute on function public.record_rider_delivery(uuid, uuid, uuid, numeric, text) to anon;
grant execute on function public.record_rider_delivery(uuid, uuid, uuid, numeric, text) to authenticated;

insert into storage.buckets (id, name, public)
values ('delivery-proofs', 'delivery-proofs', false)
on conflict (id) do nothing;

drop policy if exists "Delivery proofs are insertable by anyone" on storage.objects;
create policy "Delivery proofs are insertable by anyone"
  on storage.objects
  for insert
  with check (bucket_id = 'delivery-proofs' and (auth.role() = 'anon' or auth.role() = 'authenticated'));

drop policy if exists "Delivery proofs are selectable by business members" on storage.objects;
create policy "Delivery proofs are selectable by business members"
  on storage.objects
  for select
  using (
    bucket_id = 'delivery-proofs'
    and auth.role() = 'authenticated'
    and split_part(name, '/', 1) in (
      select bm.business_id::text
      from public.business_members bm
      where bm.user_id = auth.uid()
    )
  );
