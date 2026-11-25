-- LISDMS migration 011: let every signed-in user read their OWN activity (the
-- Activity page), while only admins can read everyone's (Audit Logs).
-- Safe to re-run.

drop policy if exists "Admin read" on audit_logs;
drop policy if exists "Admin or own read" on audit_logs;
create policy "Admin or own read" on audit_logs
  for select using (public.is_admin() or actor = (auth.jwt() ->> 'email'));
