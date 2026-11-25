"use client";

import { Sun, Moon, Monitor } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, Field } from "@/components/ui/select";
import { usePreferences, START_PAGES, Theme, Preferences } from "@/lib/preferences";
import { cn } from "@/lib/utils";

const THEMES: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "Match my computer", icon: Monitor },
];

const ALERTS: { key: keyof Preferences["notify"]; label: string; hint: string }[] = [
  { key: "visits", label: "Upcoming visits", hint: "Scheduled visits coming up soon" },
  { key: "tickets", label: "High-priority tickets", hint: "Open tickets marked high or critical" },
  { key: "requirements", label: "Overdue requirements", hint: "Pending requirements past their due date" },
  { key: "devices", label: "Offline devices", hint: "Network devices currently offline" },
];

// Saved instantly, in this browser. (They don't follow you to another computer.)
export default function PreferencesPage() {
  const { prefs, update } = usePreferences();

  return (
    <AppShell title="Preferences">
      <div className="mx-auto max-w-2xl space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {THEMES.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => update({ theme: value })}
                  aria-pressed={prefs.theme === value}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-md border px-3 py-2.5 text-sm font-medium transition-colors",
                    prefs.theme === value ? "border-brand bg-brand/10 text-brand" : "border-border text-muted hover:text-text"
                  )}
                >
                  <Icon className="h-4 w-4" /> {label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>When I sign in</CardTitle>
          </CardHeader>
          <CardContent>
            <Field label="Open this page first">
              <Select value={prefs.startPage} onChange={(e) => update({ startPage: e.target.value })} className="max-w-xs">
                {START_PAGES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </Select>
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notifications (the bell)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {ALERTS.map(({ key, label, hint }) => (
                <label key={key} className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={prefs.notify[key]}
                    onChange={(e) => update({ notify: { ...prefs.notify, [key]: e.target.checked } })}
                    className="mt-0.5 h-4 w-4 accent-brand"
                  />
                  <span>
                    <span className="block text-sm font-medium text-text">{label}</span>
                    <span className="block text-xs text-muted">{hint}</span>
                  </span>
                </label>
              ))}
            </div>
            <Field label="Look ahead for visits">
              <Select
                value={String(prefs.visitWindowDays)}
                onChange={(e) => update({ visitWindowDays: Number(e.target.value) as Preferences["visitWindowDays"] })}
                className="max-w-xs"
              >
                <option value="1">Tomorrow</option>
                <option value="3">The next 3 days</option>
                <option value="7">The next 7 days</option>
              </Select>
            </Field>
          </CardContent>
        </Card>

        <p className="text-xs text-muted">Changes apply immediately and are saved in this browser only.</p>
      </div>
    </AppShell>
  );
}
