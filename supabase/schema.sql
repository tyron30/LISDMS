-- LISDMS core schema
-- Run this in the Supabase SQL editor (or via `supabase db push`).

create extension if not exists "uuid-ossp";

create type lgu_status as enum (
  'deployed', 'for_deployment', 'no_update', 'partial_update'
);
create type concern_status as enum ('open', 'in_progress', 'resolved');
create type concern_severity as enum ('low', 'medium', 'high', 'critical');
create type requirement_status as enum ('pending', 'submitted', 'waived');
create type schedule_type as enum ('orientation', 'network_installation', 'feedbacking', 'critical_visit');
create type user_role as enum ('admin', 'user');
create type device_status as enum ('online', 'offline', 'maintenance');
create type device_type as enum ('router', 'switch', 'access_point', 'modem', 'printer', 'other');

-- ---------------------------------------------------------------------------
-- Profiles & roles
-- ---------------------------------------------------------------------------
-- One row per auth.users row. New signups get role='user' by default —
-- promote your first account to 'admin' manually (see bottom of this file).
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  role user_role not null default 'user',
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "Authenticated users can view all profiles" on profiles
  for select using (auth.role() = 'authenticated');

create policy "Users can update their own profile" on profiles
  for update using (auth.uid() = id);

create policy "Admins can update any profile" on profiles
  for update using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- Auto-create a profile row whenever someone signs up.
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'user');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Small helper so policies below stay readable.
create function public.is_admin()
returns boolean as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$ language sql security definer stable;

-- ---------------------------------------------------------------------------
-- App-wide settings (branding)
-- ---------------------------------------------------------------------------
create table app_settings (
  id int primary key default 1,
  org_name text not null default 'LISDMS',
  logo_url text,
  updated_at timestamptz not null default now(),
  constraint app_settings_singleton check (id = 1)
);
insert into app_settings (id) values (1) on conflict (id) do nothing;

alter table app_settings enable row level security;

create policy "Anyone can read settings" on app_settings
  for select using (true);

create policy "Admins can update settings" on app_settings
  for update using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Core operational tables
-- ---------------------------------------------------------------------------
-- ---------------------------------------------------------------------------
-- Assigned persons: the small, admin-managed list of staff an LGU can be
-- assigned to (e.g. "Charles", "Rafa", "Rhea"). A separate table rather
-- than a free-text field so renaming someone updates everywhere at once,
-- and so the dropdown in the LGU form always reflects who's actually on
-- the list right now.
-- ---------------------------------------------------------------------------
create table assigned_persons (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  created_at timestamptz not null default now()
);

alter table assigned_persons enable row level security;

create policy "Authenticated read" on assigned_persons for select using (auth.role() = 'authenticated');
create policy "Admin write" on assigned_persons for insert with check (public.is_admin());
create policy "Admin update" on assigned_persons for update using (public.is_admin());
create policy "Admin delete" on assigned_persons for delete using (public.is_admin());

insert into assigned_persons (name) values ('Charles'), ('Rafa'), ('Rhea')
on conflict (name) do nothing;

create table lgus (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  province text not null,
  district text,
  status lgu_status not null default 'for_deployment',
  system text,
  app_version text,
  network_setup text,
  date_deployed date,
  focal_person text,
  contact_number text,
  email text,
  anydesk_id text,
  anydesk_password text,
  assigned_person_id uuid references assigned_persons(id) on delete set null,
  created_at timestamptz not null default now()
);

create table concerns (
  id uuid primary key default uuid_generate_v4(),
  lgu_id uuid references lgus(id) on delete cascade,
  title text not null,
  category text,
  status concern_status not null default 'open',
  severity concern_severity not null default 'medium',
  created_at timestamptz not null default now()
);

create table schedules (
  id uuid primary key default uuid_generate_v4(),
  lgu_id uuid references lgus(id) on delete cascade,
  title text not null,
  type schedule_type not null,
  date date not null,
  time time not null,
  created_at timestamptz not null default now()
);

create table requirements (
  id uuid primary key default uuid_generate_v4(),
  lgu_id uuid references lgus(id) on delete cascade,
  name text not null,
  status requirement_status not null default 'pending',
  due_date date,
  created_at timestamptz not null default now()
);

