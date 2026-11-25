"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useSupabaseData } from "@/lib/data";

interface AuditLog {
  id: string;
  actor: string | null;
  action: string;
  target: string | null;
  created_at: string;
}

const MOCK_LOGS: AuditLog[] = [
  { id: "a1", actor: "admin@lisdms.gov.ph", action: "Updated role to admin", target: "fieldstaff@lisdms.gov.ph", created_at: "2026-08-30T09:12:00" },
  { id: "a2", actor: "admin@lisdms.gov.ph", action: "Created LGU", target: "Sta. Fe", created_at: "2026-08-29T14:03:00" },
];

const DATE_RANGES = [
  { value: "all", label: "All time", days: 0 },
  { value: "today", label: "Today", days: 1 },
  { value: "7d", label: "Last 7 days", days: 7 },
  { value: "30d", label: "Last 30 days", days: 30 },
];

const PAGE_SIZE = 20;

// The audit trail with search, action and date filters, and paging. The same
// view serves the admin Audit Logs page (everyone's activity) and the personal
// Activity page (`actor` set: only that person's own entries).
export function AuditLogView({ actor }: { actor?: string }) {
  const [query, setQuery] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [dateRange, setDateRange] = useState("all");
  const [page, setPage] = useState(0);

  // A generous recent window is fetched and filtered in the browser; revisit
  // with server-side paging if this table ever reaches tens of thousands of rows.
  const { data: logs, loading, error, usingMock, reload } = useSupabaseData(
    async (sb) => {
      let q = sb.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(500);
      if (actor) q = q.eq("actor", actor);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as AuditLog[];
    },
    { mock: MOCK_LOGS, empty: [] as AuditLog[] },
    [actor]
  );

  const actionOptions = useMemo(() => Array.from(new Set(logs.map((l) => l.action))).sort(), [logs]);

  const filtered = useMemo(() => {
    const days = DATE_RANGES.find((r) => r.value === dateRange)?.days ?? 0;
    const q = query.trim().toLowerCase();
    return logs.filter(
      (l) =>
        (actionFilter === "all" || l.action === actionFilter) &&
        (!days || Date.now() - new Date(l.created_at).getTime() <= days * 86_400_000) &&
        (!q || `${l.actor ?? ""} ${l.action} ${l.target ?? ""}`.toLowerCase().includes(q))
    );
  }, [logs, query, actionFilter, dateRange]);

  useEffect(() => setPage(0), [query, actionFilter, dateRange]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <div className="space-y-4">
      {usingMock && (
        <p className="inline-block rounded-sm border border-warning/30 bg-warning/10 px-2 py-1 text-xs text-warning">
          Showing sample entries — connect Supabase to see the real audit trail.
        </p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input placeholder={actor ? "Search your activity..." : "Search actor, action, or target..."} className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <Select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} className="sm:w-56">
          <option value="all">All actions</option>
          {actionOptions.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </Select>
        <Select value={dateRange} onChange={(e) => setDateRange(e.target.value)} className="sm:w-40">
          {DATE_RANGES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </Select>
      </div>

      {loading ? (
        <Skeleton className="h-48 w-full" />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={logs.length === 0 ? "No activity yet" : "No matching activity"}
          description={logs.length === 0 ? "Sign-ins and changes will show up here." : "Try a different search term or filter."}
        />
      ) : (
        <>
          <Card className="divide-y divide-border p-0">
            {pageItems.map((l) => (
              <div key={l.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <p className="text-sm text-text">
                  {!actor && <span className="font-medium">{l.actor ?? "System"} </span>}
                  {actor ? <span className="font-medium">{l.action}</span> : l.action}
                  {l.target && <span className="text-muted"> — {l.target}</span>}
                </p>
                <p className="shrink-0 text-xs text-muted">
                  {new Date(l.created_at).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                </p>
              </div>
            ))}
          </Card>

          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-muted">
              <span>
                Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
              </span>
              <div className="flex items-center gap-1">
                {[
                  { label: "Previous page", icon: ChevronLeft, disabled: page === 0, go: () => setPage((p) => p - 1) },
                  { label: "Next page", icon: ChevronRight, disabled: page >= totalPages - 1, go: () => setPage((p) => p + 1) },
                ].map(({ label, icon: Icon, disabled, go }) => (
                  <button
                    key={label}
                    onClick={go}
                    disabled={disabled}
                    aria-label={label}
                    className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted hover:bg-bg hover:text-text disabled:opacity-40"
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
