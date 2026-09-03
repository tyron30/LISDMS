-- LISDMS migration 003: network device inventory.
-- Safe to run whether or not you already ran schema.sql — only adds what's
-- missing. If this is a brand-new Supabase project, schema.sql already
-- includes this and you don't need to run this file separately.

do $$ begin
  if not exists (select 1 from pg_type where typname = 'device_status') then
    create type device_status as enum ('online', 'offline', 'maintenance');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'device_type') then
    create type device_type as enum ('router', 'switch', 'access_point', 'modem', 'printer', 'other');
  end if;
end $$;

create table if not exists network_devices (
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

alter table network_devices enable row level security;

-- Requires public.is_admin() from migration 002 — run that one first if
-- you haven't already.
drop policy if exists "Authenticated read" on network_devices;
create policy "Authenticated read" on network_devices
  for select using (auth.role() = 'authenticated');

drop policy if exists "Admin write" on network_devices;
create policy "Admin write" on network_devices
  for insert with check (public.is_admin());

drop policy if exists "Admin update" on network_devices;
create policy "Admin update" on network_devices
  for update using (public.is_admin());

drop policy if exists "Admin delete" on network_devices;
create policy "Admin delete" on network_devices
  for delete using (public.is_admin());
