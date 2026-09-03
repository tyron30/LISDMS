"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { AdminGuard } from "@/components/admin/admin-guard";
import { Card } from "@/components/ui/card";
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

function AuditLogsContent() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [usingMock, setUsingMock] = useState(false);

  useEffect(() => {
    async function load() {
      if (!isSupabaseConfigured) {
        setLogs(MOCK_LOGS);
        setUsingMock(true);
        return;
      }
      try {
        const supabase = getSupabaseClient();
        const { data } = await supabase
          .from("audit_logs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(100);
        setLogs((data as AuditLog[]) ?? []);
      } catch {
        setLogs(MOCK_LOGS);
        setUsingMock(true);
      }
    }
    load();
  }, []);

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      {usingMock && (
        <p className="inline-block rounded-sm border border-warning/30 bg-warning/10 px-2 py-1 text-xs text-warning">
          Showing sample entries — connect Supabase to see the real audit trail.
        </p>
      )}

      {logs.length === 0 ? (
        <EmptyState title="No activity yet" description="Actions like sign-ins, role changes, and creating LGUs/concerns/schedules will show up here." />
      ) : (
        <Card className="divide-y divide-border p-0">
          {logs.map((log) => (
            <div key={log.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm text-text">
                  <span className="font-medium">{log.actor ?? "System"}</span> {log.action}
                  {log.target && <span className="text-muted"> — {log.target}</span>}
                </p>
              </div>
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
