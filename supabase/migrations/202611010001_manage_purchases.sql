-- Owners can edit and delete stock purchases, closing the gap left open in
-- 202608300003. A purchase is also a FIFO lot, so the used part of it
-- (quantity - remaining_quantity) has to stay intact:
-- - Delete needs a wholly unused lot.
-- - Edit can't take quantity below what was used, or move a used lot to
--   another item.
-- - Editing cost or quantity changes unit_cost for the unused part only.
--   Batches already made keep the unit_cost_at_time they recorded.
-- Both stay RPC-only: stock_purchases still has no update/delete grant.

alter table public.stock_movements drop constraint stock_movements_reason_check;
alter table public.stock_movements add constraint stock_movements_reason_check check (reason in (
  'purchase',
  'purchase_edit_reversal',
  'purchase_delete_reversal',
  'batch_production_in',
  'batch_production_out',
  'batch_edit_reversal',
  'batch_delete_reversal',
  'distribution_sale',
  'distribution_edit_reversal',
  'distribution_delete_reversal'
));

create or replace function public.edit_stock_purchase(
  purchase_id_input uuid,
  stock_item_id_input uuid,
  quantity_input numeric,
  total_cost_input numeric,
  purchase_date_input date,
  supplier_input text,
  reason_input text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
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

  if not public.is_business_owner(v_row.business_id) then
    raise exception 'Only the owner can edit a purchase' using errcode = '42501';
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
$$;

create or replace function public.delete_stock_purchase(
  purchase_id_input uuid,
  reason_input text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
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

  if not public.is_business_owner(v_row.business_id) then
    raise exception 'Only the owner can delete a purchase' using errcode = '42501';
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
$$;

revoke execute on function public.edit_stock_purchase(uuid, uuid, numeric, numeric, date, text, text) from public, anon;
revoke execute on function public.delete_stock_purchase(uuid, text) from public, anon;
grant execute on function public.edit_stock_purchase(uuid, uuid, numeric, numeric, date, text, text) to authenticated;
grant execute on function public.delete_stock_purchase(uuid, text) to authenticated;
