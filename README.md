# LISDMS

LGU IT Support & Deployment Monitoring System — a Next.js + Supabase scaffold
built from the design spec (modern sidebar/topnav shell, dashboard, LGU
profiles, concerns, schedule, requirements, reports, dark mode, mobile-first
responsive layout).

## What's included

- Next.js 14 (App Router) + TypeScript + Tailwind
- Design system primitives: `Button`, `Card`, `Badge`/`StatusBadge`, `Input`, `EmptyState`
- App shell: collapsible desktop sidebar, mobile drawer, top nav with search/dark-mode/notifications
- Pages: Dashboard, LGUs (list + detail with tabs), Concerns, Schedule, Requirements, Network (stub), Reports (with chart)
- Light/dark mode via Tailwind `class` strategy, tokens in `src/app/globals.css`
- Supabase client (`src/lib/supabase.ts`) with graceful fallback to sample data (`src/lib/mock-data.ts`) when env vars aren't set — so the UI is reviewable immediately after install
- `supabase/schema.sql` — tables for `lgus`, `concerns`, `schedules`, `requirements`, `documents`, `audit_logs`, plus RLS policies

## Authentication

Login is wired to Supabase Auth (email + password):

- `src/middleware.ts` protects every route except `/login`, redirecting signed-out
  visitors to sign in and bouncing signed-in users away from `/login`.
- `src/app/login/page.tsx` is the sign-in form.
- The top-nav avatar shows the signed-in user's initials/email and opens a menu with
  Profile, Preferences, Activity, and Logout.
- If Supabase isn't configured yet, auth is skipped entirely so the app stays
  browsable with sample data (`.env.local` unset = no login wall).

To create your first user: Supabase dashboard → Authentication → Users → Add user
(or enable sign-ups and self-register). There's no public registration page by
design — this is an internal tool provisioned by an admin.

## Roles & access control

Two roles: **admin** (full read/write) and **user** (read-only viewer).

- **New Supabase project:** just run `supabase/schema.sql` — it includes everything (tables, roles, branding, storage).
- **Already ran schema.sql before** (i.e. you set this up prior to roles/branding being added): run `supabase/002_add_roles_and_branding.sql` instead. It's written to be safe against tables/policies that already exist.
- **Adding network device inventory to an existing database:** run `supabase/003_add_network_devices.sql` (also safe to re-run / run alongside a fresh `schema.sql`, which already includes it).
- **Adding District/Date Deployed/AnyDesk credentials to an existing database:** run `supabase/004_add_lgu_deployment_fields.sql`.
- **Switching to the real Deployed/For Deployment/No Update/Partial Update statuses on an existing database:** run `supabase/005_update_lgu_status_values.sql`. It remaps your existing LGU statuses automatically (see the comments in that file for the exact mapping) — double check the results afterwards since the mapping is a best guess.
- **Letting the login page show your branding (logo/org name) on an existing database:** run `supabase/006_public_branding_read.sql`. It only changes who can *read* `org_name`/`logo_url` (now: anyone, even signed out) — writing still requires admin.
- Every new signup defaults to `user` via a database trigger. Promote your first account to admin directly in SQL:
  ```sql
  update profiles set role = 'admin' where email = 'you@yourdomain.gov.ph';
  ```
- **The real security boundary is Supabase Row Level Security**, defined in
  `supabase/schema.sql` — every table allows `select` to any signed-in user,
  but `insert`/`update`/`delete` require `profiles.role = 'admin'`. This is
  enforced by the database regardless of what the frontend does.
- The UI also hides create/edit buttons from non-admins (`AdminGuard`,
  `useAuth().isAdmin`) so viewers get a clean read-only experience — but
  treat that as UX polish on top of RLS, not the security layer itself.
- `/admin/users` — admins can change any user's role.
- `/admin/audit-logs` — admin-only view of the `audit_logs` table.
- `/admin/settings` — admin-only branding management (see below).

## Branding / content management

Admins can change the org name and logo from `/admin/settings`. The logo
uploads to a public `branding` Supabase Storage bucket and is saved in the
singleton `app_settings` table; the sidebar reads it live via
`src/lib/settings-context.tsx`. Falls back to "LISDMS" and a plain mark if
nothing's been set yet.

