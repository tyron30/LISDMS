"use client";

import { useCallback, useEffect, useState } from "react";

// Per-browser preferences (stored in localStorage, so they don't follow you
// to another computer). Applied instantly; no save button.
export type Theme = "light" | "dark" | "system";

export interface Preferences {
  theme: Theme;
  startPage: string; // where to land right after signing in
  notify: { visits: boolean; tickets: boolean; requirements: boolean; devices: boolean };
  visitWindowDays: 1 | 3 | 7; // how far ahead the bell looks for upcoming visits
}

export const DEFAULT_PREFERENCES: Preferences = {
  theme: "system",
  startPage: "/dashboard",
  notify: { visits: true, tickets: true, requirements: true, devices: true },
  visitWindowDays: 3,
};

export const START_PAGES = [
  { value: "/dashboard", label: "Dashboard" },
  { value: "/lgus", label: "LGUs" },
  { value: "/assignments", label: "Assignments" },
  { value: "/tickets", label: "Tickets" },
  { value: "/moa", label: "MOA Tracker" },
  { value: "/schedule", label: "Schedule" },
];

const KEY = "lisdms:prefs";
const CHANGED = "lisdms:prefs-changed";

export function loadPreferences(): Preferences {
  if (typeof window === "undefined") return DEFAULT_PREFERENCES;
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "null");
    // The top-bar theme toggle used its own key before preferences existed.
    const legacy = localStorage.getItem("lisdms-theme");
    const base = saved ?? (legacy === "dark" || legacy === "light" ? { theme: legacy } : {});
    return { ...DEFAULT_PREFERENCES, ...base, notify: { ...DEFAULT_PREFERENCES.notify, ...base.notify } };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function applyTheme(theme: Theme) {
  const dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

export function usePreferences() {
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFERENCES);

  useEffect(() => {
    const refresh = () => setPrefs(loadPreferences());
    refresh();
    window.addEventListener(CHANGED, refresh); // same tab
    window.addEventListener("storage", refresh); // other tabs
    return () => {
      window.removeEventListener(CHANGED, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const update = useCallback((patch: Partial<Preferences>) => {
    const next = { ...loadPreferences(), ...patch };
    localStorage.setItem(KEY, JSON.stringify(next));
    if (patch.theme) applyTheme(patch.theme);
    window.dispatchEvent(new Event(CHANGED));
  }, []);

  return { prefs, update };
}
