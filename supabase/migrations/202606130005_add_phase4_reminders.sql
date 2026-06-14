create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  shop_id uuid references public.shops(id) on delete cascade,
  type text not null check (type in ('payment','restock','custom')),
  title text not null,
  message text not null,
  due_date date not null,
  status text not null default 'pending' check (status in ('pending','done','dismissed')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.business_settings (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  payment_reminder_days integer not null default 14,
  restock_reminder_days integer not null default 7,
  business_display_name text
);

alter table public.reminders enable row level security;
alter table public.business_settings enable row level security;

create policy "Reminders scoped to business membership"
  on public.reminders
  for all
  using (business_id in (select * from public.get_user_business_ids()))
  with check (business_id in (select * from public.get_user_business_ids()));

create policy "Business settings scoped to business membership"
  on public.business_settings
  for all
  using (business_id in (select * from public.get_user_business_ids()))
  with check (business_id in (select * from public.get_user_business_ids()));

grant select, insert, update, delete on public.reminders to authenticated;
grant select, insert, update, delete on public.business_settings to authenticated;

drop function if exists public.get_reminder_suggestions(uuid);
create or replace function public.get_reminder_suggestions(business_id_input uuid)
returns table (
  shop_id uuid,
  shop_name text,
  shop_phone text,
  type text,
  reason text,
  suggested_message text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment_days integer;
  v_restock_days integer;
  v_business_name text;
begin
  if not public.is_business_member(business_id_input) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select coalesce(bs.payment_reminder_days, 14),
         coalesce(bs.restock_reminder_days, 7),
         coalesce(bs.business_display_name, b.name)
  into v_payment_days, v_restock_days, v_business_name
  from public.businesses b
  left join public.business_settings bs on bs.business_id = b.id
  where b.id = business_id_input;

  return query
  with shop_activity as (
    select
      s.id as shop_id,
      s.name as shop_name,
      s.phone as shop_phone,
      s.created_at::date as created_date,
      (select max(p.payment_date) from public.payments p where p.shop_id = s.id) as last_payment_date,
      (select max(sd.delivery_date) from public.stock_deliveries sd where sd.shop_id = s.id) as last_delivery_date,
      (select count(*) from public.stock_deliveries sd where sd.shop_id = s.id) as delivery_count
    from public.shops s
    where s.business_id = business_id_input
  ),
  payment_candidates as (
    select
      sa.shop_id,
      sa.shop_name,
      sa.shop_phone,
      'payment'::text as type,
      format(
        'Balance of ₦%s outstanding for %s days',
        to_char(public.get_shop_balance(sa.shop_id), 'FM999,999,999,999.00'),
        (current_date - coalesce(sa.last_payment_date, sa.last_delivery_date))::int
      ) as reason,
      format(
        'Hello %s, this is a friendly reminder that you have an outstanding balance of ₦%s with %s. Kindly arrange payment at your earliest convenience. Thank you.',
        sa.shop_name,
        to_char(public.get_shop_balance(sa.shop_id), 'FM999,999,999,999.00'),
        v_business_name
      ) as suggested_message
    from shop_activity sa
    where public.get_shop_balance(sa.shop_id) > 0
      and coalesce(sa.last_payment_date, sa.last_delivery_date) is not null
      and current_date - coalesce(sa.last_payment_date, sa.last_delivery_date) > v_payment_days
      and not exists (
        select 1
        from public.reminders r
        where r.business_id = business_id_input
          and r.shop_id = sa.shop_id
          and r.type = 'payment'
          and r.status = 'pending'
          and r.created_at >= now() - interval '3 days'
      )
  ),
  restock_candidates as (
    select
      sa.shop_id,
      sa.shop_name,
      sa.shop_phone,
      'restock'::text as type,
      case
        when sa.delivery_count = 0 then format('No delivery in %s days', (current_date - sa.created_date)::int)
        else format('No delivery in %s days', (current_date - sa.last_delivery_date)::int)
      end as reason,
      format(
        'Hello %s, it''s been a while since your last restock with %s. Let us know if you''d like to place a new order. Thank you.',
        sa.shop_name,
        v_business_name
      ) as suggested_message
    from shop_activity sa
    where (
      (sa.delivery_count = 0 and current_date - sa.created_date > v_restock_days)
      or (sa.delivery_count > 0 and sa.last_delivery_date is not null and current_date - sa.last_delivery_date > v_restock_days)
    )
      and not exists (
        select 1
        from public.reminders r
        where r.business_id = business_id_input
          and r.shop_id = sa.shop_id
          and r.type = 'restock'
          and r.status = 'pending'
          and r.created_at >= now() - interval '3 days'
      )
  )
  select * from payment_candidates
  union all
  select * from restock_candidates;
end;
$$;

grant execute on function public.get_reminder_suggestions(uuid) to authenticated;
