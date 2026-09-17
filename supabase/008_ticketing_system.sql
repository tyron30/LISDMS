-- LISDMS migration 008: evolve "concerns" into a full ticketing system.
--
-- This RENAMES your existing concerns table to tickets (data preserved —
-- Postgres table/column renames don't touch the rows) and adds ticket
-- numbers, descriptions, requester info, assignment, a comment thread, and
-- attachments. Safe to run once; re-running is a no-op if already applied
-- (checked below).

do $$
declare
  already_migrated boolean;
begin
  select exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'tickets'
  ) into already_migrated;

  if already_migrated then
    raise notice 'tickets table already exists — skipping rename/migration.';
  else
    -- Rename the enum types first (harmless if concerns table doesn't
    -- exist yet either — see the IF EXISTS guards below).
    if exists (select 1 from pg_type where typname = 'concern_status') then
      execute 'alter type concern_status rename to ticket_status';
    elsif not exists (select 1 from pg_type where typname = 'ticket_status') then
      execute $sql$ create type ticket_status as enum ('open', 'in_progress', 'resolved') $sql$;
    end if;

    if exists (select 1 from pg_type where typname = 'concern_severity') then
      execute 'alter type concern_severity rename to ticket_priority';
    elsif not exists (select 1 from pg_type where typname = 'ticket_priority') then
      execute $sql$ create type ticket_priority as enum ('low', 'medium', 'high', 'critical') $sql$;
    end if;

    if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'concerns') then
      execute 'alter table concerns rename to tickets';
      execute 'alter table tickets rename column severity to priority';
    else
      execute $sql$
        create table tickets (
          id uuid primary key default uuid_generate_v4(),
          lgu_id uuid references lgus(id) on delete cascade,
          title text not null,
          category text,
          status ticket_status not null default 'open',
          priority ticket_priority not null default 'medium',
          created_at timestamptz not null default now()
        )
      $sql$;
    end if;

    execute 'alter table tickets add column if not exists ticket_number bigserial';
    execute 'alter table tickets add column if not exists description text';
    execute 'alter table tickets add column if not exists requester_name text';
    execute 'alter table tickets add column if not exists requester_email text';
    execute 'alter table tickets add column if not exists assigned_person_id uuid references assigned_persons(id) on delete set null';
    execute 'alter table tickets add column if not exists updated_at timestamptz not null default now()';
    execute 'alter table tickets add column if not exists resolved_at timestamptz';

    -- ticket_number is unique but bigserial doesn't enforce that by
    -- itself — add the constraint if it's not already there.
    if not exists (
      select 1 from pg_constraint where conname = 'tickets_ticket_number_key'
    ) then
      execute 'alter table tickets add constraint tickets_ticket_number_key unique (ticket_number)';
    end if;

    execute $sql$
      create table if not exists ticket_comments (
        id uuid primary key default uuid_generate_v4(),
        ticket_id uuid references tickets(id) on delete cascade,
        author_email text,
        body text not null,
        created_at timestamptz not null default now()
      )
    $sql$;

    execute $sql$
      create table if not exists ticket_attachments (
        id uuid primary key default uuid_generate_v4(),
        ticket_id uuid references tickets(id) on delete cascade,
        file_name text not null,
        file_url text not null,
        uploaded_at timestamptz not null default now()
      )
    $sql$;
  end if;
end $$;

-- Replace the old concerns view, if it exists.
drop view if exists lgu_open_concerns;
create or replace view lgu_open_tickets as
  select lgu_id, count(*) as open_tickets
  from tickets
  where status <> 'resolved'
  group by lgu_id;

alter table tickets enable row level security;
alter table ticket_comments enable row level security;
alter table ticket_attachments enable row level security;

drop policy if exists "Authenticated read/write" on tickets;
drop policy if exists "Authenticated read" on tickets;
drop policy if exists "Admin write" on tickets;
drop policy if exists "Admin update" on tickets;
drop policy if exists "Admin delete" on tickets;
create policy "Authenticated read" on tickets for select using (auth.role() = 'authenticated');
create policy "Admin write" on tickets for insert with check (public.is_admin());
create policy "Admin update" on tickets for update using (public.is_admin());
create policy "Admin delete" on tickets for delete using (public.is_admin());

drop policy if exists "Authenticated read" on ticket_comments;
drop policy if exists "Authenticated insert" on ticket_comments;
drop policy if exists "Admin delete" on ticket_comments;
create policy "Authenticated read" on ticket_comments for select using (auth.role() = 'authenticated');
create policy "Authenticated insert" on ticket_comments for insert with check (auth.role() = 'authenticated');
create policy "Admin delete" on ticket_comments for delete using (public.is_admin());

drop policy if exists "Authenticated read" on ticket_attachments;
drop policy if exists "Authenticated insert" on ticket_attachments;
drop policy if exists "Admin delete" on ticket_attachments;
create policy "Authenticated read" on ticket_attachments for select using (auth.role() = 'authenticated');
create policy "Authenticated insert" on ticket_attachments for insert with check (auth.role() = 'authenticated');
create policy "Admin delete" on ticket_attachments for delete using (public.is_admin());

-- Private storage bucket for attachments (screenshots, ipconfig dumps,
-- etc. — not made publicly readable like avatars/branding are).
insert into storage.buckets (id, name, public)
values ('ticket-attachments', 'ticket-attachments', false)
on conflict (id) do nothing;

drop policy if exists "Authenticated users can read ticket attachments" on storage.objects;
create policy "Authenticated users can read ticket attachments" on storage.objects
  for select using (bucket_id = 'ticket-attachments' and auth.role() = 'authenticated');

drop policy if exists "Authenticated users can upload ticket attachments" on storage.objects;
create policy "Authenticated users can upload ticket attachments" on storage.objects
  for insert with check (bucket_id = 'ticket-attachments' and auth.role() = 'authenticated');

drop policy if exists "Admins can delete ticket attachments" on storage.objects;
create policy "Admins can delete ticket attachments" on storage.objects
  for delete using (bucket_id = 'ticket-attachments' and public.is_admin());
