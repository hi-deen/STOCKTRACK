-- Roles and permissions. Members are now Owner, Admin, Staff or Observer,
-- and the owner chooses what Admin, Staff and Observer may do from a fixed
-- list of permissions. The owner can always do everything; members,
-- invites, roles, ownership and deleting the business stay owner-only.
--
-- Every check goes through has_permission(), in table policies and in the
-- RPCs below, so hiding a button is never the only protection. The RPCs
-- are the live definitions with only their owner/member check swapped.
-- Defaults keep today's staff abilities except editing and deleting
-- production runs, which now sit with purchases and expenses.

alter table public.business_members drop constraint business_members_role_check;
alter table public.business_members add constraint business_members_role_check
  check (role in ('owner', 'admin', 'staff', 'observer'));

alter table public.audit_log drop constraint audit_log_actor_type_check;
alter table public.audit_log add constraint audit_log_actor_type_check
  check (actor_type in ('owner', 'admin', 'staff', 'observer', 'rider'));

create table if not exists public.business_role_permissions (
  business_id uuid not null references public.businesses(id) on delete cascade,
  role text not null check (role in ('admin', 'staff', 'observer')),
  permission text not null check (permission in ('record_sales', 'correct_sales', 'delete_sales', 'record_stock', 'manage_stock_records', 'manage_catalog', 'manage_shops', 'remove_shops', 'manage_riders', 'manage_settings')),
  primary key (business_id, role, permission)
);

alter table public.business_role_permissions enable row level security;

create policy "Role permissions are viewable by business members"
  on public.business_role_permissions
  for select using (business_id in (select public.get_user_business_ids()));

-- Changed only through set_role_permissions().
grant select on public.business_role_permissions to authenticated;

create or replace function public.has_permission(business_id_input uuid, permission_input text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.business_members bm
    where bm.business_id = business_id_input
      and bm.user_id = auth.uid()
      and (
        bm.role = 'owner'
        or exists (
          select 1 from public.business_role_permissions rp
          where rp.business_id = bm.business_id
            and rp.role = bm.role
            and rp.permission = permission_input
        )
      )
  );
$$;

