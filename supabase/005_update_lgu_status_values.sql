-- LISDMS migration 005: replace the placeholder LGU statuses with the
-- real deployment workflow (Deployed / For Deployment / No Update /
-- Partial Update) used in the manual tracking spreadsheet.
--
-- This is safe to run multiple times — it checks whether the migration
-- already happened and skips if so, so it won't scramble already-migrated
-- data.
--
-- Existing values are remapped as:
--   operational        -> deployed
--   pending             -> for_deployment
--   orientation         -> for_deployment
--   network_expansion   -> partial_update
--   critical            -> no_update
--   feedbacking         -> partial_update
--
-- Review the remapped statuses afterwards (e.g. `select name, status from
-- lgus order by name;`) and adjust any that don't reflect reality —
-- this remapping is a reasonable guess, not a guarantee.

do $$
declare
  already_migrated boolean;
begin
  select exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'lgu_status' and e.enumlabel = 'deployed'
  ) into already_migrated;

  if already_migrated then
    raise notice 'lgu_status already uses the new values — nothing to do.';
  else
    execute $sql$
      create type lgu_status_new as enum ('deployed', 'for_deployment', 'no_update', 'partial_update');

      alter table lgus alter column status drop default;

      alter table lgus alter column status type lgu_status_new using (
        case status::text
          when 'operational' then 'deployed'
          when 'pending' then 'for_deployment'
          when 'orientation' then 'for_deployment'
          when 'network_expansion' then 'partial_update'
          when 'critical' then 'no_update'
          when 'feedbacking' then 'partial_update'
          else 'for_deployment'
        end
      )::lgu_status_new;

      alter table lgus alter column status set default 'for_deployment';

      drop type lgu_status;
      alter type lgu_status_new rename to lgu_status;
    $sql$;
  end if;
end $$;
