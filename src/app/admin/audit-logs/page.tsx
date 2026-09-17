"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { AdminGuard } from "@/components/admin/admin-guard";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { isSupabaseConfigured, getSupabaseClient } from "@/lib/supabase";

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
  { value: "all", label: "All time" },
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
];

const PAGE_SIZE = 20;

function AuditLogsContent() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [usingMock, setUsingMock] = useState(false);
  const [query, setQuery] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [dateRange, setDateRange] = useState("all");
  const [page, setPage] = useState(0);

  useEffect(() => {
    async function load() {
      if (!isSupabaseConfigured) {
        setLogs(MOCK_LOGS);
        setUsingMock(true);
        return;
      }
      try {
        const supabase = getSupabaseClient();
        // Fetch a generous recent window client-side, then filter/paginate
        // in the browser — audit tables are read-heavy and rarely need
        // server-side search for a team this size. Revisit with a real
        // paginated query if this table grows into the tens of thousands.
        const { data } = await supabase
          .from("audit_logs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(500);
        setLogs((data as AuditLog[]) ?? []);
      } catch {
        setLogs(MOCK_LOGS);
        setUsingMock(true);
      }
    }
    load();
  }, []);

  const actionOptions = useMemo(() => {
    const unique = Array.from(new Set(logs.map((l) => l.action))).sort();
    return unique;
  }, [logs]);

  const filtered = useMemo(() => {
    const now = Date.now();
    const rangeMs = dateRange === "today" ? 24 * 60 * 60 * 1000 : dateRange === "7d" ? 7 * 24 * 60 * 60 * 1000 : dateRange === "30d" ? 30 * 24 * 60 * 60 * 1000 : null;
    const lowerQuery = query.trim().toLowerCase();

    return logs.filter((log) => {
      if (actionFilter !== "all" && log.action !== actionFilter) return false;
      if (rangeMs && now - new Date(log.created_at).getTime() > rangeMs) return false;
      if (lowerQuery) {
        const haystack = `${log.actor ?? ""} ${log.action} ${log.target ?? ""}`.toLowerCase();
        if (!haystack.includes(lowerQuery)) return false;
      }
      return true;
    });
  }, [logs, query, actionFilter, dateRange]);

  // Reset to page 1 whenever the filters actually change the result set.
  useEffect(() => setPage(0), [query, actionFilter, dateRange]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      {usingMock && (
        <p className="inline-block rounded-sm border border-warning/30 bg-warning/10 px-2 py-1 text-xs text-warning">
          Showing sample entries — connect Supabase to see the real audit trail.
        </p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input
            placeholder="Search actor, action, or target..."
            className="pl-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
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

      {filtered.length === 0 ? (
        <EmptyState
          title={logs.length === 0 ? "No activity yet" : "No matching activity"}
          description={
            logs.length === 0
              ? "Actions like sign-ins, role changes, and creating LGUs/tickets/schedules will show up here."
              : "Try a different search term or filter."
          }
        />
      ) : (
        <>
          <Card className="divide-y divide-border p-0">
            {pageItems.map((log) => (
              <div key={log.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <p className="text-sm text-text">
                  <span className="font-medium">{log.actor ?? "System"}</span> {log.action}
                  {log.target && <span className="text-muted"> — {log.target}</span>}
                </p>
                <p className="shrink-0 text-xs text-muted">
                  {new Date(log.created_at).toLocaleString("en-PH", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
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
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted hover:bg-bg hover:text-text disabled:opacity-40"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted hover:bg-bg hover:text-text disabled:opacity-40"
                  aria-label="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function AuditLogsPage() {
  return (
    <AppShell title="Audit Logs">
      <AdminGuard>
        <AuditLogsContent />
      </AdminGuard>
    </AppShell>
  );
}
