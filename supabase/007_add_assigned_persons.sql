-- LISDMS migration 007: assigned persons (the admin-managed list of staff
-- an LGU can be assigned to, e.g. "Charles", "Rafa", "Rhea").
-- Safe to run against an existing database. Requires public.is_admin()
-- from migration 002 — run that first if you haven't already.

create table if not exists assigned_persons (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  created_at timestamptz not null default now()
);

alter table assigned_persons enable row level security;

drop policy if exists "Authenticated read" on assigned_persons;
create policy "Authenticated read" on assigned_persons for select using (auth.role() = 'authenticated');

drop policy if exists "Admin write" on assigned_persons;
create policy "Admin write" on assigned_persons for insert with check (public.is_admin());

drop policy if exists "Admin update" on assigned_persons;
create policy "Admin update" on assigned_persons for update using (public.is_admin());

drop policy if exists "Admin delete" on assigned_persons;
create policy "Admin delete" on assigned_persons for delete using (public.is_admin());

alter table lgus add column if not exists assigned_person_id uuid references assigned_persons(id) on delete set null;

-- Seed the three names from your spreadsheet — safe to re-run, edit, or
-- delete these afterwards from /admin/assigned-persons.
insert into assigned_persons (name) values ('Charles'), ('Rafa'), ('Rhea')
on conflict (name) do nothing;
