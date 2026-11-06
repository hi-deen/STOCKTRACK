-- Only the owner can edit or delete an expense, with a reason that goes to
-- the activity log. 202608300007 let any member update/delete expenses
-- directly; those grants are withdrawn so the two RPCs below are the only
-- way. Recording (insert) stays open to every member.

revoke update, delete on public.expenses from authenticated, anon;

create or replace function public.edit_expense(
  expense_id_input uuid,
  category_id_input uuid,
  amount_input numeric,
  expense_date_input date,
  note_input text,
  reason_input text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
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

  if not public.is_business_owner(v_row.business_id) then
    raise exception 'Only the owner can edit an expense' using errcode = '42501';
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
$$;

create or replace function public.delete_expense(
  expense_id_input uuid,
  reason_input text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
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

  if not public.is_business_owner(v_row.business_id) then
    raise exception 'Only the owner can delete an expense' using errcode = '42501';
  end if;

  delete from public.expenses where id = v_row.id;

  perform public.log_audit_event(
    v_row.business_id, 'expense.deleted', 'expense', v_row.id,
    (select name from public.expense_categories where id = v_row.category_id),
    jsonb_build_object('reason', reason_input, 'record', to_jsonb(v_row))
  );
end;
$$;

revoke execute on function public.edit_expense(uuid, uuid, numeric, date, text, text) from public, anon;
revoke execute on function public.delete_expense(uuid, text) from public, anon;
grant execute on function public.edit_expense(uuid, uuid, numeric, date, text, text) to authenticated;
grant execute on function public.delete_expense(uuid, text) to authenticated;