## Profile: avatar + password

`/profile` lets any signed-in user:
- Upload a profile picture (stored per-user in the `avatars` Storage bucket,
  publicly readable, writable only by that user — see the storage policies
  in `schema.sql`)
- Edit their display name
- Change their password anytime via `supabase.auth.updateUser()`

## Calendar

The Schedule page (`/schedule`) is a full calendar, not just an agenda:

- **Month / Week / Day / Agenda** views, switchable via the toggle in the header (desktop)
- Prev/Next/Today navigation for month, week, and day
- Clicking an event opens a detail dialog (LGU, date, time, type) with a link to the LGU profile
- **Mobile is agenda-first and CSS-driven** — below the `md` breakpoint the agenda list is always what's shown (via Tailwind's `md:hidden` / `hidden md:block`, not a JS viewport check), so it's reliable on first paint on a real phone. Month/Week/Day grids are a desktop-only enhancement.
- Event types are color-coded (orientation / network installation / feedbacking / critical visit) consistently across all views

Built with `date-fns` for date math — see `src/components/calendar/`.

## Creating records

Admins can now actually create data, not just view it:

- **Add LGU** (`/lgus`) — full form: name, province, status, focal person, contact info, system/version/network setup
- **New Concern** (`/concerns`, and pre-filled from an LGU's page) — LGU, title, category, severity
- **Schedule Visit** (`/schedule` calendar header, and pre-filled from an LGU's page) — LGU, title, type, date, time
- **Add Requirement** (`/requirements`, and pre-filled from an LGU's page) — LGU, name, due date

All of them insert directly into Supabase, show a success/error toast, and refresh the list in place. Viewers (non-admin) don't see these buttons at all. On an LGU's page, **Call** and **Email** are real `tel:`/`mailto:` links now instead of no-op buttons.

Note: `concerns`, `schedules`, and `requirements` only store `lgu_id` in the database — the UI joins against `lgus` to show a name, and the LGU list's "Concerns"/"Next Visit" columns are computed client-side from the related tables (not stored columns on `lgus` itself).

## Network device inventory

`/network` is a real inventory now, not a placeholder:

- Search by device name, LGU, or IP; filter by status (online/offline/maintenance)
- Desktop table / mobile cards, same pattern as the LGU list
- **Add Device** (admins only) — LGU, device name, type (router/switch/access point/modem/printer/other), IP, MAC, status, notes
- Status counts (online/offline) shown at the top
- Backed by a new `network_devices` table — see below for how to add it to your database

## Audit logging

`/admin/audit-logs` now actually fills up — every meaningful write in the app
logs a row via `src/lib/audit.ts`:

- Signing in
- Creating an LGU, concern, schedule, requirement, or network device
- Changing a user's role
- Updating branding settings
- Changing your own password

It's a fire-and-forget insert (failures are logged to the console but never
block the action itself), and it relies on the `"Authenticated insert"`
policy on `audit_logs` from `schema.sql`/migration 002, so any signed-in user
can write a log entry but only admins can read the log (`/admin/audit-logs`
is admin-only). There's no credential-reveal feature yet, so that's not
logged — add a call to `logAction()` wherever you build one.

## Deployment fields & credentials

To match a real manual tracking spreadsheet (District, Date of Deployment,
AnyDesk ID/Password per LGU), the `lgus` table and the Add LGU form now
include:

- **District** — shown in the LGU list and Overview tab
- **Date Deployed**
- **AnyDesk ID** and **AnyDesk Password** — shown on a new **Credentials**
  tab on each LGU's page. The password is masked by default; clicking
  Reveal shows a confirmation ("this will be recorded in the audit log"),
  then logs the reveal via `logAction()`. Both fields are readable by any
  signed-in user (field staff need them to remote in) — the audit trail is
  the accountability mechanism, not a further access restriction. Treat
  this as suitable for an internal tool, not a hardened secrets vault: RLS
  protects row-level access, but there's no column-level encryption.

## LGU status values

Statuses now match the real deployment workflow instead of the placeholder
set from early scaffolding: **Deployed**, **For Deployment**, **Partial
Update**, **No Update** — color-coded green/blue/amber/red respectively,
matching the manual tracking spreadsheet's row colors.

## Editing & status updates (CRUD, not just create)

- **Edit LGU** — admins can edit any LGU from the LGU list (pencil icon per
  row) or from the LGU's own page ("Edit LGU" button), including its AnyDesk
  credentials. Same form as Add LGU, pre-filled.
- **Concerns** — status (Open / In Progress / Resolved) is an inline
  dropdown, both on `/concerns` and on an LGU's Concerns tab. Change it and
  it saves immediately — no separate save button.
- **Requirements** — same pattern: status (Pending / Submitted / Waived) is
  an inline dropdown on `/requirements` and on an LGU's Requirements tab.
- **Network devices** — status (Online / Offline / Maintenance) is an inline
  dropdown in the device table.
- All of these are admin-only (viewers see a plain badge instead of the
  dropdown) and get written to the audit log via `logAction()`.
- Not yet built: editing a concern/requirement/device's other fields (title,
  category, IP, etc.) — only status has a quick-edit control right now.
  Deleting records isn't built yet either.

## Command palette (Ctrl+K)

Press **Ctrl+K** (or **Cmd+K** on Mac) anywhere in the app, or click the
search bar in the top nav, to open a global search:

- Searches LGUs, concerns, schedules, and requirements at once, debounced as you type
- Arrow keys to move, Enter to jump straight to the matching LGU's page, Esc or click-outside to close
- Works in both live Supabase mode and sample-data mode
- Mobile: the search icon in the top nav opens the same overlay (full-width, touch-friendly)

See `src/lib/command-palette-context.tsx` (global keyboard listener) and
`src/components/command-palette/`.

## Deleting records (data cleanup)

Every record type can now be deleted by an admin, always behind a
confirmation dialog ("This action cannot be easily undone") — never a
single-click delete:

- **LGUs** — trash icon on `/lgus`, or "Delete" on the LGU's own page. The
  confirmation explicitly warns that this cascades: deleting an LGU also
  deletes its concerns, schedules, requirements, documents, and network
  devices (enforced by `ON DELETE CASCADE` in the schema, not just app logic).
- **Concerns** — trash icon on `/concerns` and on an LGU's Concerns tab.
- **Requirements** — trash icon on `/requirements` and on an LGU's Requirements tab.
- **Network devices** — trash icon in the device table on `/network`.
- **Schedules** — "Delete" button inside the visit detail dialog (click any
  calendar event).

All deletes are admin-only, logged via `logAction()`, and share one
component: `src/components/forms/delete-confirm-dialog.tsx`.

## Audit Logs: search, filter, and pagination

`/admin/audit-logs` no longer dumps everything as one long scroll:

- Search box (matches actor, action, or target)
- Filter by action type (dropdown built from whatever actions actually exist)
- Date range filter (today / 7 days / 30 days / all time)
- Paginated 20 at a time with Prev/Next

## Branding reaches the whole system, including the login page

Previously the custom logo/org name only showed inside the authenticated
app (sidebar). Now:

- The **login page** shows the admin-set logo and org name too (e.g. "Sign
  in to Your Org Name")
- The **browser tab title** updates to the org name on every page
- This required loosening the `app_settings` read policy to allow
  unauthenticated (anonymous) reads, since nobody is signed in yet on the
  login screen — see `supabase/006_public_branding_read.sql`. Only
  `org_name`/`logo_url` are exposed this way; writing still requires admin,
  and every other table still requires authentication to read.

## Notifications button actually works now

The bell in the top nav used to be decorative. It now opens a real dropdown
computed from live data — no separate notifications table, just a read
across what already exists:

- Visits scheduled in the next 3 days
- Open concerns with high/critical severity
- Requirements past their due date and still pending
- Network devices currently offline

Badge shows the count; clicking an item jumps to the relevant LGU. Refreshes
every 5 minutes. See `src/lib/notifications.ts`.

## District is now a dropdown

The Add/Edit LGU form's District field is a `<select>` with 1st–5th District
instead of free text, so data stays consistent (no "1st District" vs "1st
Dist." vs "District 1" variants).

## Security: 30-minute idle auto-logout

Any signed-in session automatically signs out after 30 minutes of no mouse,
keyboard, touch, or scroll activity — with a warning toast 5 minutes before
it happens. Redirects to `/login?reason=timeout`, which shows a clear notice
about why they were signed out. See
`src/components/layout/idle-timeout-guard.tsx`, mounted once inside
`AppShell` (so it only runs on authenticated pages, never on `/login`
itself). This is a UX safety net on top of the real security boundary,
which is Supabase's session/cookie expiry plus `middleware.ts` redirecting
any request without a valid session.

## Login page design

The login page now uses a full-bleed background photo
(`public/images/login-bg.webp` — swap this file for your own image anytime,
same filename) with:

- A dark gradient overlay so the form stays readable regardless of the
  photo's own brightness
- A slow, subtle "Ken Burns" zoom on the background (24s, respects
  `prefers-reduced-motion` automatically via the existing global rule)
- A frosted-glass login card (`backdrop-blur-xl` + translucent surface)
  that sits on top, with a fade-up entrance animation
- Icons inside the email/password fields, and a slightly deeper shadow on
  hover for polish
- Still fully dynamic: shows the admin-set logo/org name from
  `/admin/settings`, same as everywhere else in the app

## Full edit forms (not just status)

Concerns, requirements, and network devices now have a real edit form, not
just the inline status dropdown:

- Pencil icon opens the same dialog used for creating, pre-filled, with an
  additional Status field that only appears in edit mode
- Available on `/concerns`, `/requirements`, `/network`, and on an LGU's own
  Concerns/Requirements tabs
- Requirements past their due date and still pending are now visually
  flagged ("Overdue since...") in red

## Reports: real, actionable data instead of a fake "visits" number

The old Reports page had a hardcoded "Visits per Month" chart with numbers
that were never connected to anything — literally a JS array typed into the
component. Replaced with reports computed from your actual data:

- **LGU Status Distribution** — bar chart, color-coded to match the status badges
- **Open Concerns by Severity** — where the actual problems are concentrated
- **App Version Distribution** — horizontal bar chart showing which LGUs are on an outdated build (this is the "which sites need an update" report)
- **Deployment Coverage by District** — progress bar per district, deployed vs total, so you can see at a glance which district is furthest behind
- Stat cards: Total LGUs, % Deployed, Open Concerns, Overdue Requirements

## Loading states

Dashboard, LGUs, Concerns, Requirements, Network, and Reports now show
skeleton placeholders while data loads instead of flashing "0 results" or a
blank table for a moment — see `src/components/ui/skeleton.tsx`.

## What's a stub (by design, given the size of the original spec)

- Editing schedules (visits) isn't built yet — LGUs, concerns, requirements, and devices are all fully editable now
- Preferences page isn't wired to real settings yet; Activity is a placeholder pointing at `audit_logs`
- Document upload is still a placeholder
- Real-time subscriptions / notifications

These are all straightforward to build on top of the patterns already in
`src/components` and the schema in `supabase/schema.sql`.

## Setup

```bash
npm install
cp .env.local.example .env.local
# edit .env.local with your Supabase project URL + anon key
npm run dev
```

Open http://localhost:3000 — it will redirect to `/dashboard`.

Without Supabase configured, every page falls back to sample data
automatically (you'll see a small "Showing sample data" note on the
dashboard). Once you add your Supabase credentials and run
`supabase/schema.sql` in the Supabase SQL editor, the app will start
reading real data.

## Project structure

```
src/
  app/                 routes (dashboard, lgus, concerns, schedule, requirements, network, reports)
  components/
    layout/            Sidebar, TopNav, AppShell
    ui/                Button, Card, Badge, Input, EmptyState
    dashboard/         StatCard
  lib/                 supabase client, types, mock data, utils
supabase/schema.sql    database schema + RLS policies
```
