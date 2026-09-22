-- Two additions, both prompted by making account/business management more
-- self-service and more prominent in both apps:
--
-- 1. leave_business: a staff member can remove themselves from a business
--    without an owner's involvement. Owners are deliberately excluded --
--    an owner who wants out transfers ownership first (transfer_business_
--    ownership already exists) or deletes the business outright
--    (delete_business_entirely below); silently vanishing from a business
--    they still nominally own is not offered. No new audit action is
--    needed: the existing audit_log_business_members_trigger already logs
--    'member.removed' on any delete from business_members, regardless of
--    whether an owner or the member themselves triggered it.
--
-- 2. delete_business_entirely (redefined): the original version (Phase 8,
--    202608290003) predates the Stock/Batches/Expenses build
--    (202608300002-202608300007) and never learned about those tables. It
--    deletes `products` directly, but `batches.product_id` is
--    ON DELETE RESTRICT -- so deleting a business with any batch on record
--    fails with a raw foreign-key violation today. Same risk from
--    `batch_materials.stock_item_id` (restrict on stock_items),
--    `batch_material_lot_consumptions.stock_purchase_id` (restrict on
--    stock_purchases), and `expenses.category_id` (restrict on
--    expense_categories). This was latent while the only path to this RPC
--    was buried in account deletion; it stops being latent once "Delete
--    this business" becomes its own reachable action in Business Settings.
--    Fixed by deleting the batch tree, then stock purchases/items, then
--    expenses/categories, all before products -- in addition to
--    everything the original version already did.

create or replace function public.leave_business(business_id_input uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  member_row public.business_members%rowtype;
begin
  select *
  into member_row
  from public.business_members
  where business_id = business_id_input
    and user_id = auth.uid()
  limit 1;

  if not found then
    raise exception 'You are not a member of this business';
  end if;

  if member_row.role = 'owner' then
    raise exception 'Owners cannot leave a business. Transfer ownership or delete the business instead.'
      using errcode = '42501';
  end if;

  delete from public.business_members
  where business_id = business_id_input
    and user_id = auth.uid();
end;
$$;

grant execute on function public.leave_business(uuid) to authenticated;

create or replace function public.delete_business_entirely(business_id_input uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business public.businesses%rowtype;
begin
  select * into v_business from public.businesses where id = business_id_input;
  if not found then
    raise exception 'Business not found';
  end if;

  if not public.is_business_owner(business_id_input) then
    raise exception 'Only owners can delete a business' using errcode = '42501';
  end if;

  perform public.log_audit_event(
    business_id_input, 'business.deleted', 'business', business_id_input, v_business.name,
    jsonb_build_object('record', to_jsonb(v_business))
  );

  delete from public.rider_assignments
  where rider_business_link_id in (
    select id from public.rider_business_links where business_id = business_id_input
  );
  delete from public.rider_business_links where business_id = business_id_input;
  delete from public.rider_invite_codes where business_id = business_id_input;

  delete from public.shop_products
  where shop_id in (select id from public.shops where business_id = business_id_input);
  delete from public.reminders where business_id = business_id_input;
  delete from public.stock_deliveries where business_id = business_id_input;
  delete from public.payments where business_id = business_id_input;
  -- Every shop regardless of active/deleted state -- there's no continuing
  -- business left for a soft-deleted shop's history to be preserved for.
  delete from public.shops where business_id = business_id_input;

  -- Batch tree, deepest-first, so the RESTRICT fks below never fire.
  delete from public.batch_other_costs
  where batch_id in (select id from public.batches where business_id = business_id_input);
  delete from public.batch_material_lot_consumptions
  where batch_material_id in (
    select bm.id
    from public.batch_materials bm
    join public.batches b on b.id = bm.batch_id
    where b.business_id = business_id_input
  );
  delete from public.batch_materials
  where batch_id in (select id from public.batches where business_id = business_id_input);
  delete from public.batches where business_id = business_id_input;

  -- Stock: movements/purchases/items. Purchases must go before items
  -- (their own fk is cascade, but the lot-consumption rows that could have
  -- referenced them are already gone above either way).
  delete from public.stock_movements where business_id = business_id_input;
  delete from public.stock_purchases where business_id = business_id_input;
  delete from public.stock_items where business_id = business_id_input;

  -- Expenses before categories (expenses.category_id is restrict).
  delete from public.expenses where business_id = business_id_input;
  delete from public.expense_categories where business_id = business_id_input;

  delete from public.product_units where business_id = business_id_input;
  delete from public.products where business_id = business_id_input;

  delete from public.business_settings where business_id = business_id_input;
  delete from public.invite_codes where business_id = business_id_input;
  delete from public.business_members where business_id = business_id_input;

  delete from public.businesses where id = business_id_input;
  -- audit_log rows for this business have their business_id set to null
  -- here (not deleted) -- see 202608290004_audit_log_business_id_nullable.
end;
$$;

grant execute on function public.delete_business_entirely(uuid) to authenticated;
