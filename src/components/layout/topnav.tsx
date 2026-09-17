"use client";

import { Bell, Menu, Search, Moon, Sun, User, Settings, Activity, LogOut, CalendarClock, CircleAlert, FileWarning } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/use-auth";
import { getSupabaseClient } from "@/lib/supabase";
import { useCommandPalette } from "@/lib/command-palette-context";
import { getNotifications, AppNotification } from "@/lib/notifications";

function initialsFor(email: string | null) {
  if (!email) return "?";
  const name = email.split("@")[0];
  return name.slice(0, 2).toUpperCase();
}

const SEVERITY_ICON: Record<AppNotification["severity"], typeof CalendarClock> = {
  info: CalendarClock,
  warning: FileWarning,
  critical: CircleAlert,
};

const SEVERITY_COLOR: Record<AppNotification["severity"], string> = {
  info: "text-orientation",
  warning: "text-warning",
  critical: "text-critical",
};

function NotificationsMenu() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const results = await getNotifications();
      if (!cancelled) {
        setItems(results);
        setLoading(false);
      }
    }
    load();
    // Refresh periodically so the badge count stays reasonably current
    // without needing a realtime subscription.
    const interval = setInterval(load, 5 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function goTo(n: AppNotification) {
    setOpen(false);
    router.push(n.href ?? `/lgus/${n.lguId}`);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-9 w-9 items-center justify-center rounded-md text-muted hover:bg-bg hover:text-text"
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        {items.length > 0 && (
          <span className="absolute right-1.5 top-1.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-critical px-0.5 text-[9px] font-semibold text-white">
            {items.length > 9 ? "9+" : items.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-80 rounded-md border border-border bg-surface py-1 shadow-card">
          <div className="border-b border-border px-3 py-2">
            <p className="text-sm font-medium text-text">Notifications</p>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {loading && <p className="px-3 py-6 text-center text-sm text-muted">Loading…</p>}
            {!loading && items.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-muted">You&apos;re all caught up.</p>
            )}
            {items.map((n) => {
              const Icon = SEVERITY_ICON[n.severity];
              return (
                <button
                  key={n.id}
                  onClick={() => goTo(n)}
                  className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left hover:bg-bg"
                >
                  <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${SEVERITY_COLOR[n.severity]}`} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-text">{n.title}</p>
                    <p className="truncate text-xs text-muted">{n.detail}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function UserMenu() {
  const { email, profile, isAdmin, isSupabaseConfigured } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function handleLogout() {
    if (isSupabaseConfigured) {
      const supabase = getSupabaseClient();
      await supabase.auth.signOut();
    }
    setOpen(false);
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="relative ml-1" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-brand text-xs font-semibold text-brand-fg"
        aria-label="User menu"
      >
        {profile?.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
        ) : (
          initialsFor(email)
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-56 rounded-md border border-border bg-surface py-1 shadow-card">
          <div className="border-b border-border px-3 py-2">
            <p className="truncate text-sm font-medium text-text">{email ?? "Not signed in"}</p>
            {isSupabaseConfigured ? (
              <p className="text-xs capitalize text-muted">{isAdmin ? "Admin" : "Viewer"}</p>
            ) : (
              <p className="text-xs text-muted">Sample data mode</p>
            )}
          </div>
          <Link
            href="/profile"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-text hover:bg-bg"
          >
            <User className="h-4 w-4 text-muted" /> Profile
          </Link>
          <Link
            href="/preferences"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-text hover:bg-bg"
          >
            <Settings className="h-4 w-4 text-muted" /> Preferences
          </Link>
          <Link
            href="/activity"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-text hover:bg-bg"
          >
            <Activity className="h-4 w-4 text-muted" /> Activity
          </Link>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2 border-t border-border px-3 py-2 text-sm text-critical hover:bg-critical/5"
          >
            <LogOut className="h-4 w-4" /> Logout
          </button>
        </div>
      )}
    </div>
  );
}

export function TopNav({
  title,
  onOpenMobile,
}: {
  title: string;
  onOpenMobile: () => void;
}) {
  const [dark, setDark] = useState(false);
  const { setOpen: openPalette } = useCommandPalette();

  useEffect(() => {
    const stored = typeof window !== "undefined" && localStorage.getItem("lisdms-theme");
    const prefersDark =
      typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
    const shouldBeDark = stored ? stored === "dark" : prefersDark;
    setDark(shouldBeDark);
    document.documentElement.classList.toggle("dark", shouldBeDark);
  }, []);

  function toggleDark() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("lisdms-theme", next ? "dark" : "light");
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-surface px-3 md:px-4">
      <button className="md:hidden" onClick={onOpenMobile} aria-label="Open menu">
        <Menu className="h-5 w-5 text-text" />
      </button>

      <h1 className="hidden text-sm font-semibold text-text md:block">{title}</h1>

      <div className="ml-auto flex flex-1 items-center gap-2 md:flex-initial">
        <button
          onClick={() => openPalette(true)}
          className="relative hidden flex-1 items-center rounded-md border border-border bg-surface px-3 text-left text-sm text-muted hover:bg-bg md:flex md:w-72"
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="ml-2 flex-1 truncate">Search LGUs, tickets, schedules...</span>
          <kbd className="shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] text-muted">
            Ctrl K
          </kbd>
        </button>

        <button
          onClick={() => openPalette(true)}
          className="flex h-9 w-9 items-center justify-center rounded-md text-muted hover:bg-bg hover:text-text md:hidden"
          aria-label="Search"
        >
          <Search className="h-4.5 w-4.5" />
        </button>

        <button
          onClick={toggleDark}
          className="flex h-9 w-9 items-center justify-center rounded-md text-muted hover:bg-bg hover:text-text"
          aria-label="Toggle dark mode"
        >
          {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        <NotificationsMenu />

        <UserMenu />
      </div>
    </header>
  );
}
