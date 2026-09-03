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

## What's a stub (by design, given the size of the original spec)

- Deleting any record, and editing schedules — not built yet (LGUs are fully editable; concerns/requirements/devices have status quick-edit but not full field editing)
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