create or replace function public.seed_role_permissions(business_id_input uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.business_role_permissions (business_id, role, permission)
  select business_id_input, d.role, d.permission
  from (values
    ('admin', 'record_sales'),
    ('admin', 'correct_sales'),
    ('admin', 'delete_sales'),
    ('admin', 'record_stock'),
    ('admin', 'manage_stock_records'),
    ('admin', 'manage_catalog'),
    ('admin', 'manage_shops'),
    ('admin', 'remove_shops'),
    ('admin', 'manage_riders'),
    ('admin', 'manage_settings'),
    ('staff', 'record_sales'),
    ('staff', 'correct_sales'),
    ('staff', 'record_stock'),
    ('staff', 'manage_catalog'),
    ('staff', 'manage_shops')
  ) as d(role, permission)
  on conflict do nothing;
$$;

create or replace function public.seed_role_permissions_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.seed_role_permissions(new.id);
  return new;
end;
$$;

drop trigger if exists businesses_seed_role_permissions on public.businesses;
create trigger businesses_seed_role_permissions
after insert on public.businesses
for each row
execute function public.seed_role_permissions_trigger();

select public.seed_role_permissions(id) from public.businesses;

create or replace function public.get_my_permissions(business_id_input uuid)
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select case
    when bm.role = 'owner' then array['record_sales', 'correct_sales', 'delete_sales', 'record_stock', 'manage_stock_records', 'manage_catalog', 'manage_shops', 'remove_shops', 'manage_riders', 'manage_settings']::text[]
    else coalesce((
      select array_agg(rp.permission order by rp.permission)
      from public.business_role_permissions rp
      where rp.business_id = bm.business_id and rp.role = bm.role
    ), '{}'::text[])
  end
  from public.business_members bm
  where bm.business_id = business_id_input and bm.user_id = auth.uid();
$$;

create or replace function public.set_member_role(
  business_id_input uuid,
  user_id_input uuid,
  role_input text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_role text;
begin
  if not public.is_business_owner(business_id_input) then
    raise exception 'Only the owner can change roles' using errcode = '42501';
  end if;
  if role_input not in ('admin', 'staff', 'observer') then
    raise exception 'Invalid role';
  end if;

  select role into v_old_role from public.business_members
  where business_id = business_id_input and user_id = user_id_input
  for update;
  if not found then
    raise exception 'Member not found';
  end if;
  if v_old_role = 'owner' then
    raise exception 'The owner''s role cannot be changed here. Transfer ownership instead';
  end if;

  update public.business_members set role = role_input
  where business_id = business_id_input and user_id = user_id_input;

  perform public.log_audit_event(
    business_id_input, 'member.role_changed', 'business_member', user_id_input,
    (select email from auth.users where id = user_id_input),
    jsonb_build_object('previous_role', v_old_role, 'new_role', role_input)
  );
end;
$$;

create or replace function public.set_role_permissions(
  business_id_input uuid,
  role_input text,
  permissions_input text[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_business_owner(business_id_input) then
    raise exception 'Only the owner can change permissions' using errcode = '42501';
  end if;
  if role_input not in ('admin', 'staff', 'observer') then
    raise exception 'Invalid role';
  end if;

  delete from public.business_role_permissions
  where business_id = business_id_input and role = role_input;

  insert into public.business_role_permissions (business_id, role, permission)
  select distinct business_id_input, role_input, p
  from unnest(coalesce(permissions_input, '{}'::text[])) as p;

  perform public.log_audit_event(
    business_id_input, 'role.permissions_updated', 'role', null, role_input,
    jsonb_build_object('permissions', to_jsonb(coalesce(permissions_input, '{}'::text[])))
  );
end;
$$;

revoke execute on function public.seed_role_permissions(uuid) from public, anon, authenticated;
revoke execute on function public.has_permission(uuid, text) from public, anon;
revoke execute on function public.get_my_permissions(uuid) from public, anon;
revoke execute on function public.set_member_role(uuid, uuid, text) from public, anon;
revoke execute on function public.set_role_permissions(uuid, text, text[]) from public, anon;
grant execute on function public.has_permission(uuid, text) to authenticated;
grant execute on function public.get_my_permissions(uuid) to authenticated;
grant execute on function public.set_member_role(uuid, uuid, text) to authenticated;
grant execute on function public.set_role_permissions(uuid, text, text[]) to authenticated;

-- Internal helper that create_batch/edit_batch call as definer. It was
-- callable directly by any signed-in user, for any business's stock.
revoke execute on function public.consume_stock_item_fifo(uuid, uuid, numeric) from public, anon, authenticated;

-- ============================================================
-- Table policies: viewing stays open to every member; writing needs the
-- matching permission.
-- ============================================================

drop policy if exists "Stock deliveries scoped to business membership" on public.stock_deliveries;
create policy "Deliveries are viewable by business members" on public.stock_deliveries
  for select using (business_id in (select public.get_user_business_ids()));
create policy "Deliveries can be added with permission" on public.stock_deliveries
  for insert with check (public.has_permission(business_id, 'record_sales'));
create policy "Deliveries can be changed with permission" on public.stock_deliveries
  for update using (public.has_permission(business_id, 'correct_sales')) with check (public.has_permission(business_id, 'correct_sales'));
create policy "Deliveries can be deleted with permission" on public.stock_deliveries
  for delete using (public.has_permission(business_id, 'delete_sales'));
drop policy if exists "Payments scoped to business membership" on public.payments;
create policy "Payments are viewable by business members" on public.payments
  for select using (business_id in (select public.get_user_business_ids()));
create policy "Payments can be added with permission" on public.payments
  for insert with check (public.has_permission(business_id, 'record_sales'));
create policy "Payments can be changed with permission" on public.payments
  for update using (public.has_permission(business_id, 'correct_sales')) with check (public.has_permission(business_id, 'correct_sales'));
create policy "Payments can be deleted with permission" on public.payments
  for delete using (public.has_permission(business_id, 'delete_sales'));
drop policy if exists "Shops scoped to business membership" on public.shops;
create policy "Shops are viewable by business members" on public.shops
  for select using (business_id in (select public.get_user_business_ids()));
create policy "Shops can be added with permission" on public.shops
  for insert with check (public.has_permission(business_id, 'manage_shops'));
create policy "Shops can be changed with permission" on public.shops
  for update using (public.has_permission(business_id, 'manage_shops')) with check (public.has_permission(business_id, 'manage_shops'));
create policy "Shops can be deleted with permission" on public.shops
  for delete using (public.has_permission(business_id, 'remove_shops'));
drop policy if exists "Products scoped to business membership" on public.products;
create policy "Products are viewable by business members" on public.products
  for select using (business_id in (select public.get_user_business_ids()));
create policy "Products can be added with permission" on public.products
  for insert with check (public.has_permission(business_id, 'manage_catalog'));
create policy "Products can be changed with permission" on public.products
  for update using (public.has_permission(business_id, 'manage_catalog')) with check (public.has_permission(business_id, 'manage_catalog'));
create policy "Products can be deleted with permission" on public.products
  for delete using (public.has_permission(business_id, 'manage_catalog'));
drop policy if exists "Product units scoped to business membership" on public.product_units;
create policy "Product units are viewable by business members" on public.product_units
  for select using (business_id in (select public.get_user_business_ids()));
create policy "Product units can be added with permission" on public.product_units
  for insert with check (public.has_permission(business_id, 'manage_catalog'));
create policy "Product units can be changed with permission" on public.product_units
  for update using (public.has_permission(business_id, 'manage_catalog')) with check (public.has_permission(business_id, 'manage_catalog'));
create policy "Product units can be deleted with permission" on public.product_units
  for delete using (public.has_permission(business_id, 'manage_catalog'));
drop policy if exists "Stock items scoped to business membership" on public.stock_items;
create policy "Stock items are viewable by business members" on public.stock_items
  for select using (business_id in (select public.get_user_business_ids()));
create policy "Stock items can be added with permission" on public.stock_items
  for insert with check (public.has_permission(business_id, 'manage_catalog'));
create policy "Stock items can be changed with permission" on public.stock_items
  for update using (public.has_permission(business_id, 'manage_catalog')) with check (public.has_permission(business_id, 'manage_catalog'));
create policy "Stock items can be deleted with permission" on public.stock_items
  for delete using (public.has_permission(business_id, 'manage_catalog'));
drop policy if exists "Expense categories scoped to business membership" on public.expense_categories;
create policy "Expense categories are viewable by business members" on public.expense_categories
  for select using (business_id in (select public.get_user_business_ids()));
create policy "Expense categories can be added with permission" on public.expense_categories
  for insert with check (public.has_permission(business_id, 'manage_catalog'));
create policy "Expense categories can be changed with permission" on public.expense_categories
  for update using (public.has_permission(business_id, 'manage_catalog')) with check (public.has_permission(business_id, 'manage_catalog'));
create policy "Expense categories can be deleted with permission" on public.expense_categories
  for delete using (public.has_permission(business_id, 'manage_catalog'));
drop policy if exists "Reminders scoped to business membership" on public.reminders;
create policy "Reminders are viewable by business members" on public.reminders
  for select using (business_id in (select public.get_user_business_ids()));
create policy "Reminders can be added with permission" on public.reminders
  for insert with check (public.has_permission(business_id, 'record_sales'));
create policy "Reminders can be changed with permission" on public.reminders
  for update using (public.has_permission(business_id, 'record_sales')) with check (public.has_permission(business_id, 'record_sales'));
create policy "Reminders can be deleted with permission" on public.reminders
  for delete using (public.has_permission(business_id, 'record_sales'));
drop policy if exists "Business settings scoped to business membership" on public.business_settings;
create policy "Business settings are viewable by business members" on public.business_settings
  for select using (business_id in (select public.get_user_business_ids()));
create policy "Business settings can be added with permission" on public.business_settings
  for insert with check (public.has_permission(business_id, 'manage_settings'));
create policy "Business settings can be changed with permission" on public.business_settings
  for update using (public.has_permission(business_id, 'manage_settings')) with check (public.has_permission(business_id, 'manage_settings'));
create policy "Business settings can be deleted with permission" on public.business_settings
  for delete using (public.has_permission(business_id, 'manage_settings'));

drop policy if exists "Expenses scoped to business membership" on public.expenses;
create policy "Expenses are viewable by business members" on public.expenses
  for select using (business_id in (select public.get_user_business_ids()));
create policy "Expenses can be added with permission" on public.expenses
  for insert with check (public.has_permission(business_id, 'record_stock'));

drop policy if exists "Stock purchases insert scoped to business membership" on public.stock_purchases;
create policy "Stock purchases can be added with permission" on public.stock_purchases
  for insert with check (public.has_permission(business_id, 'record_stock'));

-- Only triggers and definer functions write movements.
drop policy if exists "Stock movements insert scoped to business membership" on public.stock_movements;

drop policy if exists "Shop products are scoped to business membership" on public.shop_products;
create policy "Shop products are viewable by business members" on public.shop_products
  for select using (exists (
    select 1 from public.shops s
    join public.products p on p.business_id = s.business_id
    where s.id = shop_products.shop_id and p.id = shop_products.product_id
      and s.business_id in (select public.get_user_business_ids())
  ));
create policy "Shop products can be added with permission" on public.shop_products
  for insert with check (exists (
    select 1 from public.shops s
    join public.products p on p.business_id = s.business_id
    where s.id = shop_products.shop_id and p.id = shop_products.product_id
      and public.has_permission(s.business_id, 'manage_shops')
  ));
create policy "Shop products can be changed with permission" on public.shop_products
  for update using (exists (
    select 1 from public.shops s
    join public.products p on p.business_id = s.business_id
    where s.id = shop_products.shop_id and p.id = shop_products.product_id
      and public.has_permission(s.business_id, 'manage_shops')
  )) with check (exists (
    select 1 from public.shops s
    join public.products p on p.business_id = s.business_id
    where s.id = shop_products.shop_id and p.id = shop_products.product_id
      and public.has_permission(s.business_id, 'manage_shops')
  ));
create policy "Shop products can be deleted with permission" on public.shop_products
  for delete using (exists (
    select 1 from public.shops s
    join public.products p on p.business_id = s.business_id
    where s.id = shop_products.shop_id and p.id = shop_products.product_id
      and public.has_permission(s.business_id, 'manage_shops')
  ));

drop policy if exists "Shop photos can be uploaded by business members" on storage.objects;
drop policy if exists "Shop photos can be updated by business members" on storage.objects;
drop policy if exists "Shop photos can be deleted by business members" on storage.objects;
create policy "Shop photos can be uploaded with permission" on storage.objects
  for insert with check (bucket_id = 'shop-photos' and public.has_permission((split_part(name, '/', 1))::uuid, 'manage_shops'));
create policy "Shop photos can be updated with permission" on storage.objects
  for update using (bucket_id = 'shop-photos' and public.has_permission((split_part(name, '/', 1))::uuid, 'manage_shops')) with check (bucket_id = 'shop-photos' and public.has_permission((split_part(name, '/', 1))::uuid, 'manage_shops'));
create policy "Shop photos can be deleted with permission" on storage.objects
  for delete using (bucket_id = 'shop-photos' and public.has_permission((split_part(name, '/', 1))::uuid, 'manage_shops'));

drop policy if exists "Rider business links are selectable by owners" on public.rider_business_links;
drop policy if exists "Rider business links are insertable by owners" on public.rider_business_links;
drop policy if exists "Rider business links are updatable by owners" on public.rider_business_links;
drop policy if exists "Rider business links are deletable by owners" on public.rider_business_links;
create policy "Rider business links are selectable with permission" on public.rider_business_links
  for select using (public.has_permission(business_id, 'manage_riders'));
create policy "Rider business links are insertable with permission" on public.rider_business_links
  for insert with check (public.has_permission(business_id, 'manage_riders'));
create policy "Rider business links are updatable with permission" on public.rider_business_links
  for update using (public.has_permission(business_id, 'manage_riders')) with check (public.has_permission(business_id, 'manage_riders'));
create policy "Rider business links are deletable with permission" on public.rider_business_links
  for delete using (public.has_permission(business_id, 'manage_riders'));

drop policy if exists "Rider invite codes are selectable by owners" on public.rider_invite_codes;
drop policy if exists "Rider invite codes are insertable by owners" on public.rider_invite_codes;
drop policy if exists "Rider invite codes are updatable by owners" on public.rider_invite_codes;
create policy "Rider invite codes are selectable with permission" on public.rider_invite_codes
  for select using (public.has_permission(business_id, 'manage_riders'));
create policy "Rider invite codes are insertable with permission" on public.rider_invite_codes
  for insert with check (public.has_permission(business_id, 'manage_riders'));
create policy "Rider invite codes are updatable with permission" on public.rider_invite_codes
  for update using (public.has_permission(business_id, 'manage_riders')) with check (public.has_permission(business_id, 'manage_riders'));

drop policy if exists "Rider assignments are selectable by owners" on public.rider_assignments;
drop policy if exists "Rider assignments are insertable by owners" on public.rider_assignments;
drop policy if exists "Rider assignments are updatable by owners" on public.rider_assignments;
drop policy if exists "Rider assignments are deletable by owners" on public.rider_assignments;
create policy "Rider assignments are selectable with permission" on public.rider_assignments
  for select using (exists (
    select 1 from public.rider_business_links rbl
    where rbl.id = rider_assignments.rider_business_link_id
      and public.has_permission(rbl.business_id, 'manage_riders')
  ));
create policy "Rider assignments are insertable with permission" on public.rider_assignments
  for insert with check (exists (
    select 1 from public.rider_business_links rbl
    where rbl.id = rider_assignments.rider_business_link_id
      and public.has_permission(rbl.business_id, 'manage_riders')
  ));
create policy "Rider assignments are updatable with permission" on public.rider_assignments
  for update using (exists (
    select 1 from public.rider_business_links rbl
    where rbl.id = rider_assignments.rider_business_link_id
      and public.has_permission(rbl.business_id, 'manage_riders')
  )) with check (exists (
    select 1 from public.rider_business_links rbl
    where rbl.id = rider_assignments.rider_business_link_id
      and public.has_permission(rbl.business_id, 'manage_riders')
  ));
create policy "Rider assignments are deletable with permission" on public.rider_assignments
  for delete using (exists (
    select 1 from public.rider_business_links rbl
    where rbl.id = rider_assignments.rider_business_link_id
      and public.has_permission(rbl.business_id, 'manage_riders')
  ));

drop policy if exists "Riders are selectable by owners for linked businesses" on public.riders;
create policy "Riders are selectable with permission for linked businesses" on public.riders
  for select using (
    auth.role() = 'service_role'
    or exists (
      select 1 from public.rider_business_links rbl
      where rbl.rider_id = riders.id
        and public.has_permission(rbl.business_id, 'manage_riders')
    )
  );

-- ============================================================
-- RPCs: live definitions with the owner/member check swapped for the
-- matching permission.
-- ============================================================

CREATE OR REPLACE FUNCTION public.edit_stock_delivery(delivery_id_input uuid, product_id_input uuid, selling_unit_id_input uuid, quantity_input numeric, reason_input text, delivery_date_input date DEFAULT NULL::date)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_row public.stock_deliveries%rowtype;
  v_unit_price numeric;
  v_base_qty numeric;
  v_quantity_base numeric;
begin
  if quantity_input is null or quantity_input <= 0 then
    raise exception 'Quantity must be greater than zero';
  end if;

  select * into v_row from public.stock_deliveries where id = delivery_id_input;
  if not found then
    raise exception 'Delivery not found';
  end if;

  if not public.has_permission(v_row.business_id, 'correct_sales') then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if v_row.voided_at is not null then
    raise exception 'This delivery has been voided and cannot be edited';
  end if;

  select unit_price into v_unit_price
  from public.products
  where id = product_id_input and business_id = v_row.business_id;

  if v_unit_price is null then
    raise exception 'Invalid product';
  end if;

  select base_unit_quantity into v_base_qty
  from public.product_units
  where id = selling_unit_id_input and product_id = product_id_input;

  if v_base_qty is null then
    raise exception 'Invalid selling unit for this product';
  end if;

  v_quantity_base := quantity_input * v_base_qty;

  if delivery_date_input is not null then
    if not public.has_permission(v_row.business_id, 'delete_sales') then
      raise exception 'You do not have permission to change the date' using errcode = '42501';
    end if;
    if delivery_date_input > current_date then
      raise exception 'Date cannot be in the future';
    end if;
  end if;

  perform public.reverse_distribution_delivery_stock_effect(delivery_id_input, 'distribution_edit_reversal');

  perform set_config('app.edit_reason', coalesce(reason_input, ''), true);

  update public.stock_deliveries
  set
    product_id = product_id_input,
    selling_unit_id = selling_unit_id_input,
    quantity = quantity_input,
    quantity_base = v_quantity_base,
    unit_price = v_unit_price,
    total_amount = quantity_input * v_unit_price,
    delivery_date = coalesce(delivery_date_input, delivery_date),
    is_edited = true,
    edited_at = now(),
    edited_by = auth.uid()
  where id = delivery_id_input;

  update public.products
  set current_stock = current_stock - v_quantity_base
  where id = product_id_input;

  insert into public.stock_movements (
    business_id, product_id, quantity_change, reason, reference_table, reference_id, created_by
  )
  values (
    v_row.business_id, product_id_input, -v_quantity_base, 'distribution_sale', 'stock_deliveries', delivery_id_input, auth.uid()
  );

  perform public.check_low_stock_and_notify(
    v_row.business_id, 'product', product_id_input,
    (select name from public.products where id = product_id_input),
    (select current_stock from public.products where id = product_id_input),
    (select reorder_level from public.products where id = product_id_input)
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.edit_payment(payment_id_input uuid, amount_input numeric, reason_input text, payment_date_input date DEFAULT NULL::date)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_row public.payments%rowtype;
begin
  if amount_input is null or amount_input <= 0 then
    raise exception 'Amount must be greater than zero';
  end if;

  select * into v_row from public.payments where id = payment_id_input;
  if not found then
    raise exception 'Payment not found';
  end if;

  if not public.has_permission(v_row.business_id, 'correct_sales') then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if v_row.voided_at is not null then
    raise exception 'This payment has been voided and cannot be edited';
  end if;

  if payment_date_input is not null then
    if not public.has_permission(v_row.business_id, 'delete_sales') then
      raise exception 'You do not have permission to change the date' using errcode = '42501';
    end if;
    if payment_date_input > current_date then
      raise exception 'Date cannot be in the future';
    end if;
  end if;

  perform set_config('app.edit_reason', coalesce(reason_input, ''), true);

  update public.payments
  set
    amount = amount_input,
    payment_date = coalesce(payment_date_input, payment_date),
    is_edited = true,
    edited_at = now(),
    edited_by = auth.uid()
  where id = payment_id_input;
end;
$function$;

CREATE OR REPLACE FUNCTION public.void_delivery(delivery_id_input uuid, reason_input text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  if not public.has_permission(delivery_row.business_id, 'correct_sales') then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  perform public.reverse_distribution_delivery_stock_effect(delivery_id_input, 'distribution_edit_reversal');

  update public.stock_deliveries
  set
    voided_at = now(),
    voided_by = auth.uid(),
    void_reason = reason_input
  where id = delivery_id_input;
end;
$function$;

CREATE OR REPLACE FUNCTION public.void_payment(payment_id_input uuid, reason_input text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  if not public.has_permission(payment_row.business_id, 'correct_sales') then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  update public.payments
  set
    voided_at = now(),
    voided_by = auth.uid(),
    void_reason = reason_input
  where id = payment_id_input;
end;
$function$;

CREATE OR REPLACE FUNCTION public.hard_delete_payment(payment_id_input uuid, reason_input text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_row public.payments%rowtype;
begin
  select * into v_row from public.payments where id = payment_id_input;
  if not found then
    raise exception 'Payment not found';
  end if;

  if not public.has_permission(v_row.business_id, 'delete_sales') then
    raise exception 'You do not have permission to delete a payment entirely' using errcode = '42501';
  end if;

  if v_row.voided_at is not null then
    raise exception 'This payment has already been voided';
  end if;

  perform public.log_audit_event(
    v_row.business_id, 'payment.deleted', 'payment', v_row.id,
    (select name from public.shops where id = v_row.shop_id),
    jsonb_build_object('reason', reason_input, 'record', to_jsonb(v_row))
  );

  delete from public.payments where id = payment_id_input;
end;
$function$;

CREATE OR REPLACE FUNCTION public.hard_delete_stock_delivery(delivery_id_input uuid, reason_input text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_row public.stock_deliveries%rowtype;
begin
  select * into v_row from public.stock_deliveries where id = delivery_id_input;
  if not found then
    raise exception 'Delivery not found';
  end if;

  if not public.has_permission(v_row.business_id, 'delete_sales') then
    raise exception 'You do not have permission to delete a delivery entirely' using errcode = '42501';
  end if;

  if v_row.voided_at is not null then
    raise exception 'This delivery has already been voided';
  end if;

  perform public.reverse_distribution_delivery_stock_effect(delivery_id_input, 'distribution_delete_reversal');

  perform public.log_audit_event(
    v_row.business_id, 'delivery.deleted', 'stock_delivery', v_row.id,
    (select name from public.shops where id = v_row.shop_id),
    jsonb_build_object('reason', reason_input, 'record', to_jsonb(v_row))
  );

  delete from public.stock_deliveries where id = delivery_id_input;
end;
$function$;

CREATE OR REPLACE FUNCTION public.create_batch(business_id_input uuid, name_input text, production_date_input date, product_id_input uuid, output_selling_unit_id_input uuid, output_selling_unit_quantity_input numeric, materials_json jsonb, other_costs_json jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_batch_id uuid;
  v_material jsonb;
  v_other_cost jsonb;
  v_stock_item_id uuid;
  v_quantity_used numeric;
  v_available numeric;
  v_batch_material_id uuid;
  v_line_cost numeric;
  v_total_cost numeric := 0;
  v_base_unit_qty numeric;
  v_output_quantity_base numeric;
begin
  if not public.has_permission(business_id_input, 'record_stock') then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  for v_material in select * from jsonb_array_elements(materials_json)
  loop
    v_stock_item_id := (v_material->>'stock_item_id')::uuid;
    v_quantity_used := (v_material->>'quantity_used')::numeric;

    select coalesce(sum(remaining_quantity), 0) into v_available
    from public.stock_purchases
    where stock_item_id = v_stock_item_id;

    if v_available < v_quantity_used then
      raise exception 'Not enough stock for item % -- need %, have %',
        v_stock_item_id, v_quantity_used, v_available
        using errcode = 'P0001';
    end if;
  end loop;

  select base_unit_quantity into v_base_unit_qty
  from public.product_units
  where id = output_selling_unit_id_input and product_id = product_id_input;

  if v_base_unit_qty is null then
    raise exception 'Selling unit does not belong to the chosen product';
  end if;

  v_output_quantity_base := output_selling_unit_quantity_input * v_base_unit_qty;

  if v_output_quantity_base <= 0 then
    raise exception 'Batch output must be greater than zero';
  end if;

  insert into public.batches (
    business_id, name, production_date, product_id,
    output_selling_unit_id, output_selling_unit_quantity, output_quantity_base,
    created_by
  )
  values (
    business_id_input, name_input, production_date_input, product_id_input,
    output_selling_unit_id_input, output_selling_unit_quantity_input, v_output_quantity_base,
    auth.uid()
  )
  returning id into v_batch_id;

  for v_material in select * from jsonb_array_elements(materials_json)
  loop
    v_stock_item_id := (v_material->>'stock_item_id')::uuid;
    v_quantity_used := (v_material->>'quantity_used')::numeric;

    insert into public.batch_materials (batch_id, stock_item_id, quantity_used, total_cost)
    values (v_batch_id, v_stock_item_id, v_quantity_used, 0)
    returning id into v_batch_material_id;

    v_line_cost := public.consume_stock_item_fifo(v_batch_material_id, v_stock_item_id, v_quantity_used);

    update public.batch_materials set total_cost = v_line_cost where id = v_batch_material_id;

    update public.stock_items
    set current_quantity = current_quantity - v_quantity_used
    where id = v_stock_item_id;

    insert into public.stock_movements (
      business_id, stock_item_id, quantity_change, reason, reference_table, reference_id, created_by
    )
    values (
      business_id_input, v_stock_item_id, -v_quantity_used, 'batch_production_out', 'batches', v_batch_id, auth.uid()
    );

    perform public.check_low_stock_and_notify(
      business_id_input, 'stock_item', v_stock_item_id,
      (select name from public.stock_items where id = v_stock_item_id),
      (select current_quantity from public.stock_items where id = v_stock_item_id),
      (select reorder_level from public.stock_items where id = v_stock_item_id)
    );

    v_total_cost := v_total_cost + v_line_cost;
  end loop;

  for v_other_cost in select * from jsonb_array_elements(other_costs_json)
  loop
    insert into public.batch_other_costs (batch_id, description, amount)
    values (v_batch_id, v_other_cost->>'description', (v_other_cost->>'amount')::numeric);

    v_total_cost := v_total_cost + (v_other_cost->>'amount')::numeric;
  end loop;

  update public.products
  set current_stock = current_stock + v_output_quantity_base
  where id = product_id_input;

  insert into public.stock_movements (
    business_id, product_id, quantity_change, reason, reference_table, reference_id, created_by
  )
  values (
    business_id_input, product_id_input, v_output_quantity_base, 'batch_production_in', 'batches', v_batch_id, auth.uid()
  );

  update public.batches
  set total_cost = v_total_cost,
      cost_per_base_unit = v_total_cost / v_output_quantity_base
  where id = v_batch_id;

  return v_batch_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.edit_batch(batch_id_input uuid, name_input text, production_date_input date, product_id_input uuid, output_selling_unit_id_input uuid, output_selling_unit_quantity_input numeric, materials_json jsonb, other_costs_json jsonb, reason_input text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_batch public.batches%rowtype;
  v_material jsonb;
  v_other_cost jsonb;
  v_stock_item_id uuid;
  v_quantity_used numeric;
  v_available numeric;
  v_batch_material_id uuid;
  v_line_cost numeric;
  v_total_cost numeric := 0;
  v_base_unit_qty numeric;
  v_output_quantity_base numeric;
begin
  select * into v_batch from public.batches where id = batch_id_input;
  if not found then
    raise exception 'Batch not found';
  end if;
  if v_batch.is_deleted then
    raise exception 'This batch has been deleted';
  end if;
  if not public.has_permission(v_batch.business_id, 'manage_stock_records') then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  perform public.reverse_batch_effect(batch_id_input, 'batch_edit_reversal');

  delete from public.batch_materials where batch_id = batch_id_input;
  delete from public.batch_other_costs where batch_id = batch_id_input;

  for v_material in select * from jsonb_array_elements(materials_json)
  loop
    v_stock_item_id := (v_material->>'stock_item_id')::uuid;
    v_quantity_used := (v_material->>'quantity_used')::numeric;

    select coalesce(sum(remaining_quantity), 0) into v_available
    from public.stock_purchases
    where stock_item_id = v_stock_item_id;

    if v_available < v_quantity_used then
      raise exception 'Not enough stock for item % -- need %, have %',
        v_stock_item_id, v_quantity_used, v_available
        using errcode = 'P0001';
    end if;
  end loop;

  select base_unit_quantity into v_base_unit_qty
  from public.product_units
  where id = output_selling_unit_id_input and product_id = product_id_input;

  if v_base_unit_qty is null then
    raise exception 'Selling unit does not belong to the chosen product';
  end if;

  v_output_quantity_base := output_selling_unit_quantity_input * v_base_unit_qty;

  if v_output_quantity_base <= 0 then
    raise exception 'Batch output must be greater than zero';
  end if;

  for v_material in select * from jsonb_array_elements(materials_json)
  loop
    v_stock_item_id := (v_material->>'stock_item_id')::uuid;
    v_quantity_used := (v_material->>'quantity_used')::numeric;

    insert into public.batch_materials (batch_id, stock_item_id, quantity_used, total_cost)
    values (batch_id_input, v_stock_item_id, v_quantity_used, 0)
    returning id into v_batch_material_id;

    v_line_cost := public.consume_stock_item_fifo(v_batch_material_id, v_stock_item_id, v_quantity_used);

    update public.batch_materials set total_cost = v_line_cost where id = v_batch_material_id;

    update public.stock_items
    set current_quantity = current_quantity - v_quantity_used
    where id = v_stock_item_id;

    insert into public.stock_movements (
      business_id, stock_item_id, quantity_change, reason, reference_table, reference_id, created_by
    )
    values (
      v_batch.business_id, v_stock_item_id, -v_quantity_used, 'batch_production_out', 'batches', batch_id_input, auth.uid()
    );

    perform public.check_low_stock_and_notify(
      v_batch.business_id, 'stock_item', v_stock_item_id,
      (select name from public.stock_items where id = v_stock_item_id),
      (select current_quantity from public.stock_items where id = v_stock_item_id),
      (select reorder_level from public.stock_items where id = v_stock_item_id)
    );

    v_total_cost := v_total_cost + v_line_cost;
  end loop;

  for v_other_cost in select * from jsonb_array_elements(other_costs_json)
  loop
    insert into public.batch_other_costs (batch_id, description, amount)
    values (batch_id_input, v_other_cost->>'description', (v_other_cost->>'amount')::numeric);

    v_total_cost := v_total_cost + (v_other_cost->>'amount')::numeric;
  end loop;

  update public.products
  set current_stock = current_stock + v_output_quantity_base
  where id = product_id_input;

  insert into public.stock_movements (
    business_id, product_id, quantity_change, reason, reference_table, reference_id, created_by
  )
  values (
    v_batch.business_id, product_id_input, v_output_quantity_base, 'batch_production_in', 'batches', batch_id_input, auth.uid()
  );

  update public.batches
  set name = name_input,
      production_date = production_date_input,
      product_id = product_id_input,
      output_selling_unit_id = output_selling_unit_id_input,
      output_selling_unit_quantity = output_selling_unit_quantity_input,
      output_quantity_base = v_output_quantity_base,
      total_cost = v_total_cost,
      cost_per_base_unit = v_total_cost / v_output_quantity_base,
      is_edited = true,
      edited_at = now(),
      edited_by = auth.uid()
  where id = batch_id_input;

  perform public.log_audit_event(
    v_batch.business_id, 'batch.edited', 'batch', batch_id_input, name_input,
    jsonb_build_object('reason', reason_input)
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.delete_batch(batch_id_input uuid, reason_input text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_batch public.batches%rowtype;
begin
  select * into v_batch from public.batches where id = batch_id_input;
  if not found then
    raise exception 'Batch not found';
  end if;
  if v_batch.is_deleted then
    raise exception 'This batch has already been deleted';
  end if;
  if not public.has_permission(v_batch.business_id, 'manage_stock_records') then
    raise exception 'You do not have permission to delete a production run' using errcode = '42501';
  end if;

  perform public.reverse_batch_effect(batch_id_input, 'batch_delete_reversal');

  update public.batches
  set is_deleted = true,
      deleted_at = now(),
      deleted_by = auth.uid()
  where id = batch_id_input;

  perform public.log_audit_event(
    v_batch.business_id, 'batch.deleted', 'batch', batch_id_input, v_batch.name,
    jsonb_build_object('reason', reason_input, 'record', to_jsonb(v_batch))
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.edit_stock_purchase(purchase_id_input uuid, stock_item_id_input uuid, quantity_input numeric, total_cost_input numeric, purchase_date_input date, supplier_input text, reason_input text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_row public.stock_purchases%rowtype;
  v_used numeric;
  v_item public.stock_items%rowtype;
  v_touched record;
begin
  if quantity_input is null or quantity_input <= 0 then
    raise exception 'Quantity must be greater than zero';
  end if;
  if total_cost_input is null or total_cost_input < 0 then
    raise exception 'Total cost cannot be negative';
  end if;
  if purchase_date_input is null or purchase_date_input > current_date then
    raise exception 'Date cannot be in the future';
  end if;
  if nullif(trim(coalesce(reason_input, '')), '') is null then
    raise exception 'A reason is required';
  end if;

  select * into v_row from public.stock_purchases where id = purchase_id_input for update;
  if not found then
    raise exception 'Purchase not found';
  end if;

  if not public.has_permission(v_row.business_id, 'manage_stock_records') then
    raise exception 'You do not have permission to edit a purchase' using errcode = '42501';
  end if;

  select * into v_item from public.stock_items
  where id = stock_item_id_input and business_id = v_row.business_id;
  if not found then
    raise exception 'Invalid stock item';
  end if;

  v_used := v_row.quantity - v_row.remaining_quantity;

  if quantity_input < v_used then
    raise exception 'Quantity cannot be less than the % already used in batches', v_used;
  end if;
  if stock_item_id_input <> v_row.stock_item_id and v_used > 0 then
    raise exception 'This purchase has been used in batches, so its item cannot be changed';
  end if;

  update public.stock_items
  set current_quantity = current_quantity - v_row.quantity
  where id = v_row.stock_item_id;

  insert into public.stock_movements (
    business_id, stock_item_id, quantity_change, reason, reference_table, reference_id, created_by
  )
  values (
    v_row.business_id, v_row.stock_item_id, -v_row.quantity, 'purchase_edit_reversal', 'stock_purchases', v_row.id, auth.uid()
  );

  update public.stock_purchases
  set
    stock_item_id = stock_item_id_input,
    quantity = quantity_input,
    remaining_quantity = quantity_input - v_used,
    total_cost = total_cost_input,
    purchase_date = purchase_date_input,
    supplier = nullif(trim(coalesce(supplier_input, '')), '')
  where id = v_row.id;

  update public.stock_items
  set current_quantity = current_quantity + quantity_input
  where id = stock_item_id_input;

  insert into public.stock_movements (
    business_id, stock_item_id, quantity_change, reason, reference_table, reference_id, created_by
  )
  values (
    v_row.business_id, stock_item_id_input, quantity_input, 'purchase', 'stock_purchases', v_row.id, auth.uid()
  );

  perform public.log_audit_event(
    v_row.business_id, 'stock_purchase.edited', 'stock_purchase', v_row.id, v_item.name,
    jsonb_build_object(
      'reason', reason_input,
      'before', to_jsonb(v_row),
      'after', (select to_jsonb(p) from public.stock_purchases p where p.id = v_row.id)
    )
  );

  for v_touched in
    select * from public.stock_items
    where id in (v_row.stock_item_id, stock_item_id_input)
  loop
    perform public.check_low_stock_and_notify(
      v_row.business_id, 'stock_item', v_touched.id, v_touched.name,
      v_touched.current_quantity, v_touched.reorder_level
    );
  end loop;
end;
$function$;

CREATE OR REPLACE FUNCTION public.delete_stock_purchase(purchase_id_input uuid, reason_input text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_row public.stock_purchases%rowtype;
  v_item public.stock_items%rowtype;
begin
  if nullif(trim(coalesce(reason_input, '')), '') is null then
    raise exception 'A reason is required';
  end if;

  select * into v_row from public.stock_purchases where id = purchase_id_input for update;
  if not found then
    raise exception 'Purchase not found';
  end if;

  if not public.has_permission(v_row.business_id, 'manage_stock_records') then
    raise exception 'You do not have permission to delete a purchase' using errcode = '42501';
  end if;

  if v_row.remaining_quantity < v_row.quantity then
    raise exception 'This purchase has been used in batches. Edit or delete those batches first';
  end if;

  -- Deleted batches keep their consumption rows after giving the stock back;
  -- those are the only ones left that could still point at an unused lot.
  delete from public.batch_material_lot_consumptions c
  using public.batch_materials bm, public.batches b
  where c.stock_purchase_id = v_row.id
    and bm.id = c.batch_material_id
    and b.id = bm.batch_id
    and b.is_deleted;

  update public.stock_items
  set current_quantity = current_quantity - v_row.quantity
  where id = v_row.stock_item_id
  returning * into v_item;

  insert into public.stock_movements (
    business_id, stock_item_id, quantity_change, reason, reference_table, reference_id, created_by
  )
  values (
    v_row.business_id, v_row.stock_item_id, -v_row.quantity, 'purchase_delete_reversal', 'stock_purchases', v_row.id, auth.uid()
  );

  delete from public.stock_purchases where id = v_row.id;

  perform public.log_audit_event(
    v_row.business_id, 'stock_purchase.deleted', 'stock_purchase', v_row.id, v_item.name,
    jsonb_build_object('reason', reason_input, 'record', to_jsonb(v_row))
  );

  perform public.check_low_stock_and_notify(
    v_row.business_id, 'stock_item', v_item.id, v_item.name, v_item.current_quantity, v_item.reorder_level
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.edit_expense(expense_id_input uuid, category_id_input uuid, amount_input numeric, expense_date_input date, note_input text, reason_input text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_row public.expenses%rowtype;
  v_category_name text;
begin
  if amount_input is null or amount_input <= 0 then
    raise exception 'Amount must be greater than zero';
  end if;
  if expense_date_input is null or expense_date_input > current_date then
    raise exception 'Date cannot be in the future';
  end if;
  if nullif(trim(coalesce(reason_input, '')), '') is null then
    raise exception 'A reason is required';
  end if;

  select * into v_row from public.expenses where id = expense_id_input for update;
  if not found then
    raise exception 'Expense not found';
  end if;

  if not public.has_permission(v_row.business_id, 'manage_stock_records') then
    raise exception 'You do not have permission to edit an expense' using errcode = '42501';
  end if;

  select name into v_category_name from public.expense_categories
  where id = category_id_input and business_id = v_row.business_id;
  if not found then
    raise exception 'Invalid category';
  end if;

  update public.expenses
  set
    category_id = category_id_input,
    amount = amount_input,
    expense_date = expense_date_input,
    note = nullif(trim(coalesce(note_input, '')), '')
  where id = v_row.id;

  perform public.log_audit_event(
    v_row.business_id, 'expense.edited', 'expense', v_row.id, v_category_name,
    jsonb_build_object(
      'reason', reason_input,
      'before', to_jsonb(v_row),
      'after', (select to_jsonb(e) from public.expenses e where e.id = v_row.id)
    )
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.delete_expense(expense_id_input uuid, reason_input text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_row public.expenses%rowtype;
begin
  if nullif(trim(coalesce(reason_input, '')), '') is null then
    raise exception 'A reason is required';
  end if;

  select * into v_row from public.expenses where id = expense_id_input for update;
  if not found then
    raise exception 'Expense not found';
  end if;

  if not public.has_permission(v_row.business_id, 'manage_stock_records') then
    raise exception 'You do not have permission to delete an expense' using errcode = '42501';
  end if;

  delete from public.expenses where id = v_row.id;

  perform public.log_audit_event(
    v_row.business_id, 'expense.deleted', 'expense', v_row.id,
    (select name from public.expense_categories where id = v_row.category_id),
    jsonb_build_object('reason', reason_input, 'record', to_jsonb(v_row))
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.delete_shop(shop_id_input uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_shop public.shops%rowtype;
  v_history_count bigint;
begin
  select * into v_shop from public.shops where id = shop_id_input;
  if not found then
    raise exception 'Shop not found';
  end if;

  if not public.has_permission(v_shop.business_id, 'remove_shops') then
    raise exception 'You do not have permission to delete shops' using errcode = '42501';
  end if;

  if v_shop.deleted_at is not null then
    raise exception 'This shop has already been deleted';
  end if;

  select
    (select count(*) from public.stock_deliveries where shop_id = shop_id_input)
    + (select count(*) from public.payments where shop_id = shop_id_input)
  into v_history_count;

  delete from public.shop_products where shop_id = shop_id_input;
  delete from public.reminders where shop_id = shop_id_input;

  if v_history_count > 0 then
    -- The shop row persists here (soft delete), so rider_assignments'
    -- ON DELETE CASCADE FK never fires — unlike the hard-delete branch
    -- below, where deleting the shop row itself cascades this
    -- automatically. Cleared explicitly so a deleted shop doesn't linger
    -- on any rider's assignment list. Not audit-logged, same as
    -- shop_products/reminders above — a consequence of the shop
    -- deletion, not a separate action.
    delete from public.rider_assignments where shop_id = shop_id_input;

    update public.shops
    set deleted_at = now(), deleted_by = auth.uid(), is_active = false
    where id = shop_id_input;
    -- shops_audit_log trigger's new soft-delete branch (above) logs this.
  else
    delete from public.shops where id = shop_id_input;
    -- shops_audit_log trigger's DELETE branch logs this, unchanged.
    -- rider_assignments (if any existed) cascade-delete automatically via
    -- its FK — no explicit delete needed here.
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION public.import_shops(business_id_input uuid, shops_json jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  if not public.has_permission(business_id_input, 'remove_shops') then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  perform set_config('app.suppress_shop_audit', 'true', true);

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
        and s.deleted_at is null
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

  if imported_count > 0 then
    perform public.log_audit_event(
      business_id_input, 'shops.imported', 'business', business_id_input,
      (select name from public.businesses where id = business_id_input),
      jsonb_build_object('imported', imported_count, 'skipped', skipped_count)
    );
  end if;

  return jsonb_build_object(
    'imported', imported_count,
    'skipped', skipped_count,
    'errors', jsonb_build_array()
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.generate_rider_invite_code(business_id_input uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  generated_code text;
begin
  if not public.has_permission(business_id_input, 'manage_riders') then
    raise exception 'You do not have permission to invite riders';
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
$function$;

CREATE OR REPLACE FUNCTION public.get_business_riders(business_id_input uuid)
 RETURNS TABLE(id uuid, rider_id uuid, business_id uuid, status text, requested_via text, invited_by uuid, created_at timestamp with time zone, responded_at timestamp with time zone, rider_phone text, rider_full_name text, rider_photo_path text, rider_is_active boolean)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    and public.has_permission(business_id_input, 'manage_riders')
  order by r.full_name asc;
$function$;

CREATE OR REPLACE FUNCTION public.update_rider_assignment(rider_business_link_id_input uuid, shop_id_input uuid, days_of_week_input integer[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_business_id uuid;
begin
  select rbl.business_id
  into v_business_id
  from public.rider_business_links rbl
  where rbl.id = rider_business_link_id_input;

  if v_business_id is null or not public.has_permission(v_business_id, 'manage_riders') then
    raise exception 'You do not have permission to change rider assignments';
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
$function$;

CREATE OR REPLACE FUNCTION public.remove_rider_link(rider_business_link_id_input uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_business_id uuid;
begin
  select rbl.business_id
  into v_business_id
  from public.rider_business_links rbl
  where rbl.id = rider_business_link_id_input;

  if v_business_id is null or not public.has_permission(v_business_id, 'manage_riders') then
    raise exception 'You do not have permission to remove a rider' using errcode = '42501';
  end if;

  update public.rider_business_links
  set
    status = 'removed',
    responded_at = now()
  where id = rider_business_link_id_input
    and status in ('active', 'pending');

  if not found then
    raise exception 'Rider link not found or already inactive';
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION public.upsert_business_settings(business_id_input uuid, payment_days integer, restock_days integer, display_name text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.has_permission(business_id_input, 'manage_settings') then
    raise exception 'You do not have permission to change business settings' using errcode = '42501';
  end if;

  insert into public.business_settings (business_id, payment_reminder_days, restock_reminder_days, business_display_name)
  values (
    business_id_input,
    coalesce(payment_days, 14),
    coalesce(restock_days, 7),
    nullif(display_name, '')
  )
  on conflict (business_id) do update set
    payment_reminder_days = excluded.payment_reminder_days,
    restock_reminder_days = excluded.restock_reminder_days,
    business_display_name = excluded.business_display_name;
end;
$function$;

CREATE OR REPLACE FUNCTION public.log_audit_event(business_id_input uuid, action_input text, target_type_input text, target_id_input uuid, target_label_input text, metadata_input jsonb DEFAULT '{}'::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_actor_id uuid;
  v_actor_type text;
  v_actor_label text;
  v_rider_id uuid;
begin
  -- record_rider_delivery sets this (transaction-local) before its insert
  -- so the stock_deliveries trigger can attribute the delivery correctly —
  -- riders authenticate via a custom session, not Supabase Auth, so
  -- auth.uid() is null for their calls.
  v_rider_id := nullif(current_setting('app.actor_rider_id', true), '')::uuid;

  if v_rider_id is not null then
    v_actor_id := v_rider_id;
    v_actor_type := 'rider';
    select full_name into v_actor_label from public.riders where id = v_rider_id;
  elsif auth.uid() is not null then
    v_actor_id := auth.uid();
    v_actor_type := coalesce(
      (select bm.role from public.business_members bm
       where bm.business_id = business_id_input and bm.user_id = auth.uid()),
      'staff'
    );
    select email into v_actor_label from auth.users where id = auth.uid();
  else
    v_actor_id := null;
    v_actor_type := 'staff';
    v_actor_label := null;
  end if;

  insert into public.audit_log (
    business_id, actor_id, actor_type, actor_label,
    action, target_type, target_id, target_label, metadata
  ) values (
    business_id_input, v_actor_id, v_actor_type, v_actor_label,
    action_input, target_type_input, target_id_input, target_label_input, metadata_input
  );
end;
$function$;
