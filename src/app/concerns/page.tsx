"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { isSupabaseConfigured, getSupabaseClient } from "@/lib/supabase";
import { useAuth } from "@/lib/use-auth";
import { mockConcerns, mockLgus } from "@/lib/mock-data";
import { Concern } from "@/lib/types";
import { NewConcernDialog } from "@/components/forms/new-concern-dialog";
import { InlineStatusSelect } from "@/components/forms/inline-status-select";

const CONCERN_STATUS_OPTIONS: { value: Concern["status"]; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "resolved", label: "Resolved" },
];

const SEVERITY_COLOR: Record<Concern["severity"], string> = {
  low: "text-muted",
  medium: "text-warning",
  high: "text-warning",
  critical: "text-critical",
};

export default function ConcernsPage() {
  const [concerns, setConcerns] = useState<Concern[]>([]);
  const [lguOptions, setLguOptions] = useState<{ id: string; name: string }[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { isAdmin } = useAuth();

  async function load() {
    if (!isSupabaseConfigured) {
      setConcerns(mockConcerns);
      setLguOptions(mockLgus.map((l) => ({ id: l.id, name: l.name })));
      return;
    }
    try {
      const supabase = getSupabaseClient();
      const [concernsRes, lgusRes] = await Promise.all([
        // Concerns only store lgu_id — join lgus to get a display name.
        supabase.from("concerns").select("*, lgus(name)").order("created_at", { ascending: false }),
        supabase.from("lgus").select("id, name").order("name"),
      ]);
      const mapped = (concernsRes.data ?? []).map((row: Record<string, unknown>) => ({
        ...row,
        lgu_name: (row.lgus as { name?: string } | null)?.name ?? "Unknown LGU",
      })) as Concern[];
      setConcerns(mapped);
      setLguOptions((lgusRes.data as { id: string; name: string }[]) ?? []);
    } catch {
      setConcerns(mockConcerns);
      setLguOptions(mockLgus.map((l) => ({ id: l.id, name: l.name })));
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <AppShell title="Concerns">
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted">{concerns.length} concern(s) on record</p>
          {isAdmin && (
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4" /> New Concern
            </Button>
          )}
        </div>

        {concerns.length === 0 ? (
          <EmptyState
            title="No concerns found"
            description="There are no open concerns right now."
            actionLabel={isAdmin ? "Create Concern" : undefined}
            onAction={() => setDialogOpen(true)}
          />
        ) : (
          <div className="space-y-2">
            {concerns.map((c) => (
              <Card key={c.id} className="flex items-center justify-between p-4">
                <div>
                  <p className="text-sm font-medium text-text">{c.title}</p>
                  <p className="text-xs text-muted">{c.lgu_name} • {c.category} • {c.created_at}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium capitalize ${SEVERITY_COLOR[c.severity]}`}>
                    {c.severity}
                  </span>
                  {isAdmin ? (
                    <InlineStatusSelect
                      table="concerns"
                      id={c.id}
                      value={c.status}
                      options={CONCERN_STATUS_OPTIONS}
                      logLabel="Updated concern status"
                      target={c.title}
                      onUpdated={(newStatus) =>
                        setConcerns((prev) => prev.map((x) => (x.id === c.id ? { ...x, status: newStatus } : x)))
                      }
                      className="w-32"
                    />
                  ) : (
                    <Badge className="capitalize">{c.status.replace("_", " ")}</Badge>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <NewConcernDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={load}
        lguOptions={lguOptions}
      />
    </AppShell>
  );
}
