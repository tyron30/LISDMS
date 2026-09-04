"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2 } from "lucide-react";
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
import { DeleteConfirmDialog } from "@/components/forms/delete-confirm-dialog";
import { ListSkeleton } from "@/components/ui/skeleton";

const CONCERN_STATUS_OPTIONS: { value: Concern["status"]; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "resolved", label: "Resolved" },
];

const SEVERITY_DOT: Record<Concern["severity"], string> = {
  low: "bg-muted",
  medium: "bg-warning",
  high: "bg-warning",
  critical: "bg-critical",
};

export default function ConcernsPage() {
  const [concerns, setConcerns] = useState<Concern[]>([]);
  const [lguOptions, setLguOptions] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingConcern, setEditingConcern] = useState<Concern | null>(null);
  const [deletingConcern, setDeletingConcern] = useState<Concern | null>(null);
  const { isAdmin } = useAuth();

  async function load() {
    if (!isSupabaseConfigured) {
      setConcerns(mockConcerns);
      setLguOptions(mockLgus.map((l) => ({ id: l.id, name: l.name })));
      setLoading(false);
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
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <AppShell title="Concerns">
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted">
            {loading ? "Loading…" : `${concerns.length} concern(s) on record`}
          </p>
          {isAdmin && (
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4" /> New Concern
            </Button>
          )}
        </div>

        {loading ? (
          <ListSkeleton rows={4} />
        ) : concerns.length === 0 ? (
          <EmptyState
            title="No concerns found"
            description="There are no open concerns right now."
            actionLabel={isAdmin ? "Create Concern" : undefined}
            onAction={() => setDialogOpen(true)}
          />
        ) : (
          <div className="space-y-2">
            {concerns.map((c) => (
              <Card key={c.id} className="flex items-center gap-3 p-4 transition-colors hover:bg-bg/40">
                <span className={`h-2 w-2 shrink-0 rounded-full ${SEVERITY_DOT[c.severity]}`} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-text">{c.title}</p>
                  <p className="truncate text-xs text-muted">
                    <Link href={`/lgus/${c.lgu_id}`} className="hover:text-brand hover:underline">
                      {c.lgu_name}
                    </Link>
                    {c.category ? ` • ${c.category}` : ""} •{" "}
                    {new Date(c.created_at).toLocaleDateString("en-PH", { month: "short", day: "numeric" })}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="hidden text-xs font-medium capitalize text-muted sm:inline">{c.severity}</span>
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
                  {isAdmin && (
                    <div className="flex items-center gap-2 border-l border-border pl-3">
                      <button
                        onClick={() => setEditingConcern(c)}
                        className="text-muted hover:text-text"
                        aria-label={`Edit ${c.title}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setDeletingConcern(c)}
                        className="text-muted hover:text-critical"
                        aria-label={`Delete ${c.title}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
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
      <NewConcernDialog
        open={!!editingConcern}
        onClose={() => setEditingConcern(null)}
        onCreated={load}
        lguOptions={lguOptions}
        concern={editingConcern ?? undefined}
      />
      {deletingConcern && (
        <DeleteConfirmDialog
          open={!!deletingConcern}
          onClose={() => setDeletingConcern(null)}
          onDeleted={load}
          table="concerns"
          id={deletingConcern.id}
          itemLabel={deletingConcern.title}
          logLabel="Deleted concern"
        />
      )}
    </AppShell>
  );
}
