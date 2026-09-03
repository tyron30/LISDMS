import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";

export default function ActivityPage() {
  return (
    <AppShell title="Activity">
      <div className="mx-auto max-w-2xl">
        <Card className="p-8 text-center text-sm text-muted">
          Personal activity feed — scaffolded, ready to read from the
          <code className="mx-1 rounded bg-bg px-1.5 py-0.5 font-mono text-xs">audit_logs</code>
          table filtered to the signed-in user.
        </Card>
      </div>
    </AppShell>
  );
}
