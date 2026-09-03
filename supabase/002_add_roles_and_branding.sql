-- LISDMS migration 002: roles, profiles, branding, storage buckets.
-- Run this if you already ran schema.sql once before (it's safe to re-run
-- this file too — everything here is idempotent). If this is a brand-new
-- Supabase project, just run schema.sql alone; it already includes this.

create extension if not exists "uuid-ossp";

do $$ begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type user_role as enum ('admin', 'user');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Profiles & roles
-- ---------------------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  role user_role not null default 'user',
  created_at timestamptz not null default now()
);
alter table profiles enable row level security;

drop policy if exists "Authenticated users can view all profiles" on profiles;
create policy "Authenticated users can view all profiles" on profiles
  for select using (auth.role() = 'authenticated');

drop policy if exists "Users can update their own profile" on profiles;
create policy "Users can update their own profile" on profiles
  for update using (auth.uid() = id);

drop policy if exists "Admins can update any profile" on profiles;
create policy "Admins can update any profile" on profiles
  for update using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'user')
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Backfill a profile row for anyone who signed up before this migration
-- (e.g. the account you're already logged in with).
insert into public.profiles (id, email, role)
select id, email, 'user' from auth.users
on conflict (id) do nothing;

create or replace function public.is_admin()
returns boolean as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$ language sql security definer stable;

-- ---------------------------------------------------------------------------
-- App-wide settings (branding)
-- ---------------------------------------------------------------------------
create table if not exists app_settings (
  id int primary key default 1,
  org_name text not null default 'LISDMS',
  logo_url text,
  updated_at timestamptz not null default now(),
  constraint app_settings_singleton check (id = 1)
);
insert into app_settings (id) values (1) on conflict (id) do nothing;
alter table app_settings enable row level security;

drop policy if exists "Authenticated users can read settings" on app_settings;
drop policy if exists "Anyone can read settings" on app_settings;
create policy "Anyone can read settings" on app_settings
  for select using (true);

drop policy if exists "Admins can update settings" on app_settings;
create policy "Admins can update settings" on app_settings
  for update using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Replace "everyone can write" policies with admin-only writes.
-- Safe to run even if these tables/policies don't exist yet.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['lgus', 'concerns', 'schedules', 'requirements', 'documents'] loop
    if exists (select 1 from information_schema.tables where table_name = t and table_schema = 'public') then
      execute format('drop policy if exists "Authenticated read/write" on %I', t);
      execute format('drop policy if exists "Authenticated read" on %I', t);
      execute format('drop policy if exists "Admin write" on %I', t);
      execute format('drop policy if exists "Admin update" on %I', t);
      execute format('drop policy if exists "Admin delete" on %I', t);

      execute format('create policy "Authenticated read" on %I for select using (auth.role() = ''authenticated'')', t);
      execute format('create policy "Admin write" on %I for insert with check (public.is_admin())', t);
      execute format('create policy "Admin update" on %I for update using (public.is_admin())', t);
      execute format('create policy "Admin delete" on %I for delete using (public.is_admin())', t);
    end if;
  end loop;
end $$;

drop policy if exists "Authenticated read/write" on audit_logs;
drop policy if exists "Admin read" on audit_logs;
drop policy if exists "Authenticated insert" on audit_logs;
create policy "Admin read" on audit_logs for select using (public.is_admin());
create policy "Authenticated insert" on audit_logs for insert with check (auth.role() = 'authenticated');

-- ---------------------------------------------------------------------------
-- Storage buckets: avatars (per-user) and branding (logo, admin-only)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('branding', 'branding', true)
on conflict (id) do nothing;

drop policy if exists "Avatar images are publicly readable" on storage.objects;
create policy "Avatar images are publicly readable" on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists "Users can upload their own avatar" on storage.objects;
create policy "Users can upload their own avatar" on storage.objects
  for insert with check (
    bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users can update their own avatar" on storage.objects;
create policy "Users can update their own avatar" on storage.objects
  for update using (
    bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Branding images are publicly readable" on storage.objects;
create policy "Branding images are publicly readable" on storage.objects
  for select using (bucket_id = 'branding');

drop policy if exists "Admins can upload branding assets" on storage.objects;
create policy "Admins can upload branding assets" on storage.objects
  for insert with check (bucket_id = 'branding' and public.is_admin());

drop policy if exists "Admins can update branding assets" on storage.objects;
create policy "Admins can update branding assets" on storage.objects
  for update using (bucket_id = 'branding' and public.is_admin());

-- ---------------------------------------------------------------------------
-- Finally, promote your own account to admin (edit the email below):
--
--   update profiles set role = 'admin' where email = 'you@yourdomain.gov.ph';
-- ---------------------------------------------------------------------------
