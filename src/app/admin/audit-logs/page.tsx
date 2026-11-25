"use client";

import { AppShell } from "@/components/layout/app-shell";
import { AdminGuard } from "@/components/admin/admin-guard";
import { AuditLogView } from "@/components/admin/audit-log-view";

export default function AuditLogsPage() {
  return (
    <AppShell title="Audit Logs">
      <AdminGuard>
        <div className="mx-auto max-w-4xl">
          <AuditLogView />
        </div>
      </AdminGuard>
    </AppShell>
  );
}
