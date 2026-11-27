-- Command Center accounts on Supabase.
-- Apply with the database owner (SQL editor or psql). The browser only has the publishable key.
-- This does not drop or rewrite existing tables.

create table if not exists public.command_center_layouts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  layout jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.command_center_layouts enable row level security;

revoke all on table public.command_center_layouts from public, anon;
grant select, insert, update on table public.command_center_layouts to authenticated;

drop policy if exists "owner reads own layout" on public.command_center_layouts;
create policy "owner reads own layout"
  on public.command_center_layouts
  for select
  to authenticated
  using (
    (select auth.uid()) = user_id
    and lower((select auth.jwt() ->> 'email')) = 'caseylsims@gmail.com'
  );

drop policy if exists "owner inserts own layout" on public.command_center_layouts;
create policy "owner inserts own layout"
  on public.command_center_layouts
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and lower((select auth.jwt() ->> 'email')) = 'caseylsims@gmail.com'
  );

drop policy if exists "owner updates own layout" on public.command_center_layouts;
create policy "owner updates own layout"
  on public.command_center_layouts
  for update
  to authenticated
  using (
    (select auth.uid()) = user_id
    and lower((select auth.jwt() ->> 'email')) = 'caseylsims@gmail.com'
  )
  with check (
    (select auth.uid()) = user_id
    and lower((select auth.jwt() ->> 'email')) = 'caseylsims@gmail.com'
  );

-- Reject new Auth users that are not the owner. Kept out of public so it is not a Data API endpoint.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.enforce_command_center_signup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if lower(coalesce(new.email, '')) <> 'caseylsims@gmail.com' then
    raise exception 'Sign-up is limited to the owner email.';
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_command_center_signup() from public, anon, authenticated;

drop trigger if exists command_center_signup_allowlist on auth.users;
create trigger command_center_signup_allowlist
  before insert on auth.users
  for each row
  execute function private.enforce_command_center_signup();
