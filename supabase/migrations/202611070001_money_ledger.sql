-- Money ledger, phase 1 of the finance work: the app knows how much money
-- the business holds (its liquid capital) and where it sits.
--
-- - money_accounts: Cash and Bank for every business, each with an opening
--   balance as of an opening date. Only money moving on or after that date
--   counts, so the owner enters today's real balances and history before
--   then is left alone.
-- - Balances are computed from the records themselves, never stored:
--   payments add (account chosen from the payment method), purchases and
--   expenses subtract (from the account they were paid from), and
--   money_movements cover everything else (owner capital, withdrawals,
--   loans, other income, transfers, cash-count adjustments). Editing,
--   voiding or deleting a record therefore corrects balances by itself.
-- - Purchases can be bought on credit (account_id null) and marked paid
--   later; unpaid purchases are what the business owes suppliers.
-- - Two new permissions: view_finances and manage_money. Admins get both by
--   default; staff and observers get neither.

-- ============================================================
-- 1. Permissions
-- ============================================================

alter table public.business_role_permissions drop constraint business_role_permissions_permission_check;
alter table public.business_role_permissions add constraint business_role_permissions_permission_check
  check (permission in (
    'record_sales', 'correct_sales', 'delete_sales', 'record_stock', 'manage_stock_records',
    'manage_catalog', 'manage_shops', 'remove_shops', 'manage_riders', 'manage_settings',
    'view_finances', 'manage_money'
  ));

create or replace function public.seed_role_permissions(business_id_input uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.business_role_permissions (business_id, role, permission)
  select business_id_input, d.role, d.permission
  from (values
    ('admin', 'record_sales'), ('admin', 'correct_sales'), ('admin', 'delete_sales'),
    ('admin', 'record_stock'), ('admin', 'manage_stock_records'), ('admin', 'manage_catalog'),
    ('admin', 'manage_shops'), ('admin', 'remove_shops'), ('admin', 'manage_riders'),
    ('admin', 'manage_settings'), ('admin', 'view_finances'), ('admin', 'manage_money'),
    ('staff', 'record_sales'), ('staff', 'correct_sales'), ('staff', 'record_stock'),
    ('staff', 'manage_catalog'), ('staff', 'manage_shops')
  ) as d(role, permission)
  on conflict do nothing;
$$;

-- Existing businesses: give admins the two new permissions only, so any
-- switches the owner already changed stay as they are.
insert into public.business_role_permissions (business_id, role, permission)
select b.id, 'admin', p
from public.businesses b, unnest(array['view_finances', 'manage_money']) as p
on conflict do nothing;

create or replace function public.get_my_permissions(business_id_input uuid)
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select case
    when bm.role = 'owner' then array[
      'record_sales', 'correct_sales', 'delete_sales', 'record_stock', 'manage_stock_records',
      'manage_catalog', 'manage_shops', 'remove_shops', 'manage_riders', 'manage_settings',
      'view_finances', 'manage_money'
    ]::text[]
    else coalesce((
      select array_agg(rp.permission order by rp.permission)
      from public.business_role_permissions rp
      where rp.business_id = bm.business_id and rp.role = bm.role
    ), '{}'::text[])
  end
  from public.business_members bm
  where bm.business_id = business_id_input and bm.user_id = auth.uid();
$$;

-- ============================================================
-- 2. Money accounts
-- ============================================================

create table if not exists public.money_accounts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('cash', 'bank')),
  opening_balance numeric not null default 0,
  opening_date date not null default current_date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (business_id, name)
);

create index if not exists money_accounts_business_id_idx on public.money_accounts (business_id);

alter table public.money_accounts enable row level security;

-- Every member sees the account names (purchase and expense forms offer
-- them); balances come only from get_money_position(), which needs
-- view_finances.
create policy "Money accounts are viewable by business members" on public.money_accounts
  for select using (business_id in (select public.get_user_business_ids()));
create policy "Money accounts can be added with permission" on public.money_accounts
  for insert with check (public.has_permission(business_id, 'manage_money'));
create policy "Money accounts can be changed with permission" on public.money_accounts
  for update using (public.has_permission(business_id, 'manage_money'))
  with check (public.has_permission(business_id, 'manage_money'));

