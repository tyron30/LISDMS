// Browser-session bookkeeping for the "close the app, reopen it, and you're
// back on the login page" rule.
//
// The auth cookie itself is a session cookie (see supabase.ts / middleware.ts),
// which handles closing the whole browser. This covers the rest: closing the
// last tab while the browser stays open. Each open tab registers itself in
// localStorage; a tab with no id of its own that finds no other live tab is a
// brand-new browser session. Reloads and navigating within a tab keep the
// tab's sessionStorage id, and opening another tab while one is open finds a
// live registrant — neither is treated as new.

const TABS_KEY = "lisdms:tabs";
const TAB_ID_KEY = "lisdms:tab-id";
const LOGIN_AT_KEY = "lisdms:login-at";

const LIVE_MS = 10 * 60 * 1000; // a tab that hasn't beaten for this long is considered gone (crash)
export const MAX_SESSION_MS = 12 * 60 * 60 * 1000; // absolute cap, regardless of activity

type Tabs = Record<string, number>;

function readTabs(now: number): Tabs {
  try {
    const raw = JSON.parse(localStorage.getItem(TABS_KEY) || "{}") as Tabs;
    return Object.fromEntries(Object.entries(raw).filter(([, t]) => now - t < LIVE_MS));
  } catch {
    return {};
  }
}

function tabId() {
  let id = sessionStorage.getItem(TAB_ID_KEY);
  if (!id) {
    id = (typeof crypto !== "undefined" && crypto.randomUUID?.()) || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem(TAB_ID_KEY, id);
  }
  return id;
}

// Mark this tab as alive (also (re)creates its id).
export function heartbeat() {
  const now = Date.now();
  const tabs = readTabs(now);
  tabs[tabId()] = now;
  localStorage.setItem(TABS_KEY, JSON.stringify(tabs));
}

// This tab is going away (closed / navigated off-site). Same-tab reloads keep
// the sessionStorage id, so removing the entry here is safe.
export function leaveTab() {
  const id = sessionStorage.getItem(TAB_ID_KEY);
  if (!id) return;
  const tabs = readTabs(Date.now());
  delete tabs[id];
  localStorage.setItem(TABS_KEY, JSON.stringify(tabs));
}

// Call right after a successful sign-in.
export function startSession() {
  localStorage.setItem(LOGIN_AT_KEY, String(Date.now()));
  heartbeat();
}

export function endSession() {
  localStorage.removeItem(LOGIN_AT_KEY);
  leaveTab();
}

export type SessionVerdict = "ok" | "closed" | "expired";

// Run once per page load, only when the user appears to be signed in.
export function checkSession(): SessionVerdict {
  const now = Date.now();
  const hasOwnId = !!sessionStorage.getItem(TAB_ID_KEY);
  if (!hasOwnId && Object.keys(readTabs(now)).length === 0) return "closed";

  const loginAt = Number(localStorage.getItem(LOGIN_AT_KEY));
  if (loginAt && now - loginAt > MAX_SESSION_MS) return "expired";
  if (!loginAt) localStorage.setItem(LOGIN_AT_KEY, String(now)); // sessions that predate this check

  heartbeat();
  return "ok";
}
