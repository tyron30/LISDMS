"use client";

import { AppShell } from "@/components/layout/app-shell";
import { AuditLogView } from "@/components/admin/audit-log-view";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/use-auth";

// Everyone's own trail: sign-ins and the changes they've made. Admins can see
// everyone's under Administration → Audit Logs.
export default function ActivityPage() {
  const { email, loading } = useAuth();
  return (
    <AppShell title="My Activity">
      <div className="mx-auto max-w-4xl space-y-4">
        <p className="text-sm text-muted">What you&apos;ve done in LISDMS — sign-ins and changes you made, newest first.</p>
        {loading ? <Skeleton className="h-48 w-full" /> : <AuditLogView actor={email ?? undefined} />}
      </div>
    </AppShell>
  );
}
