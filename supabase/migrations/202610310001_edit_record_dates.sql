-- Users choose the date when recording a delivery/payment (client-side,
-- via the existing delivery_date/payment_date columns); the business OWNER
-- can change that date when editing. Non-owners passing a date get an
-- error; null leaves the date unchanged. Future dates are rejected.

drop function if exists public.edit_stock_delivery(uuid, uuid, uuid, numeric, text);

create or replace function public.edit_stock_delivery(
  delivery_id_input uuid,
  product_id_input uuid,
  selling_unit_id_input uuid,
  quantity_input numeric,
  reason_input text,
  delivery_date_input date default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
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

  if not public.is_business_member(v_row.business_id) then
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
    if not public.is_business_owner(v_row.business_id) then
      raise exception 'Only the owner can change the date' using errcode = '42501';
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
$$;

grant execute on function public.edit_stock_delivery(uuid, uuid, uuid, numeric, text, date) to authenticated;

drop function if exists public.edit_payment(uuid, numeric, text);

create or replace function public.edit_payment(
  payment_id_input uuid,
  amount_input numeric,
  reason_input text,
  payment_date_input date default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
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

  if not public.is_business_member(v_row.business_id) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if v_row.voided_at is not null then
    raise exception 'This payment has been voided and cannot be edited';
  end if;

  if payment_date_input is not null then
    if not public.is_business_owner(v_row.business_id) then
      raise exception 'Only the owner can change the date' using errcode = '42501';
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
$$;

grant execute on function public.edit_payment(uuid, numeric, text, date) to authenticated;
