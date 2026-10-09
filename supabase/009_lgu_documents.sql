-- LISDMS migration 009: real document storage for the LGU Documents tab,
-- and the columns it needs. Safe to run against an existing database.

-- Rename the old placeholder column if it's still there from before this
-- feature existed (the Documents tab was never wired up, so this table was
-- never actually written to — this rename is safe).
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'documents' and column_name = 'file_url'
  ) and not exists (
    select 1 from information_schema.columns
    where table_name = 'documents' and column_name = 'file_path'
  ) then
    alter table documents rename column file_url to file_path;
  end if;
end $$;

alter table documents add column if not exists file_size bigint;
alter table documents add column if not exists uploaded_by text;

insert into storage.buckets (id, name, public)
values ('lgu-documents', 'lgu-documents', false)
on conflict (id) do nothing;

drop policy if exists "Authenticated users can read LGU documents" on storage.objects;
create policy "Authenticated users can read LGU documents" on storage.objects
  for select using (bucket_id = 'lgu-documents' and auth.role() = 'authenticated');

drop policy if exists "Admins can upload LGU documents" on storage.objects;
create policy "Admins can upload LGU documents" on storage.objects
  for insert with check (bucket_id = 'lgu-documents' and public.is_admin());

drop policy if exists "Admins can delete LGU documents" on storage.objects;
create policy "Admins can delete LGU documents" on storage.objects
  for delete using (bucket_id = 'lgu-documents' and public.is_admin());