grant select, insert, update on public.money_accounts to authenticated;

create or replace function public.seed_money_accounts(business_id_input uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.money_accounts (business_id, name, kind)
  values (business_id_input, 'Cash', 'cash'), (business_id_input, 'Bank', 'bank')
  on conflict (business_id, name) do nothing;
$$;

create or replace function public.seed_money_accounts_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.seed_money_accounts(new.id);
  return new;
end;
$$;

drop trigger if exists businesses_seed_money_accounts on public.businesses;
create trigger businesses_seed_money_accounts
after insert on public.businesses
for each row
execute function public.seed_money_accounts_trigger();

select public.seed_money_accounts(id) from public.businesses;

-- The business's default account of a kind (Cash or Bank).
create or replace function public.default_money_account(business_id_input uuid, kind_input text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.money_accounts
  where business_id = business_id_input and kind = kind_input and is_active
  order by created_at
  limit 1;
$$;

-- Transfers and POS land in the bank; everything else (cash, other, blank,
-- and the old free-text values) counts as cash.
create or replace function public.payment_method_account_kind(method_input text)
returns text
language sql
immutable
as $$
  select case
    when lower(trim(coalesce(method_input, ''))) in ('transfer', 'trasfer', 'bank', 'bank transfer', 'pos')
      then 'bank'
    else 'cash'
  end;
$$;

-- ============================================================
-- 3. Which account each record moves money in or out of
-- ============================================================

alter table public.payments add column if not exists account_id uuid references public.money_accounts(id);
alter table public.expenses add column if not exists account_id uuid references public.money_accounts(id);
alter table public.stock_purchases add column if not exists account_id uuid references public.money_accounts(id);
alter table public.stock_purchases add column if not exists on_credit boolean not null default false;
alter table public.stock_purchases add column if not exists paid_date date;

create index if not exists payments_account_id_idx on public.payments (account_id);
create index if not exists expenses_account_id_idx on public.expenses (account_id);
create index if not exists stock_purchases_account_id_idx on public.stock_purchases (account_id);

-- Payments: the account follows the method, so riders, offline sync and
-- older app versions need no change.
create or replace function public.set_payment_account()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or new.method is distinct from old.method then
    new.account_id := public.default_money_account(new.business_id, public.payment_method_account_kind(new.method));
  end if;
  return new;
end;
$$;

drop trigger if exists payments_set_account on public.payments;
create trigger payments_set_account
before insert or update on public.payments
for each row
execute function public.set_payment_account();

-- Expenses default to cash when the form doesn't say (older app versions).
create or replace function public.set_expense_account()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.account_id is null then
    new.account_id := public.default_money_account(new.business_id, 'cash');
  elsif not exists (
    select 1 from public.money_accounts where id = new.account_id and business_id = new.business_id
  ) then
    raise exception 'Invalid money account';
  end if;
  return new;
end;
$$;

drop trigger if exists expenses_set_account on public.expenses;
create trigger expenses_set_account
before insert on public.expenses
for each row
execute function public.set_expense_account();

-- Purchases: paid now (from the chosen account, cash if none) unless the
-- form marks it on credit.
create or replace function public.set_purchase_account()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.on_credit then
    new.account_id := null;
    new.paid_date := null;
  else
    if new.account_id is null then
      new.account_id := public.default_money_account(new.business_id, 'cash');
    elsif not exists (
      select 1 from public.money_accounts where id = new.account_id and business_id = new.business_id
    ) then
      raise exception 'Invalid money account';
    end if;
    new.paid_date := coalesce(new.paid_date, new.purchase_date);
  end if;
  return new;
end;
$$;

drop trigger if exists stock_purchases_set_account on public.stock_purchases;
create trigger stock_purchases_set_account
before insert on public.stock_purchases
for each row
execute function public.set_purchase_account();

-- Backfill existing records. Their dates fall before each account's
-- opening date, so they don't change any balance.
update public.payments p
set account_id = public.default_money_account(p.business_id, public.payment_method_account_kind(p.method))
where p.account_id is null;

update public.expenses e
set account_id = public.default_money_account(e.business_id, 'cash')
where e.account_id is null;

update public.stock_purchases sp
set account_id = public.default_money_account(sp.business_id, 'cash'),
    paid_date = sp.purchase_date
where sp.account_id is null and not sp.on_credit;

-- Paying for a purchase that was bought on credit.
create or replace function public.pay_stock_purchase(
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
  v_row public.stock_purchases%rowtype;
begin
  select * into v_row from public.stock_purchases where id = purchase_id_input for update;
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
  if not exists (
    select 1 from public.money_accounts where id = account_id_input and business_id = v_row.business_id
  ) then
    raise exception 'Invalid money account';
  end if;

  update public.stock_purchases
  set account_id = account_id_input, paid_date = paid_date_input
  where id = v_row.id;

  perform public.log_audit_event(
    v_row.business_id, 'stock_purchase.paid', 'stock_purchase', v_row.id,
    (select name from public.stock_items where id = v_row.stock_item_id),
    jsonb_build_object('amount', v_row.total_cost, 'account_id', account_id_input, 'paid_date', paid_date_input)
  );
end;
$$;

-- ============================================================
-- 4. Other money movements
-- ============================================================

create table if not exists public.money_movements (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  kind text not null check (kind in (
    'capital_in', 'withdrawal', 'loan_in', 'loan_repayment', 'other_income', 'other_expense',
    'transfer', 'adjustment'
  )),
  account_id uuid not null references public.money_accounts(id),
  to_account_id uuid references public.money_accounts(id),
  -- Positive, except adjustments, which carry their sign (+ found, - missing).
  amount numeric not null,
  movement_date date not null default current_date,
  note text,
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint money_movements_amount_check check (
    (kind = 'adjustment' and amount <> 0) or (kind <> 'adjustment' and amount > 0)
  ),
  constraint money_movements_transfer_check check (
    (kind = 'transfer' and to_account_id is not null and to_account_id <> account_id)
    or (kind <> 'transfer' and to_account_id is null)
  )
);

create index if not exists money_movements_business_date_idx
  on public.money_movements (business_id, movement_date desc);

alter table public.money_movements enable row level security;

create policy "Money movements are viewable with permission" on public.money_movements
  for select using (public.has_permission(business_id, 'view_finances'));
create policy "Money movements can be added with permission" on public.money_movements
  for insert with check (
    public.has_permission(business_id, 'manage_money')
    and exists (select 1 from public.money_accounts a where a.id = account_id and a.business_id = money_movements.business_id)
    and (to_account_id is null or exists (
      select 1 from public.money_accounts a where a.id = to_account_id and a.business_id = money_movements.business_id
    ))
  );
create policy "Money movements can be deleted with permission" on public.money_movements
  for delete using (public.has_permission(business_id, 'manage_money'));

grant select, insert, delete on public.money_movements to authenticated;

create or replace function public.audit_log_money_movements_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_audit_event(
      new.business_id, 'money.recorded', 'money_movement', new.id, new.kind,
      jsonb_build_object('amount', new.amount, 'account_id', new.account_id, 'to_account_id', new.to_account_id, 'note', new.note)
    );
    return new;
  end if;
  perform public.log_audit_event(
    old.business_id, 'money.deleted', 'money_movement', old.id, old.kind,
    jsonb_build_object('record', to_jsonb(old))
  );
  return old;
end;
$$;

drop trigger if exists money_movements_audit_log on public.money_movements;
create trigger money_movements_audit_log
after insert or delete on public.money_movements
for each row
execute function public.audit_log_money_movements_trigger();

-- Opening balance changes are logged too.
create or replace function public.audit_log_money_accounts_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.opening_balance is distinct from new.opening_balance or old.opening_date is distinct from new.opening_date then
    perform public.log_audit_event(
      new.business_id, 'money.opening_balance_set', 'money_account', new.id, new.name,
      jsonb_build_object(
        'previous', jsonb_build_object('opening_balance', old.opening_balance, 'opening_date', old.opening_date),
        'new', jsonb_build_object('opening_balance', new.opening_balance, 'opening_date', new.opening_date)
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists money_accounts_audit_log on public.money_accounts;
create trigger money_accounts_audit_log
after update on public.money_accounts
for each row
execute function public.audit_log_money_accounts_trigger();

-- ============================================================
-- 5. One list of every money movement
-- ============================================================

-- Signed entries per account: + money in, - money out. Transfers appear
-- twice (out of one account, into the other).
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

-- Today's position: each account's balance, plus what shops owe the
-- business and what it owes suppliers.
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
    'owed_to_suppliers', (
      select coalesce(sum(total_cost), 0) from public.stock_purchases
      where business_id = business_id_input and account_id is null
    ),
    'unpaid_purchase_count', (
      select count(*) from public.stock_purchases
      where business_id = business_id_input and account_id is null
    )
  );
end;
$$;

-- Money in and out over a period, by type.
create or replace function public.get_money_summary(business_id_input uuid, start_date_input date, end_date_input date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not public.has_permission(business_id_input, 'view_finances') then
    raise exception 'You do not have permission to view finances' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'shop_payments', coalesce(sum(amount) filter (where kind = 'payment'), 0),
    'capital_in', coalesce(sum(amount) filter (where kind = 'capital_in'), 0),
    'loans_in', coalesce(sum(amount) filter (where kind = 'loan_in'), 0),
    'other_income', coalesce(sum(amount) filter (where kind = 'other_income'), 0),
    'purchases', coalesce(-sum(amount) filter (where kind = 'purchase'), 0),
    'expenses', coalesce(-sum(amount) filter (where kind in ('expense', 'other_expense')), 0),
    'withdrawals', coalesce(-sum(amount) filter (where kind = 'withdrawal'), 0),
    'loan_repayments', coalesce(-sum(amount) filter (where kind = 'loan_repayment'), 0),
    'adjustments', coalesce(sum(amount) filter (where kind = 'adjustment'), 0),
    'money_in', coalesce(sum(amount) filter (where amount > 0 and kind not in ('transfer', 'transfer_in')), 0),
    'money_out', coalesce(-sum(amount) filter (where amount < 0 and kind not in ('transfer', 'transfer_in')), 0),
    'net_change', coalesce(sum(amount) filter (where kind not in ('transfer', 'transfer_in')), 0)
  )
  into v_result
  from public.money_ledger_entries(business_id_input)
  where entry_date between start_date_input and end_date_input;

  return v_result;
end;
$$;

-- The entries themselves, newest first, for the Money screen.
create or replace function public.get_money_ledger(
  business_id_input uuid,
  start_date_input date,
  end_date_input date,
  limit_input integer default 200
)
returns table(
  entry_date date,
  account_id uuid,
  account_name text,
  amount numeric,
  kind text,
  description text,
  reference_id uuid
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.has_permission(business_id_input, 'view_finances') then
    raise exception 'You do not have permission to view finances' using errcode = '42501';
  end if;

  return query
  select l.entry_date, l.account_id, a.name, l.amount, l.kind, l.description, l.reference_id
  from public.money_ledger_entries(business_id_input) l
  join public.money_accounts a on a.id = l.account_id
  where l.entry_date between start_date_input and end_date_input
  order by l.entry_date desc, l.created_at desc
  limit least(greatest(coalesce(limit_input, 200), 1), 1000);
end;
$$;

revoke execute on function public.seed_money_accounts(uuid) from public, anon, authenticated;
revoke execute on function public.default_money_account(uuid, text) from public, anon, authenticated;
revoke execute on function public.pay_stock_purchase(uuid, uuid, date) from public, anon;
revoke execute on function public.get_money_position(uuid) from public, anon;
revoke execute on function public.get_money_summary(uuid, date, date) from public, anon;
revoke execute on function public.get_money_ledger(uuid, date, date, integer) from public, anon;
grant execute on function public.pay_stock_purchase(uuid, uuid, date) to authenticated;
grant execute on function public.get_money_position(uuid) to authenticated;
grant execute on function public.get_money_summary(uuid, date, date) to authenticated;
grant execute on function public.get_money_ledger(uuid, date, date, integer) to authenticated;
