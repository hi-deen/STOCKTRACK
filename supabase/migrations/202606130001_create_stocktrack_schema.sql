create extension if not exists pgcrypto;

create table if not exists businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists business_members (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'staff')),
  joined_at timestamptz not null default now(),
  unique (business_id, user_id)
);

create table if not exists invite_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  business_id uuid references businesses(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  used_by uuid references auth.users(id) on delete set null,
  used_at timestamptz,
  status text not null default 'active' check (status in ('active', 'used', 'expired')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table businesses enable row level security;
alter table business_members enable row level security;
alter table invite_codes enable row level security;

create policy "Businesses are viewable by members" on businesses
  for select using (
    exists (
      select 1 from business_members bm
      where bm.business_id = businesses.id and bm.user_id = auth.uid()
    )
  );

create policy "Businesses can be created by authenticated users" on businesses
  for insert with check (auth.role() = 'authenticated');

create policy "Businesses can be updated by owners" on businesses
  for update using (
    exists (
      select 1 from business_members bm
      where bm.business_id = businesses.id and bm.user_id = auth.uid() and bm.role = 'owner'
    )
  );

create policy "Businesses can be deleted by owners" on businesses
  for delete using (
    exists (
      select 1 from business_members bm
      where bm.business_id = businesses.id and bm.user_id = auth.uid() and bm.role = 'owner'
    )
  );

create policy "Members are viewable by the user or by a business member" on business_members
  for select using (
    user_id = auth.uid() or exists (
      select 1 from business_members bm
      where bm.business_id = business_members.business_id and bm.user_id = auth.uid()
    )
  );

create policy "Members can be inserted by the creator" on business_members
  for insert with check (
    auth.uid() = user_id and role = 'owner'
  );

create policy "Invite codes are viewable by owners" on invite_codes
  for select using (
    exists (
      select 1 from business_members bm
      where bm.business_id = invite_codes.business_id and bm.user_id = auth.uid() and bm.role = 'owner'
    )
  );

create policy "Invite codes can be created by owners" on invite_codes
  for insert with check (
    exists (
      select 1 from business_members bm
      where bm.business_id = invite_codes.business_id and bm.user_id = auth.uid() and bm.role = 'owner'
    )
  );

create or replace function create_business(business_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_business_id uuid;
begin
  insert into businesses (name, owner_id)
  values (business_name, auth.uid())
  returning id into new_business_id;

  insert into business_members (business_id, user_id, role)
  values (new_business_id, auth.uid(), 'owner');

  return new_business_id;
end;
$$;

create or replace function generate_invite_code(business_id_input uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  generated_code text;
begin
  if not exists (
    select 1 from business_members
    where business_id = business_id_input and user_id = auth.uid() and role = 'owner'
  ) then
    raise exception 'Only owners can generate invite codes';
  end if;

  generated_code := upper(substr(md5(random()::text), 1, 8));

  while exists (select 1 from invite_codes where code = generated_code) loop
    generated_code := upper(substr(md5(random()::text), 1, 8));
  end loop;

  insert into invite_codes (code, business_id, created_by, status, expires_at)
  values (
    generated_code,
    business_id_input,
    auth.uid(),
    'active',
    now() + interval '7 days'
  );

  return generated_code;
end;
$$;

create or replace function redeem_invite_code(code_input text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  invite_row invite_codes%rowtype;
begin
  select * into invite_row
  from invite_codes
  where code = code_input and status = 'active' and expires_at > now()
  limit 1;

  if not found then
    raise exception 'Invalid or expired code';
  end if;

  if exists (
    select 1 from business_members
    where business_id = invite_row.business_id and user_id = auth.uid()
  ) then
    raise exception 'Already a member';
  end if;

  insert into business_members (business_id, user_id, role)
  values (invite_row.business_id, auth.uid(), 'staff');

  update invite_codes
  set status = 'used', used_by = auth.uid(), used_at = now()
  where id = invite_row.id;

  return invite_row.business_id;
end;
$$;
