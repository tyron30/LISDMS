# LISDMS

LGU IT Support & Deployment Monitoring System — a Next.js + Supabase scaffold
built from the design spec (modern sidebar/topnav shell, dashboard, LGU
profiles, a ticketing system, schedule, requirements, reports, dark mode, mobile-first
responsive layout).

## What's included

- Next.js 14 (App Router) + TypeScript + Tailwind
- Design system primitives: `Button`, `Card`, `Badge`/`StatusBadge`, `Input`, `EmptyState`
- App shell: collapsible desktop sidebar, mobile drawer, top nav with search/dark-mode/notifications
- Pages: Dashboard, LGUs (list + detail with tabs), Tickets, Schedule, Requirements, Network, Reports
- Light/dark mode via Tailwind `class` strategy, tokens in `src/app/globals.css`
- Supabase client (`src/lib/supabase.ts`) with graceful fallback to sample data (`src/lib/mock-data.ts`) when env vars aren't set — so the UI is reviewable immediately after install
- `supabase/schema.sql` — tables for `lgus`, `tickets`, `ticket_comments`, `schedules`, `requirements`, `documents`, `audit_logs`, plus RLS policies

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
- **Adding the Assigned Persons list to an existing database:** run `supabase/007_add_assigned_persons.sql`. Seeds Charles, Rafa, and Rhea automatically; edit/add/remove from `/admin/assigned-persons` afterward.
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

## Stale session cleanup

If a browser has a leftover Supabase refresh token that's no longer valid
(e.g. after resetting the database, switching Supabase projects, or a cookie
surviving longer than the session it referred to), Supabase's client used
to throw `AuthApiError: Invalid Refresh Token` on every single request —
noisy in the terminal, though the app still correctly treated the visitor
as signed out. Both `middleware.ts` and `src/lib/use-auth.ts` now catch this
specifically and clear the invalid `sb-*` cookies/local session the moment
it's detected, so it self-heals on the next request instead of repeating.

## Security hardening

- **HTTP security headers** (`next.config.mjs`): `X-Frame-Options: DENY` (clickjacking), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, a restrictive `Permissions-Policy` (no camera/mic/geolocation access — this app never needs it), and `Strict-Transport-Security` for once it's deployed behind HTTPS.
- **Login throttling (UX-level deterrent):** after 5 failed sign-in attempts, the form locks for 30 seconds with a visible countdown. This is a client-side speed bump for casual retries — the real protection against brute-forcing is Supabase Auth's own server-side rate limiting, which applies regardless of what this UI does.
- **Password strength requirements:** enforced (not just suggested) when changing a password on `/profile` — 8+ characters, one uppercase letter, one number — with a live checklist.
- **Password visibility toggle** on login and password-change fields, so people can verify what they typed instead of guessing (reduces mistyped-password lockouts, which is itself a security-adjacent UX problem).
- **Stale session cleanup** (already covered above) prevents a leftover invalid token from being retried indefinitely.
- **RLS + audit logging + idle timeout** (covered earlier) remain the core of the access-control story — this section is additive hardening on top of that, not a replacement for it.

## UX polish

- **Dialogs now trap focus** — Tab cycles only within the open dialog instead of leaking into the page behind it, and focus returns to whatever triggered the dialog when it closes. First input auto-focuses on open. This matters for both keyboard users and screen reader users.
- **Mobile bottom action bar on the LGU page** (`Call` / `Email` / `Concern` / `Schedule`, admin actions included) — always reachable with one thumb without scrolling back to the header, per the original spec's mobile quick-actions requirement.
- **Consistent loading skeletons** now also cover the LGU detail page (previously just showed "Loading…" as plain text).

## Assigned persons

Admins manage a simple staff list at `/admin/assigned-persons` (add, rename,
remove — seeded with Charles, Rafa, and Rhea from the original spreadsheet).
Every LGU can be assigned to one of these people via a dropdown on the
Add/Edit LGU form; it shows on the LGU list, the LGU's Overview tab, and
survives renames automatically since it's stored as a foreign key, not a
copied string. Removing a person just unassigns their LGUs rather than
deleting anything else.

## LGU list grouped by district

`/lgus` now renders a separate table per district (1st through 5th, in
order), each with its own header and count, instead of one long flat list —
matching how the source spreadsheet was organized. LGUs without a district
set land in a "No District Set" group at the end.

## LGU name autocomplete with district auto-fill

Typing in the LGU Name field on Add/Edit LGU suggests matching Leyte towns
as you type (e.g. typing "B" surfaces Babatngon, Barugo, Bato...). Picking a
suggestion auto-fills the District (when known) and defaults Province to
"Leyte" — both stay editable afterward, this is just a starting point, not
a lock.

**Data confidence note:** the town list lives in `src/lib/leyte-towns.ts` —
a plain array, easy to edit directly. All 43 Leyte LGUs (40 municipalities
plus Tacloban City, Ormoc City, and Baybay City) are now mapped to their
correct district, sourced from the official district breakdown.