create table documents (
  id uuid primary key default uuid_generate_v4(),
  lgu_id uuid references lgus(id) on delete cascade,
  file_name text not null,
  file_url text not null,
  uploaded_at timestamptz not null default now()
);

create table network_devices (
  id uuid primary key default uuid_generate_v4(),
  lgu_id uuid references lgus(id) on delete cascade,
  device_name text not null,
  device_type device_type not null default 'other',
  ip_address text,
  mac_address text,
  status device_status not null default 'online',
  notes text,
  last_seen timestamptz,
  created_at timestamptz not null default now()
);

create table audit_logs (
  id uuid primary key default uuid_generate_v4(),
  actor text,
  action text not null,
  target text,
  created_at timestamptz not null default now()
);

-- Convenience view used by the dashboard's LGU status overview.
create view lgu_open_concerns as
  select lgu_id, count(*) as open_concerns
  from concerns
  where status <> 'resolved'
  group by lgu_id;

-- ---------------------------------------------------------------------------
-- Row Level Security: everyone signed in can READ; only admins can WRITE.
-- This is the actual access-control boundary — the app's UI also hides
-- create/edit buttons from non-admins, but that's just UX, not security.
-- ---------------------------------------------------------------------------
alter table lgus enable row level security;
alter table concerns enable row level security;
alter table schedules enable row level security;
alter table requirements enable row level security;
alter table documents enable row level security;
alter table audit_logs enable row level security;
alter table network_devices enable row level security;

create policy "Authenticated read" on lgus for select using (auth.role() = 'authenticated');
create policy "Admin write" on lgus for insert with check (public.is_admin());
create policy "Admin update" on lgus for update using (public.is_admin());
create policy "Admin delete" on lgus for delete using (public.is_admin());

create policy "Authenticated read" on concerns for select using (auth.role() = 'authenticated');
create policy "Admin write" on concerns for insert with check (public.is_admin());
create policy "Admin update" on concerns for update using (public.is_admin());
create policy "Admin delete" on concerns for delete using (public.is_admin());

create policy "Authenticated read" on schedules for select using (auth.role() = 'authenticated');
create policy "Admin write" on schedules for insert with check (public.is_admin());
create policy "Admin update" on schedules for update using (public.is_admin());
create policy "Admin delete" on schedules for delete using (public.is_admin());

create policy "Authenticated read" on requirements for select using (auth.role() = 'authenticated');
create policy "Admin write" on requirements for insert with check (public.is_admin());
create policy "Admin update" on requirements for update using (public.is_admin());
create policy "Admin delete" on requirements for delete using (public.is_admin());

create policy "Authenticated read" on documents for select using (auth.role() = 'authenticated');
create policy "Admin write" on documents for insert with check (public.is_admin());
create policy "Admin delete" on documents for delete using (public.is_admin());

create policy "Admin read" on audit_logs for select using (public.is_admin());
create policy "Authenticated insert" on audit_logs for insert with check (auth.role() = 'authenticated');

create policy "Authenticated read" on network_devices for select using (auth.role() = 'authenticated');
create policy "Admin write" on network_devices for insert with check (public.is_admin());
create policy "Admin update" on network_devices for update using (public.is_admin());
create policy "Admin delete" on network_devices for delete using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Storage buckets: avatars (per-user) and branding (logo, admin-only)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('branding', 'branding', true)
on conflict (id) do nothing;

create policy "Avatar images are publicly readable" on storage.objects
  for select using (bucket_id = 'avatars');

create policy "Users can upload their own avatar" on storage.objects
  for insert with check (
    bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can update their own avatar" on storage.objects
  for update using (
    bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Branding images are publicly readable" on storage.objects
  for select using (bucket_id = 'branding');

create policy "Admins can upload branding assets" on storage.objects
  for insert with check (bucket_id = 'branding' and public.is_admin());

create policy "Admins can update branding assets" on storage.objects
  for update using (bucket_id = 'branding' and public.is_admin());

-- ---------------------------------------------------------------------------
-- After running this file:
-- 1. Create your first user (Authentication → Users → Add user in the
--    Supabase dashboard, or let them sign up if you enable it).
-- 2. Promote that user to admin — everyone else defaults to 'user' (viewer):
--
--    update profiles set role = 'admin' where email = 'you@yourdomain.gov.ph';
-- ---------------------------------------------------------------------------
