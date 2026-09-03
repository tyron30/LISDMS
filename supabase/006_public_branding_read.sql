-- LISDMS migration 006: allow the login page (where nobody is signed in
-- yet) to read branding settings, so the custom logo/org name shows up
-- there too, not just inside the authenticated app.
--
-- org_name and logo_url aren't sensitive, so public read is fine — this
-- does NOT allow anyone to write to app_settings, only admins can (see
-- the existing "Admins can update settings" policy).

drop policy if exists "Authenticated users can read settings" on app_settings;
drop policy if exists "Anyone can read settings" on app_settings;

create policy "Anyone can read settings" on app_settings
  for select using (true);
