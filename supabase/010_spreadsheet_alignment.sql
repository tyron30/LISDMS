-- LISDMS migration 010: align the data model with the QDTS Tracker
-- spreadsheet (Directory, MOA Status, Assignments tabs).
-- Safe to run against an existing database; everything is additive.

-- Directory tab: Head of Agency + Designation
alter table lgus add column if not exists head_of_agency text;
alter table lgus add column if not exists designation text;

-- MOA Status tab: With MOA / With SP Resolution / With Gov's Signature
alter table lgus add column if not exists moa_status text
  check (moa_status in ('yes','no','for_preparation','for_discussion','for_schedule','na'));
alter table lgus add column if not exists sp_resolution text
  check (sp_resolution in ('yes','none','na'));
alter table lgus add column if not exists gov_signature text
  check (gov_signature in ('yes','none','na'));

-- Assignments tab: Orientation / Re-Orientation
alter table lgus add column if not exists orientation_status text
  check (orientation_status in ('ok','upcoming','for_schedule','no_orientation','tbd'));

-- Dated check-in notes (the "Concerns <date>" columns and MOA remarks)
create table if not exists lgu_notes (
  id uuid primary key default uuid_generate_v4(),
  lgu_id uuid not null references lgus(id) on delete cascade,
  category text not null default 'general'
    check (category in ('general','moa','orientation','procurement','hardware')),
  body text not null check (length(trim(body)) > 0),
  note_date date not null default current_date,
  author_email text,
  created_at timestamptz not null default now()
);
create index if not exists lgu_notes_lgu_idx on lgu_notes (lgu_id, note_date desc);

alter table lgu_notes enable row level security;

drop policy if exists "Authenticated read" on lgu_notes;
create policy "Authenticated read" on lgu_notes for select using (auth.role() = 'authenticated');

drop policy if exists "Authenticated insert" on lgu_notes;
create policy "Authenticated insert" on lgu_notes for insert with check (auth.role() = 'authenticated');

drop policy if exists "Admin delete" on lgu_notes;
create policy "Admin delete" on lgu_notes for delete using (public.is_admin());
