-- LISDMS core schema
-- Run this in the Supabase SQL editor (or via `supabase db push`).

create extension if not exists "uuid-ossp";

create type lgu_status as enum (
  'deployed', 'for_deployment', 'no_update', 'partial_update'
);
create type ticket_status as enum ('open', 'in_progress', 'resolved');
create type ticket_priority as enum ('low', 'medium', 'high', 'critical');
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
  head_of_agency text,
  designation text,
  moa_status text check (moa_status in ('yes','no','for_preparation','for_discussion','for_schedule','na')),
  sp_resolution text check (sp_resolution in ('yes','none','na')),
  gov_signature text check (gov_signature in ('yes','none','na')),
  orientation_status text check (orientation_status in ('ok','upcoming','for_schedule','no_orientation','tbd')),
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

create table tickets (
  id uuid primary key default uuid_generate_v4(),
  ticket_number bigserial unique,
  lgu_id uuid references lgus(id) on delete cascade,
  title text not null,
  description text,
  category text,
  status ticket_status not null default 'open',
  priority ticket_priority not null default 'medium',
  requester_name text,
  requester_email text,
  assigned_person_id uuid references assigned_persons(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

-- Troubleshooting log / conversation thread on a ticket. Any signed-in
-- user can add a note (not just admins) — this is a running log of what
-- was tried, not a change to the ticket's core fields.
create table ticket_comments (
  id uuid primary key default uuid_generate_v4(),
  ticket_id uuid references tickets(id) on delete cascade,
  author_email text,
  body text not null,
  created_at timestamptz not null default now()
);

create table ticket_attachments (
  id uuid primary key default uuid_generate_v4(),
  ticket_id uuid references tickets(id) on delete cascade,
  file_name text not null,
  file_url text not null,
  uploaded_at timestamptz not null default now()
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
  -- Path inside the private lgu-documents storage bucket, not a public URL —
  -- downloads go through a short-lived signed URL generated on demand.
  file_path text not null,
  file_size bigint,
  uploaded_by text,
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
create view lgu_open_tickets as
  select lgu_id, count(*) as open_tickets
  from tickets
  where status <> 'resolved'
  group by lgu_id;

-- ---------------------------------------------------------------------------
-- Row Level Security: everyone signed in can READ; only admins can WRITE.
-- This is the actual access-control boundary — the app's UI also hides
-- create/edit buttons from non-admins, but that's just UX, not security.
-- ---------------------------------------------------------------------------
alter table lgus enable row level security;
alter table tickets enable row level security;
alter table ticket_comments enable row level security;
alter table ticket_attachments enable row level security;
alter table schedules enable row level security;
alter table requirements enable row level security;
alter table documents enable row level security;
alter table audit_logs enable row level security;
alter table network_devices enable row level security;

create policy "Authenticated read" on lgus for select using (auth.role() = 'authenticated');
create policy "Admin write" on lgus for insert with check (public.is_admin());
create policy "Admin update" on lgus for update using (public.is_admin());
create policy "Admin delete" on lgus for delete using (public.is_admin());

create policy "Authenticated read" on tickets for select using (auth.role() = 'authenticated');
create policy "Admin write" on tickets for insert with check (public.is_admin());
create policy "Admin update" on tickets for update using (public.is_admin());
create policy "Admin delete" on tickets for delete using (public.is_admin());

-- Comments are the exception to admin-only writes: anyone signed in can
-- log a troubleshooting note, not just admins.
create policy "Authenticated read" on ticket_comments for select using (auth.role() = 'authenticated');
create policy "Authenticated insert" on ticket_comments for insert with check (auth.role() = 'authenticated');
create policy "Admin delete" on ticket_comments for delete using (public.is_admin());

create policy "Authenticated read" on ticket_attachments for select using (auth.role() = 'authenticated');
create policy "Authenticated insert" on ticket_attachments for insert with check (auth.role() = 'authenticated');
create policy "Admin delete" on ticket_attachments for delete using (public.is_admin());

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
-- Storage buckets: avatars (per-user), branding (logo, admin-only), and
-- ticket-attachments (private — not publicly readable like the others,
-- since ticket attachments like ipconfig dumps or screenshots may contain
-- internal network details).
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('branding', 'branding', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('ticket-attachments', 'ticket-attachments', false)
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

create policy "Authenticated users can read ticket attachments" on storage.objects
  for select using (bucket_id = 'ticket-attachments' and auth.role() = 'authenticated');

create policy "Authenticated users can upload ticket attachments" on storage.objects
  for insert with check (bucket_id = 'ticket-attachments' and auth.role() = 'authenticated');

create policy "Admins can delete ticket attachments" on storage.objects
  for delete using (bucket_id = 'ticket-attachments' and public.is_admin());

insert into storage.buckets (id, name, public)
values ('lgu-documents', 'lgu-documents', false)
on conflict (id) do nothing;

create policy "Authenticated users can read LGU documents" on storage.objects
  for select using (bucket_id = 'lgu-documents' and auth.role() = 'authenticated');

create policy "Admins can upload LGU documents" on storage.objects
  for insert with check (bucket_id = 'lgu-documents' and public.is_admin());

create policy "Admins can delete LGU documents" on storage.objects
  for delete using (bucket_id = 'lgu-documents' and public.is_admin());

-- ---------------------------------------------------------------------------
-- After running this file:
-- 1. Create your first user (Authentication → Users → Add user in the
--    Supabase dashboard, or let them sign up if you enable it).
-- 2. Promote that user to admin — everyone else defaults to 'user' (viewer):
--
--    update profiles set role = 'admin' where email = 'you@yourdomain.gov.ph';
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- LGU notes: the dated check-in remarks from the tracking spreadsheet
-- ("Concerns 6/9", "Concerns 7/10", MOA remarks, procurement follow-ups).
-- Any signed-in user can log an update; only admins can delete one.
-- ---------------------------------------------------------------------------
create table lgu_notes (
  id uuid primary key default uuid_generate_v4(),
  lgu_id uuid not null references lgus(id) on delete cascade,
  category text not null default 'general'
    check (category in ('general','moa','orientation','procurement','hardware')),
  body text not null check (length(trim(body)) > 0),
  note_date date not null default current_date,
  author_email text,
  created_at timestamptz not null default now()
);
create index lgu_notes_lgu_idx on lgu_notes (lgu_id, note_date desc);

alter table lgu_notes enable row level security;
create policy "Authenticated read" on lgu_notes for select using (auth.role() = 'authenticated');
create policy "Authenticated insert" on lgu_notes for insert with check (auth.role() = 'authenticated');
create policy "Admin delete" on lgu_notes for delete using (public.is_admin());
