-- LISDMS migration 004: District, Date of Deployment, and AnyDesk
-- credentials on the lgus table — matches the columns in the manual
-- QDTS Tracker spreadsheet this system replaces.
-- Safe to run against an existing database; each column is only added if
-- missing. If this is a brand-new project, schema.sql already includes
-- these columns and you don't need this file.

alter table lgus add column if not exists district text;
alter table lgus add column if not exists date_deployed date;
alter table lgus add column if not exists anydesk_id text;
alter table lgus add column if not exists anydesk_password text;