## Fixed: typing inside any dialog required re-clicking after every letter

Root cause: the dialog's keyboard focus-trap effect depended on the `onClose`
function, which is a fresh function reference on every render for most
callers (`onClose={() => setX(null)}`) — so the effect re-ran on every
keystroke inside the dialog, which re-focused an element and stole focus
away mid-type. Fixed by keeping the latest `onClose` in a ref instead of an
effect dependency, so the focus-trap effect now only runs when the dialog
actually opens or closes. This affected every dialog in the app (Add/Edit
LGU, New Concern, Schedule Visit, etc.), not just the LGU name field — all
fixed by the same change since they share one `Dialog` component.

## Ticketing system (replaces "Concerns")

"Concerns" evolved into a real ticketing system, since a flat list wasn't
giving you what you actually needed for troubleshooting:

- **Ticket numbers** — auto-incrementing (`#1042`), easy to reference on a phone call
- **Priority** (Low/Medium/High/Critical) and **Category** (Network/Hardware/Software/Account-Access/Other)
- **Assignment** to one of your Assigned Persons (Rafa/Rhea/Charles), same list used for LGUs
- **A troubleshooting log** — `/tickets/[id]` has a running comment thread (any signed-in user can post an update, not just admins) so there's an actual record of what was tried and by whom, not just a single status flip
- Full edit form, delete (admin-only, confirmation required), inline status changes from the list
- Wired into the dashboard ("Open Tickets"), Reports ("Open Tickets by Priority"), notifications (high/critical tickets), and the command palette (Ctrl+K) — search a ticket by number or title and jump straight to it
- `/concerns` still works as a redirect to `/tickets` in case anything was bookmarked

**Ticket creation is still admin-entered for now** — LGU staff don't have a
way to submit their own ticket yet. That's a deliberate scope decision, not
an oversight: opening public submission means deciding between a
no-login public form (simpler, but anyone with the link can submit as any
LGU) versus giving LGU staff real accounts scoped to their own LGU (more
identity/security work). The data model already has `requester_name` and
`requester_email` columns ready for whichever direction gets picked.

## Clickable things should look clickable

Links used to only reveal themselves on hover (a color change), which means
anyone on a touch screen — or just scanning the page — had no way to know
a name was clickable. Fixed with a consistent convention across the app:

- **Links are always link-colored and underlined** (a soft underline that
  strengthens on hover), never plain text that only changes on hover
- **List rows show a trailing chevron (`>`)** — a universal "this leads
  somewhere" cue — on the LGU list and Tickets list, on both desktop and mobile
- **Whole rows are clickable** on LGU and Ticket lists (not just the name),
  while the edit/delete icons, status dropdowns, and inner links inside a row
  are guarded so they don't also trigger the row navigation
- The LGU name stays a real `<a>` link underneath the row click, so keyboard
  navigation, screen readers, and right-click "open in new tab" all still work
- Dashboard: LGU names in "LGU Status Overview" and "Upcoming Visits" were
  plain text with no link at all; they now link to the LGU, and the overview
  card has a "View all" shortcut to `/lgus`

## LGU page tabs: System, Schedules, Documents, History

These four tabs used to show a "scaffolded" placeholder. They're all real now:

- **System** — the LGU's deployment profile (system, app version, network setup, status, date deployed, district) plus the **network devices installed at that site**, with add/edit/delete and an offline count. The global list is still at `/network`.
- **Schedules** — every visit for this LGU, split into Upcoming and Past, with schedule/edit/delete. Visits can now be **edited** (previously only created or deleted), from here or anywhere the visit dialog is used.
- **Documents** — upload MOAs, endorsement letters, site surveys, etc. (admins upload/delete; any signed-in user can download). Files go to a **private** `lgu-documents` storage bucket, 10 MB limit; downloads use short-lived (60 second) signed links rather than permanent public URLs, since these are government documents. Deleting a document removes both the record and the stored file.
- **History** — a newest-first timeline of everything for this LGU: when it was added, its deployment date, tickets opened and resolved, requirements added, visits (upcoming ones are flagged), and documents uploaded. It is built from the records themselves rather than the audit log, because audit entries store a free-text target that can't be reliably tied to one LGU. Limitation: requirement status changes aren't timestamped in the schema, so only when a requirement was *added* appears.

Database: run `supabase/009_lgu_documents.sql` on an existing install (renames the unused `documents.file_url` to `file_path`, adds `file_size`/`uploaded_by`, creates the private bucket and its policies). Fresh installs get this from `schema.sql`.

## Aligned with the QDTS Tracker spreadsheet

The system now mirrors the tabs of the team's tracking spreadsheet, using the same vocabulary:

| Spreadsheet tab | In LISDMS |
|---|---|
| **Directory** (Head of Agency, Designation, QDTS Point Person, Contact Numbers, Email, Date of Deployment, Assigned Person) | Add/Edit LGU form and the LGU's **Contacts** tab. Several people or numbers in one cell, separated by `/`, are split so each number gets its own tap-to-call link. Designation is pre-filled from the LGU (Governor / Municipal Mayor / City Mayor). |
| **Anydesk / deployment** (Date of Deployment, QDTS Setup, Version, Any Desk) | QDTS Setup is now an Online / LAN dropdown; Version suggests the versions in use; AnyDesk stays on the Credentials tab (masked, reveal is audit-logged). |
| **MOA Status** (With MOA, With SP Resolution, With Gov's Signature, Remarks) | The **MOA Tracker** page (`/moa`): the three checks per LGU, editable in place by admins, with progress totals and the latest MOA remark. Also on each LGU's Overview, and in Reports. |
| **Assignments** (grouped by Rafa / Rhea / Charles; MOA, Orientation, Concerns by date) | The **Assignments** page (`/assignments`): LGUs grouped under the person responsible, with MOA and orientation editable in place and the latest dated update. |
| **"Concerns 6/9", "Concerns 7/10", ... columns** and MOA remarks | The LGU's **Updates** tab: a dated running log with categories (General, MOA, Orientation, Procurement, Hardware). Anyone signed in can add an update; admins can delete. Also shown in the History timeline. |
| **Province of Leyte** row above the districts | A "Provincial Government" group, listed first. |

Database: run `supabase/010_spreadsheet_alignment.sql` on an existing install (adds the new LGU columns and the `lgu_notes` table; additive, nothing is removed). Fresh installs get it from `schema.sql`.

Not yet covered because they weren't in the shared screenshots: the **2026 Reports**, **Specs Sheet**, **Coordination Flow**, **2026 Goals** and **Calendar 2026** tabs.

## Sessions: closing the app signs you out

Previously the login lasted about a year (the Supabase library hard-codes a
400-day cookie), so closing the app and reopening it dropped you straight back
into the dashboard. Now:

- The login cookie is a **session cookie** — it disappears when the browser closes (`src/lib/supabase.ts`, `src/middleware.ts`).
- **Closing the last tab** while the browser stays open also ends the session: each open tab registers itself, and a new tab that finds no live tab and has no session of its own is treated as a new browser session and sent to the login page (`src/lib/session.ts`). Reloading, navigating, or opening a second tab while one is open does **not** sign you out.
- A session also ends after **12 hours** regardless of activity, and after **30 minutes idle** (with a warning 5 minutes before).
- The login page says why you were signed out (inactivity / app closed / 12-hour limit).

One-time effect of this update: everyone is asked to sign in once, because existing logins predate the new rules.

**Logout fix:** the app's "who is signed in?" check used to call sign-out itself whenever it found nobody, and every sign-out re-ran that check — so after pressing Logout it looped until the tab froze. It now simply reports "signed out". Logout (and the automatic idle / closed / 12-hour sign-outs) now sign out this browser only — not your other devices — and finish with a full page reload to the login screen so no signed-in pages stay cached.

## Preferences and My Activity

- **Preferences** (`/preferences`): theme (Light / Dark / Match my computer — also what the moon/sun button in the top bar changes), which page opens after sign-in, and which alerts the bell shows (upcoming visits, high-priority tickets, overdue requirements, offline devices) and how far ahead it looks for visits. Saved instantly **in this browser** (not per account).
- **My Activity** (`/activity`): your own sign-ins and changes. Admins still see everyone's under Administration → Audit Logs; both use the same filterable view. Run `supabase/011_own_activity_read.sql` so non-admins can read their own entries.

## MOA remarks and updates from the tracker

The MOA Tracker (and Assignments) have an **Add remark / Add update** button on every LGU row — anyone signed in can add one, with a date; "View all" opens that LGU's Updates tab. The Updates tab uses the same dialog. Updates are an append-only log; admins can delete one, but there is no edit.

## Scheduling a visit for an LGU that isn't in the system yet

In the Schedule Visit form's LGU list, choose **＋ New LGU (not in the system yet)…**, type the name (Leyte towns are suggested and the district fills in), and saving creates that LGU as "For Deployment" together with the visit. Typing a name that already exists reuses the existing LGU instead of duplicating it.

## Errors are shown, not hidden behind sample data

When Supabase *is* connected but a request fails, pages used to quietly show sample data (fake LGUs that look real). The pages below now show "Couldn't load this page" with the actual reason and a **Try again** button; sample data only appears when no database is configured, with a banner saying so. Save/delete failures show the real database message instead of a generic one. This lives in one shared hook (`src/lib/data.ts`). Converted so far: Tickets, Requirements, Network, MOA Tracker, Assignments, the LGU Updates tab and the audit views.

## What's a stub (by design, given the size of the original spec)

- Editing schedules (visits) isn't built yet — LGUs, concerns, requirements, and devices are all fully editable now
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
  app/                 routes (dashboard, lgus, tickets, schedule, requirements, network, reports)
  components/
    layout/            Sidebar, TopNav, AppShell
    ui/                Button, Card, Badge, Input, EmptyState
    dashboard/         StatCard
  lib/                 supabase client, types, mock data, utils
supabase/schema.sql    database schema + RLS policies
```
