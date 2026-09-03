"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Building2,
  CircleAlert,
  CalendarDays,
  FileText,
  Network,
  BarChart3,
  ChevronsLeft,
  ChevronsRight,
  Users,
  ScrollText,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/use-auth";
import { useSettings } from "@/lib/settings-context";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/lgus", label: "LGUs", icon: Building2 },
  { href: "/concerns", label: "Concerns", icon: CircleAlert },
  { href: "/schedule", label: "Schedule", icon: CalendarDays },
  { href: "/requirements", label: "Requirements", icon: FileText },
  { href: "/network", label: "Network", icon: Network },
  { href: "/reports", label: "Reports", icon: BarChart3 },
];

const ADMIN_NAV = [
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/audit-logs", label: "Audit Logs", icon: ScrollText },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export function Sidebar({
  mobileOpen,
  onCloseMobile,
}: {
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const { isAdmin } = useAuth();
  const { settings } = useSettings();

  const content = (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center gap-2 border-b border-border px-4">
        {settings.logo_url ? (
          // Plain <img>, not next/image, since the logo comes from an
          // arbitrary Supabase project URL set at runtime by the admin.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={settings.logo_url}
            alt={settings.org_name}
            className="h-7 w-7 shrink-0 rounded-sm object-cover"
          />
        ) : (
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm bg-brand text-xs font-bold text-brand-fg">
            {settings.org_name.charAt(0)}
          </div>
        )}
        {!collapsed && <span className="truncate text-sm font-semibold text-text">{settings.org_name}</span>}
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
        {NAV.map((item) => {
          const active = pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              onClick={onCloseMobile}
              className={cn(
                "flex items-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
                active ? "bg-brand/10 text-brand" : "text-muted hover:bg-bg hover:text-text"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}

        {isAdmin && (
          <div className="mt-4 pt-4">
            {!collapsed && (
              <p className="px-2.5 pb-1 text-xs font-medium text-muted">Administration</p>
            )}
            {ADMIN_NAV.map((item) => {
              const active = pathname?.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  onClick={onCloseMobile}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
                    active ? "bg-brand/10 text-brand" : "text-muted hover:bg-bg hover:text-text"
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              );
            })}
          </div>
        )}
      </nav>

      <button
        onClick={() => setCollapsed((c) => !c)}
        className="hidden items-center gap-2 border-t border-border px-4 py-3 text-xs font-medium text-muted hover:text-text md:flex"
      >
        {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
        {!collapsed && "Collapse"}
      </button>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden shrink-0 border-r border-border bg-surface transition-all duration-200 md:block",
          collapsed ? "w-16" : "w-60"
        )}
      >
        {content}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={onCloseMobile} />
          <aside className="absolute left-0 top-0 h-full w-64 bg-surface shadow-card">
            {content}
          </aside>
        </div>
      )}
    </>
  );
}
