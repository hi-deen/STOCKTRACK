-- Profit tracking, phases 2-5 of the finance work.
--
-- 1. Finished goods become lots (product_lots), like raw materials already
--    are: one per production run (kept in step with the batch by triggers,
--    so create/edit/delete_batch need no change), one per purchase of
--    bought-in goods (product_purchases), and one "opening" lot of unknown
--    cost for stock on hand today (costing starts from today).
-- 2. Every delivery takes its quantity from the oldest lots first and
--    records what it took and at what cost (delivery_lot_consumptions).
--    Voids, edits and deletes give the quantity back. A sale with no lot
--    left to take from has no cost and is left out of profit, not guessed.
-- 3. Deliveries can carry a discount; total_amount is always
--    quantity * unit_price - discount, enforced by a trigger.
-- 4. Damaged or spoiled finished goods can be written off at their cost.
-- 5. Reporting RPCs for the Profit & finances screen: position (working
--    capital), profit and loss with breakdowns, and a monthly trend.
--    Alerts are worked out by the app from these.

-- ============================================================
-- 1. Discounts on deliveries
-- ============================================================

alter table public.stock_deliveries add column if not exists discount_amount numeric not null default 0;
alter table public.stock_deliveries drop constraint if exists stock_deliveries_discount_check;
alter table public.stock_deliveries add constraint stock_deliveries_discount_check check (discount_amount >= 0);

create or replace function public.set_delivery_total()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.discount_amount := least(coalesce(new.discount_amount, 0), new.quantity * new.unit_price);
  new.total_amount := new.quantity * new.unit_price - new.discount_amount;
  return new;
end;
$$;

drop trigger if exists stock_deliveries_set_total on public.stock_deliveries;
create trigger stock_deliveries_set_total
before insert or update of quantity, unit_price, discount_amount, total_amount on public.stock_deliveries
for each row
execute function public.set_delivery_total();

-- ============================================================
-- 2. Bought-in finished goods
-- ============================================================

create table if not exists public.product_purchases (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  -- In the product's base unit.
  quantity numeric not null check (quantity > 0),
  total_cost numeric not null check (total_cost >= 0),
  purchase_date date not null default current_date,
  supplier text,
  -- Null while bought on credit and not yet paid.
  account_id uuid references public.money_accounts(id),
  on_credit boolean not null default false,
  paid_date date,
  created_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists product_purchases_business_id_idx on public.product_purchases (business_id, purchase_date desc);

alter table public.product_purchases enable row level security;
create policy "Product purchases are viewable by business members" on public.product_purchases
  for select using (business_id in (select public.get_user_business_ids()));
-- Written only through the RPCs below.
grant select on public.product_purchases to authenticated;

-- ============================================================
-- 3. Finished-goods lots and what each delivery took from them
-- ============================================================

create table if not exists public.product_lots (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  source text not null check (source in ('production', 'purchase', 'opening')),
  batch_id uuid unique references public.batches(id) on delete cascade,
  product_purchase_id uuid unique references public.product_purchases(id) on delete cascade,
  lot_date date not null,
  quantity numeric not null check (quantity >= 0),
  remaining numeric not null check (remaining >= 0),
  -- Per base unit. Null for opening stock, whose cost isn't known.
  unit_cost numeric,
  created_at timestamptz not null default now()
);

create index if not exists product_lots_product_idx on public.product_lots (product_id, lot_date, created_at);

create table if not exists public.delivery_lot_consumptions (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references public.stock_deliveries(id) on delete cascade,
  lot_id uuid not null references public.product_lots(id) on delete cascade,
  quantity numeric not null check (quantity > 0),
  unit_cost numeric,
  created_at timestamptz not null default now()
);

create index if not exists delivery_lot_consumptions_delivery_idx on public.delivery_lot_consumptions (delivery_id);
create index if not exists delivery_lot_consumptions_lot_idx on public.delivery_lot_consumptions (lot_id);

create table if not exists public.stock_write_offs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  quantity numeric not null check (quantity > 0),
  cost_amount numeric not null default 0,
  reason text not null,
  write_off_date date not null default current_date,
  created_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists stock_write_offs_business_idx on public.stock_write_offs (business_id, write_off_date desc);

alter table public.product_lots enable row level security;
alter table public.delivery_lot_consumptions enable row level security;
alter table public.stock_write_offs enable row level security;

create policy "Product lots are viewable by business members" on public.product_lots
  for select using (business_id in (select public.get_user_business_ids()));
create policy "Delivery lot consumptions are viewable by business members" on public.delivery_lot_consumptions
  for select using (exists (
    select 1 from public.stock_deliveries d
    where d.id = delivery_id and d.business_id in (select public.get_user_business_ids())
  ));
create policy "Write-offs are viewable by business members" on public.stock_write_offs
  for select using (business_id in (select public.get_user_business_ids()));

grant select on public.product_lots, public.delivery_lot_consumptions, public.stock_write_offs to authenticated;

alter table public.stock_movements drop constraint stock_movements_reason_check;
alter table public.stock_movements add constraint stock_movements_reason_check check (reason in (
  'purchase', 'purchase_edit_reversal', 'purchase_delete_reversal',
  'batch_production_in', 'batch_production_out', 'batch_edit_reversal', 'batch_delete_reversal',
  'distribution_sale', 'distribution_edit_reversal', 'distribution_delete_reversal',
  'write_off'
));

-- Opening stock: whatever is on hand today, cost unknown, sold first.
insert into public.product_lots (business_id, product_id, source, lot_date, quantity, remaining, unit_cost)
select p.business_id, p.id, 'opening', current_date, p.current_stock, p.current_stock, null
from public.products p
where p.current_stock > 0
  and not exists (select 1 from public.product_lots l where l.product_id = p.id);

-- Takes quantity_input of a product from its oldest lots. Returns
-- (quantity taken, cost of what was taken); without a delivery it only
-- reduces the lots (write-offs).
create or replace function public.take_from_product_lots(
  product_id_input uuid,
  quantity_input numeric,
  delivery_id_input uuid
)
returns table(taken numeric, cost numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lot record;
  v_needed numeric := quantity_input;
  v_take numeric;
  v_taken numeric := 0;
  v_cost numeric := 0;
begin
  for v_lot in
    select id, remaining, unit_cost from public.product_lots
    where product_id = product_id_input and remaining > 0
    order by lot_date, created_at
    for update
  loop
    exit when v_needed <= 0;
    v_take := least(v_lot.remaining, v_needed);
    update public.product_lots set remaining = remaining - v_take where id = v_lot.id;
    if delivery_id_input is not null then
      insert into public.delivery_lot_consumptions (delivery_id, lot_id, quantity, unit_cost)
      values (delivery_id_input, v_lot.id, v_take, v_lot.unit_cost);
    end if;
    v_taken := v_taken + v_take;
    v_cost := v_cost + v_take * coalesce(v_lot.unit_cost, 0);
    v_needed := v_needed - v_take;
  end loop;
  return query select v_taken, v_cost;
end;
$$;

create or replace function public.release_delivery_lots(delivery_id_input uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.product_lots l
  set remaining = l.remaining + c.total
  from (
    select lot_id, sum(quantity) as total
    from public.delivery_lot_consumptions
    where delivery_id = delivery_id_input
    group by lot_id
  ) c
  where l.id = c.lot_id;

  delete from public.delivery_lot_consumptions where delivery_id = delivery_id_input;
end;
$$;

create or replace function public.delivery_lots_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.release_delivery_lots(old.id);
    return old;
  end if;

  if tg_op = 'INSERT' then
    if new.voided_at is null and coalesce(new.quantity_base, 0) > 0 then
      perform public.take_from_product_lots(new.product_id, new.quantity_base, new.id);
    end if;
    return new;
  end if;

  -- UPDATE
  if old.voided_at is null and new.voided_at is not null then
    perform public.release_delivery_lots(new.id);
  elsif new.voided_at is null
    and (new.product_id is distinct from old.product_id or new.quantity_base is distinct from old.quantity_base) then
    perform public.release_delivery_lots(new.id);
    if coalesce(new.quantity_base, 0) > 0 then
      perform public.take_from_product_lots(new.product_id, new.quantity_base, new.id);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists stock_deliveries_lots on public.stock_deliveries;
create trigger stock_deliveries_lots
after insert or update on public.stock_deliveries
for each row
execute function public.delivery_lots_trigger();

drop trigger if exists stock_deliveries_lots_delete on public.stock_deliveries;
create trigger stock_deliveries_lots_delete
before delete on public.stock_deliveries
for each row
execute function public.delivery_lots_trigger();

-- Production runs keep their lot in step: created with the run, cost set
-- once the run's materials are costed, adjusted on edit, removed on
-- delete. A run whose output has already been sold can't shrink below what
-- was sold, change product, or be deleted.
create or replace function public.batch_lot_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lot public.product_lots%rowtype;
  v_sold numeric;
begin
  if tg_op = 'INSERT' then
    if not new.is_deleted then
      insert into public.product_lots (business_id, product_id, source, batch_id, lot_date, quantity, remaining, unit_cost)
      values (new.business_id, new.product_id, 'production', new.id, new.production_date,
              new.output_quantity_base, new.output_quantity_base, new.cost_per_base_unit);
    end if;
    return new;
  end if;

  select * into v_lot from public.product_lots where batch_id = new.id for update;
  if not found then
    return new;
  end if;
  v_sold := v_lot.quantity - v_lot.remaining;

  if new.is_deleted and not old.is_deleted then
    if v_sold > 0 then
      raise exception 'Some of this production run has already been sold or written off, so it cannot be deleted';
    end if;
    delete from public.product_lots where id = v_lot.id;
    return new;
  end if;

  if new.output_quantity_base < v_sold then
    raise exception 'This production run cannot be less than the % already sold', v_sold;
  end if;
  if new.product_id <> v_lot.product_id and v_sold > 0 then
    raise exception 'This production run has already been sold, so its product cannot be changed';
  end if;

  update public.product_lots
  set product_id = new.product_id,
      lot_date = new.production_date,
      quantity = new.output_quantity_base,
      remaining = new.output_quantity_base - v_sold,
      unit_cost = new.cost_per_base_unit
  where id = v_lot.id;
  return new;
end;
$$;

drop trigger if exists batches_lot on public.batches;
create trigger batches_lot
after insert or update on public.batches
for each row
execute function public.batch_lot_trigger();

-- ============================================================
-- 4. Recording bought-in goods and write-offs
-- ============================================================

create or replace function public.record_product_purchase(
  business_id_input uuid,
  product_id_input uuid,
  quantity_input numeric,
  total_cost_input numeric,
  purchase_date_input date,
  supplier_input text,
  account_id_input uuid,
  on_credit_input boolean
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_account uuid;
  v_product_name text;
begin
  if not public.has_permission(business_id_input, 'record_stock') then
    raise exception 'You do not have permission to record purchases' using errcode = '42501';
  end if;
  if quantity_input is null or quantity_input <= 0 then
    raise exception 'Quantity must be greater than zero';
  end if;
  if total_cost_input is null or total_cost_input < 0 then
    raise exception 'Total cost cannot be negative';
  end if;
  if purchase_date_input is null or purchase_date_input > current_date then
    raise exception 'Date cannot be in the future';
  end if;

  select name into v_product_name from public.products
  where id = product_id_input and business_id = business_id_input;
  if not found then
    raise exception 'Invalid product';
  end if;

  if not coalesce(on_credit_input, false) then
    v_account := coalesce(account_id_input, public.default_money_account(business_id_input, 'cash'));
    if not exists (select 1 from public.money_accounts where id = v_account and business_id = business_id_input) then
      raise exception 'Invalid money account';
    end if;
  end if;

  insert into public.product_purchases (
    business_id, product_id, quantity, total_cost, purchase_date, supplier,
    account_id, on_credit, paid_date, created_by
  )
  values (
    business_id_input, product_id_input, quantity_input, total_cost_input, purchase_date_input,
    nullif(trim(coalesce(supplier_input, '')), ''),
    v_account, coalesce(on_credit_input, false),
    case when v_account is null then null else purchase_date_input end,
    auth.uid()
  )
  returning id into v_id;

  insert into public.product_lots (business_id, product_id, source, product_purchase_id, lot_date, quantity, remaining, unit_cost)
  values (business_id_input, product_id_input, 'purchase', v_id, purchase_date_input,
          quantity_input, quantity_input, total_cost_input / quantity_input);

  update public.products set current_stock = current_stock + quantity_input where id = product_id_input;

  insert into public.stock_movements (
    business_id, product_id, quantity_change, reason, reference_table, reference_id, created_by
  )
  values (business_id_input, product_id_input, quantity_input, 'purchase', 'product_purchases', v_id, auth.uid());

  perform public.log_audit_event(
    business_id_input, 'product_purchase.recorded', 'product_purchase', v_id, v_product_name,
    jsonb_build_object('quantity', quantity_input, 'total_cost', total_cost_input, 'on_credit', coalesce(on_credit_input, false))
  );

  return v_id;
end;
$$;

create or replace function public.delete_product_purchase(purchase_id_input uuid, reason_input text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.product_purchases%rowtype;
  v_lot public.product_lots%rowtype;
begin
  if nullif(trim(coalesce(reason_input, '')), '') is null then
    raise exception 'A reason is required';
  end if;

  select * into v_row from public.product_purchases where id = purchase_id_input for update;
  if not found then
    raise exception 'Purchase not found';
  end if;
  if not public.has_permission(v_row.business_id, 'manage_stock_records') then
    raise exception 'You do not have permission to delete a purchase' using errcode = '42501';
  end if;

  select * into v_lot from public.product_lots where product_purchase_id = v_row.id for update;
  if found and v_lot.remaining < v_lot.quantity then
    raise exception 'Some of this purchase has already been sold or written off, so it cannot be deleted';
  end if;

  update public.products set current_stock = current_stock - v_row.quantity where id = v_row.product_id;

  insert into public.stock_movements (
    business_id, product_id, quantity_change, reason, reference_table, reference_id, created_by
  )
  values (v_row.business_id, v_row.product_id, -v_row.quantity, 'purchase_delete_reversal', 'product_purchases', v_row.id, auth.uid());

  delete from public.product_purchases where id = v_row.id;

  perform public.log_audit_event(
    v_row.business_id, 'product_purchase.deleted', 'product_purchase', v_row.id,
    (select name from public.products where id = v_row.product_id),
    jsonb_build_object('reason', reason_input, 'record', to_jsonb(v_row))
  );
end;
$$;

create or replace function public.pay_product_purchase(
  purchase_id_input uuid,
  account_id_input uuid,
  paid_date_input date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.product_purchases%rowtype;
begin
  select * into v_row from public.product_purchases where id = purchase_id_input for update;
  if not found then
    raise exception 'Purchase not found';
  end if;
  if not public.has_permission(v_row.business_id, 'manage_money') then
    raise exception 'You do not have permission to record payments to suppliers' using errcode = '42501';
  end if;
  if v_row.account_id is not null then
    raise exception 'This purchase is already paid';
  end if;
  if paid_date_input is null or paid_date_input > current_date then
    raise exception 'Date cannot be in the future';
  end if;
  if not exists (select 1 from public.money_accounts where id = account_id_input and business_id = v_row.business_id) then
    raise exception 'Invalid money account';
  end if;

  update public.product_purchases set account_id = account_id_input, paid_date = paid_date_input where id = v_row.id;

  perform public.log_audit_event(
    v_row.business_id, 'product_purchase.paid', 'product_purchase', v_row.id,
    (select name from public.products where id = v_row.product_id),
    jsonb_build_object('amount', v_row.total_cost, 'account_id', account_id_input, 'paid_date', paid_date_input)
  );
end;
$$;

create or replace function public.write_off_product(
  business_id_input uuid,
  product_id_input uuid,
  quantity_input numeric,
  reason_input text,
  write_off_date_input date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_product_name text;
  v_cost numeric;
begin
  if not public.has_permission(business_id_input, 'manage_stock_records') then
    raise exception 'You do not have permission to write off stock' using errcode = '42501';
  end if;
  if quantity_input is null or quantity_input <= 0 then
    raise exception 'Quantity must be greater than zero';
  end if;
  if nullif(trim(coalesce(reason_input, '')), '') is null then
    raise exception 'A reason is required';
  end if;
  if write_off_date_input is null or write_off_date_input > current_date then
    raise exception 'Date cannot be in the future';
  end if;

  select name into v_product_name from public.products
  where id = product_id_input and business_id = business_id_input;
  if not found then
    raise exception 'Invalid product';
  end if;

  select t.cost into v_cost from public.take_from_product_lots(product_id_input, quantity_input, null) t;

  insert into public.stock_write_offs (business_id, product_id, quantity, cost_amount, reason, write_off_date, created_by)
  values (business_id_input, product_id_input, quantity_input, coalesce(v_cost, 0), trim(reason_input), write_off_date_input, auth.uid())
  returning id into v_id;

  update public.products set current_stock = current_stock - quantity_input where id = product_id_input;

  insert into public.stock_movements (
    business_id, product_id, quantity_change, reason, reference_table, reference_id, created_by
  )
  values (business_id_input, product_id_input, -quantity_input, 'write_off', 'stock_write_offs', v_id, auth.uid());

  perform public.log_audit_event(
    business_id_input, 'stock.written_off', 'stock_write_off', v_id, v_product_name,
    jsonb_build_object('quantity', quantity_input, 'cost', coalesce(v_cost, 0), 'reason', reason_input)
  );

  perform public.check_low_stock_and_notify(
    business_id_input, 'product', product_id_input, v_product_name,
    (select current_stock from public.products where id = product_id_input),
    (select reorder_level from public.products where id = product_id_input)
  );
end;
$$;

-- ============================================================
-- 5. Money ledger: bought-in goods are paid like any purchase
-- ============================================================

create or replace function public.money_ledger_entries(business_id_input uuid)
returns table(
  entry_date date,
  account_id uuid,
  amount numeric,
  kind text,
  description text,
  reference_id uuid,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select p.payment_date, p.account_id, p.amount, 'payment', coalesce(s.name, 'Shop payment'), p.id, p.created_at
  from public.payments p
  left join public.shops s on s.id = p.shop_id
  where p.business_id = business_id_input and p.voided_at is null and p.account_id is not null
  union all
  select sp.paid_date, sp.account_id, -sp.total_cost, 'purchase', coalesce(si.name, 'Purchase'), sp.id, sp.created_at
  from public.stock_purchases sp
  left join public.stock_items si on si.id = sp.stock_item_id
  where sp.business_id = business_id_input and sp.account_id is not null and sp.paid_date is not null
  union all
  select pp.paid_date, pp.account_id, -pp.total_cost, 'purchase', coalesce(pr.name, 'Purchase'), pp.id, pp.created_at
  from public.product_purchases pp
  left join public.products pr on pr.id = pp.product_id
  where pp.business_id = business_id_input and pp.account_id is not null and pp.paid_date is not null
  union all
  select e.expense_date, e.account_id, -e.amount, 'expense', coalesce(ec.name, 'Expense'), e.id, e.created_at
  from public.expenses e
  left join public.expense_categories ec on ec.id = e.category_id
  where e.business_id = business_id_input and e.account_id is not null
  union all
  select m.movement_date, m.account_id,
    case when m.kind in ('capital_in', 'loan_in', 'other_income', 'adjustment') then m.amount else -m.amount end,
    m.kind, coalesce(m.note, ''), m.id, m.created_at
  from public.money_movements m
  where m.business_id = business_id_input
  union all
  select m.movement_date, m.to_account_id, m.amount, 'transfer_in', coalesce(m.note, ''), m.id, m.created_at
  from public.money_movements m
  where m.business_id = business_id_input and m.kind = 'transfer';
$$;

revoke execute on function public.money_ledger_entries(uuid) from public, anon, authenticated;

-- Balance of every account on a date (null before the account's opening date).
create or replace function public.money_balance_on(business_id_input uuid, date_input date)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select case when bool_and(a.opening_date > date_input) then null else
    sum(case when a.opening_date > date_input then 0 else
      a.opening_balance + coalesce((
        select sum(l.amount) from public.money_ledger_entries(business_id_input) l
        where l.account_id = a.id and l.entry_date between a.opening_date and date_input
      ), 0)
    end)
  end
  from public.money_accounts a
  where a.business_id = business_id_input and a.is_active;
$$;

revoke execute on function public.money_balance_on(uuid, date) from public, anon, authenticated;

create or replace function public.get_money_position(business_id_input uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_accounts jsonb;
begin
  if not public.has_permission(business_id_input, 'view_finances') then
    raise exception 'You do not have permission to view finances' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', a.id,
    'name', a.name,
    'kind', a.kind,
    'opening_balance', a.opening_balance,
    'opening_date', a.opening_date,
    'balance', a.opening_balance + coalesce((
      select sum(l.amount) from public.money_ledger_entries(business_id_input) l
      where l.account_id = a.id and l.entry_date >= a.opening_date
    ), 0)
  ) order by a.created_at), '[]'::jsonb)
  into v_accounts
  from public.money_accounts a
  where a.business_id = business_id_input and a.is_active;

  return jsonb_build_object(
    'accounts', v_accounts,
    'cash_total', (select coalesce(sum((x->>'balance')::numeric), 0) from jsonb_array_elements(v_accounts) x),
    'owed_to_business', (
      select coalesce(sum(b.balance), 0)
      from public.get_shop_balances(business_id_input) b
      join public.shops s on s.id = b.shop_id
      where s.deleted_at is null and b.balance > 0
    ),
    'owed_to_suppliers',
      (select coalesce(sum(total_cost), 0) from public.stock_purchases where business_id = business_id_input and account_id is null)
      + (select coalesce(sum(total_cost), 0) from public.product_purchases where business_id = business_id_input and account_id is null),
    'unpaid_purchase_count',
      (select count(*) from public.stock_purchases where business_id = business_id_input and account_id is null)
      + (select count(*) from public.product_purchases where business_id = business_id_input and account_id is null)
  );
end;
$$;

-- ============================================================
-- 6. Profit reporting
-- ============================================================

-- Each non-voided delivery with its cost: how much of it came from lots of
-- known cost, and what that cost was. costed_share is the fraction of the
-- sale whose cost is known (0-1).
create or replace function public.delivery_costs(business_id_input uuid, start_date_input date, end_date_input date)
returns table(
  delivery_id uuid,
  shop_id uuid,
  product_id uuid,
  delivery_date date,
  quantity_base numeric,
  total_amount numeric,
  discount_amount numeric,
  cost numeric,
  costed_share numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select d.id, d.shop_id, d.product_id, d.delivery_date, d.quantity_base, d.total_amount, d.discount_amount,
    coalesce(c.cost, 0),
    case when coalesce(d.quantity_base, 0) > 0 then least(coalesce(c.costed_qty, 0) / d.quantity_base, 1) else 0 end
  from public.stock_deliveries d
  left join (
    select delivery_id,
      sum(quantity * unit_cost) filter (where unit_cost is not null) as cost,
      sum(quantity) filter (where unit_cost is not null) as costed_qty
    from public.delivery_lot_consumptions
    group by delivery_id
  ) c on c.delivery_id = d.id
  where d.business_id = business_id_input
    and d.voided_at is null
    and d.delivery_date between start_date_input and end_date_input;
$$;

revoke execute on function public.delivery_costs(uuid, date, date) from public, anon, authenticated;

-- Today's position: cash, what is owed both ways, and stock at cost.
create or replace function public.get_finance_position(business_id_input uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_money jsonb;
  v_raw numeric;
  v_finished numeric;
  v_uncosted numeric;
begin
  if not public.has_permission(business_id_input, 'view_finances') then
    raise exception 'You do not have permission to view finances' using errcode = '42501';
  end if;

  v_money := public.get_money_position(business_id_input);

  select coalesce(sum(remaining_quantity * unit_cost), 0) into v_raw
  from public.stock_purchases where business_id = business_id_input and remaining_quantity > 0;

  select coalesce(sum(remaining * unit_cost) filter (where unit_cost is not null), 0),
         coalesce(sum(remaining) filter (where unit_cost is null), 0)
  into v_finished, v_uncosted
  from public.product_lots where business_id = business_id_input and remaining > 0;

  return jsonb_build_object(
    'cash_total', (v_money->>'cash_total')::numeric,
    'owed_to_business', (v_money->>'owed_to_business')::numeric,
    'owed_to_suppliers', (v_money->>'owed_to_suppliers')::numeric,
    'raw_stock_value', v_raw,
    'finished_stock_value', v_finished,
    'uncosted_finished_units', v_uncosted,
    'working_capital',
      (v_money->>'cash_total')::numeric + (v_money->>'owed_to_business')::numeric
      + v_raw + v_finished - (v_money->>'owed_to_suppliers')::numeric
  );
end;
$$;

-- Profit and loss for a period, with breakdowns by product, shop and
-- production run. Sales whose cost isn't known are reported separately and
-- left out of profit.
create or replace function public.get_profit_and_loss(business_id_input uuid, start_date_input date, end_date_input date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_totals jsonb;
  v_expenses numeric;
  v_write_offs numeric;
  v_products jsonb;
  v_shops jsonb;
  v_runs jsonb;
begin
  if not public.has_permission(business_id_input, 'view_finances') then
    raise exception 'You do not have permission to view finances' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'sales', coalesce(sum(total_amount), 0),
    'discounts', coalesce(sum(discount_amount), 0),
    'costed_sales', coalesce(sum(total_amount * costed_share), 0),
    'uncosted_sales', coalesce(sum(total_amount * (1 - costed_share)), 0),
    'cost_of_sales', coalesce(sum(cost), 0),
    'delivery_count', count(*)
  )
  into v_totals
  from public.delivery_costs(business_id_input, start_date_input, end_date_input);

  select
    coalesce((select sum(amount) from public.expenses
      where business_id = business_id_input and expense_date between start_date_input and end_date_input), 0)
    + coalesce((select sum(amount) from public.money_movements
      where business_id = business_id_input and kind = 'other_expense'
        and movement_date between start_date_input and end_date_input), 0)
  into v_expenses;

  select coalesce(sum(cost_amount), 0) into v_write_offs
  from public.stock_write_offs
  where business_id = business_id_input and write_off_date between start_date_input and end_date_input;

  select coalesce(jsonb_agg(row_to_json(x) order by x.sales desc), '[]'::jsonb) into v_products
  from (
    select p.id, p.name, p.unit,
      sum(dc.quantity_base) as quantity,
      sum(dc.total_amount) as sales,
      sum(dc.total_amount * dc.costed_share) as costed_sales,
      sum(dc.cost) as cost,
      sum(dc.total_amount * dc.costed_share) - sum(dc.cost) as gross_profit
    from public.delivery_costs(business_id_input, start_date_input, end_date_input) dc
    join public.products p on p.id = dc.product_id
    group by p.id, p.name, p.unit
  ) x;

  select coalesce(jsonb_agg(row_to_json(x) order by x.sales desc), '[]'::jsonb) into v_shops
  from (
    select s.id, s.name,
      sum(dc.total_amount) as sales,
      sum(dc.total_amount * dc.costed_share) as costed_sales,
      sum(dc.total_amount * dc.costed_share) - sum(dc.cost) as gross_profit,
      coalesce((select sb.balance from public.get_shop_balances(business_id_input) sb where sb.shop_id = s.id), 0) as outstanding
    from public.delivery_costs(business_id_input, start_date_input, end_date_input) dc
    join public.shops s on s.id = dc.shop_id
    group by s.id, s.name
    order by sum(dc.total_amount) desc
    limit 50
  ) x;

  -- Production runs made in the period: what was made, what has sold so
  -- far (at any date), and the profit on what sold.
  select coalesce(jsonb_agg(row_to_json(x) order by x.production_date desc), '[]'::jsonb) into v_runs
  from (
    select b.id, b.name, b.production_date, pr.name as product_name, pr.unit,
      l.quantity as made, l.quantity - l.remaining as used, l.unit_cost,
      coalesce(sum(c.quantity), 0) as sold,
      coalesce(sum(d.total_amount * c.quantity / nullif(d.quantity_base, 0)), 0) as sales,
      coalesce(sum(c.quantity * c.unit_cost), 0) as cost,
      coalesce(sum(d.total_amount * c.quantity / nullif(d.quantity_base, 0)), 0) - coalesce(sum(c.quantity * c.unit_cost), 0) as gross_profit
    from public.batches b
    join public.product_lots l on l.batch_id = b.id
    join public.products pr on pr.id = b.product_id
    left join public.delivery_lot_consumptions c on c.lot_id = l.id
    left join public.stock_deliveries d on d.id = c.delivery_id and d.voided_at is null
    where b.business_id = business_id_input and not b.is_deleted
      and b.production_date between start_date_input and end_date_input
    group by b.id, b.name, b.production_date, pr.name, pr.unit, l.quantity, l.remaining, l.unit_cost
  ) x;

  return v_totals || jsonb_build_object(
    'gross_profit', (v_totals->>'costed_sales')::numeric - (v_totals->>'cost_of_sales')::numeric,
    'expenses', v_expenses,
    'write_offs', v_write_offs,
    'net_profit', (v_totals->>'costed_sales')::numeric - (v_totals->>'cost_of_sales')::numeric - v_expenses - v_write_offs,
    'products', v_products,
    'shops', v_shops,
    'production_runs', v_runs
  );
end;
$$;

-- Month by month for the last months_input months (this month included).
create or replace function public.get_finance_trend(business_id_input uuid, months_input integer default 12)
returns table(
  month_start date,
  sales numeric,
  costed_sales numeric,
  cost_of_sales numeric,
  expenses numeric,
  write_offs numeric,
  net_profit numeric,
  cash_at_end numeric,
  owed_to_business_at_end numeric,
  money_in numeric,
  money_out numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_month date;
  v_end date;
begin
  if not public.has_permission(business_id_input, 'view_finances') then
    raise exception 'You do not have permission to view finances' using errcode = '42501';
  end if;

  for v_month in
    select generate_series(
      date_trunc('month', current_date)::date - make_interval(months => greatest(least(coalesce(months_input, 12), 24), 1) - 1),
      date_trunc('month', current_date)::date,
      interval '1 month'
    )::date
  loop
    v_end := least((v_month + interval '1 month' - interval '1 day')::date, current_date);
    month_start := v_month;

    select coalesce(sum(dc.total_amount), 0), coalesce(sum(dc.total_amount * dc.costed_share), 0), coalesce(sum(dc.cost), 0)
    into sales, costed_sales, cost_of_sales
    from public.delivery_costs(business_id_input, v_month, v_end) dc;

    expenses :=
      coalesce((select sum(amount) from public.expenses
        where business_id = business_id_input and expense_date between v_month and v_end), 0)
      + coalesce((select sum(amount) from public.money_movements
        where business_id = business_id_input and kind = 'other_expense' and movement_date between v_month and v_end), 0);

    write_offs := coalesce((select sum(cost_amount) from public.stock_write_offs
      where business_id = business_id_input and write_off_date between v_month and v_end), 0);

    net_profit := costed_sales - cost_of_sales - expenses - write_offs;
    cash_at_end := public.money_balance_on(business_id_input, v_end);

    select coalesce(sum(greatest(bal, 0)), 0) into owed_to_business_at_end
    from (
      select s.id,
        coalesce((select sum(d.total_amount) from public.stock_deliveries d
          where d.shop_id = s.id and d.voided_at is null and d.delivery_date <= v_end), 0)
        - coalesce((select sum(p.amount) from public.payments p
          where p.shop_id = s.id and p.voided_at is null and p.payment_date <= v_end), 0) as bal
      from public.shops s
      where s.business_id = business_id_input and s.deleted_at is null
    ) b;

    select coalesce(sum(l.amount) filter (where l.amount > 0 and l.kind not in ('transfer', 'transfer_in')), 0),
           coalesce(-sum(l.amount) filter (where l.amount < 0 and l.kind not in ('transfer', 'transfer_in')), 0)
    into money_in, money_out
    from public.money_ledger_entries(business_id_input) l
    where l.entry_date between v_month and v_end;

    return next;
  end loop;
end;
$$;

revoke execute on function public.take_from_product_lots(uuid, numeric, uuid) from public, anon, authenticated;
revoke execute on function public.release_delivery_lots(uuid) from public, anon, authenticated;
revoke execute on function public.record_product_purchase(uuid, uuid, numeric, numeric, date, text, uuid, boolean) from public, anon;
revoke execute on function public.delete_product_purchase(uuid, text) from public, anon;
revoke execute on function public.pay_product_purchase(uuid, uuid, date) from public, anon;
revoke execute on function public.write_off_product(uuid, uuid, numeric, text, date) from public, anon;
revoke execute on function public.get_finance_position(uuid) from public, anon;
revoke execute on function public.get_profit_and_loss(uuid, date, date) from public, anon;
revoke execute on function public.get_finance_trend(uuid, integer) from public, anon;
grant execute on function public.record_product_purchase(uuid, uuid, numeric, numeric, date, text, uuid, boolean) to authenticated;
grant execute on function public.delete_product_purchase(uuid, text) to authenticated;
grant execute on function public.pay_product_purchase(uuid, uuid, date) to authenticated;
grant execute on function public.write_off_product(uuid, uuid, numeric, text, date) to authenticated;
grant execute on function public.get_finance_position(uuid) to authenticated;
grant execute on function public.get_profit_and_loss(uuid, date, date) to authenticated;
grant execute on function public.get_finance_trend(uuid, integer) to authenticated;
