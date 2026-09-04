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
import { mockRequirements, mockLgus } from "@/lib/mock-data";
import { Requirement } from "@/lib/types";
import { AddRequirementDialog } from "@/components/forms/add-requirement-dialog";
import { InlineStatusSelect } from "@/components/forms/inline-status-select";
import { DeleteConfirmDialog } from "@/components/forms/delete-confirm-dialog";
import { ListSkeleton } from "@/components/ui/skeleton";

const REQUIREMENT_STATUS_OPTIONS: { value: Requirement["status"]; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "submitted", label: "Submitted" },
  { value: "waived", label: "Waived" },
];

function isOverdue(r: Requirement) {
  if (r.status !== "pending" || !r.due_date) return false;
  return r.due_date < new Date().toISOString().slice(0, 10);
}

export default function RequirementsPage() {
  const [items, setItems] = useState<Requirement[]>([]);
  const [lguOptions, setLguOptions] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Requirement | null>(null);
  const [deletingItem, setDeletingItem] = useState<Requirement | null>(null);
  const { isAdmin } = useAuth();

  async function load() {
    if (!isSupabaseConfigured) {
      setItems(mockRequirements);
      setLguOptions(mockLgus.map((l) => ({ id: l.id, name: l.name })));
      setLoading(false);
      return;
    }
    try {
      const supabase = getSupabaseClient();
      const [reqRes, lgusRes] = await Promise.all([
        supabase.from("requirements").select("*, lgus(name)"),
        supabase.from("lgus").select("id, name").order("name"),
      ]);
      const mapped = (reqRes.data ?? []).map((row: Record<string, unknown>) => ({
        ...row,
        lgu_name: (row.lgus as { name?: string } | null)?.name ?? "Unknown LGU",
      })) as Requirement[];
      setItems(mapped);
      setLguOptions((lgusRes.data as { id: string; name: string }[]) ?? []);
    } catch {
      setItems(mockRequirements);
      setLguOptions(mockLgus.map((l) => ({ id: l.id, name: l.name })));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <AppShell title="Requirements">
      <div className="mx-auto max-w-4xl space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted">{loading ? "Loading…" : `${items.length} requirement(s)`}</p>
          {isAdmin && (
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4" /> Add Requirement
            </Button>
          )}
        </div>

        {loading ? (
          <ListSkeleton rows={4} />
        ) : items.length === 0 ? (
          <EmptyState
            title="No requirements found"
            description="Nothing is pending across your LGUs."
            actionLabel={isAdmin ? "Add Requirement" : undefined}
            onAction={() => setDialogOpen(true)}
          />
        ) : (
          items.map((r) => {
            const overdue = isOverdue(r);
            return (
              <Card key={r.id} className="flex items-center justify-between gap-3 p-4 transition-colors hover:bg-bg/40">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-text">{r.name}</p>
                  <p className="truncate text-xs text-muted">
                    <Link href={`/lgus/${r.lgu_id}`} className="hover:text-brand hover:underline">
                      {r.lgu_name}
                    </Link>
                    {r.due_date && (
                      <span className={overdue ? "font-medium text-critical" : ""}>
                        {" "}
                        • {overdue ? "Overdue since" : "Due"} {r.due_date}
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {isAdmin ? (
                    <InlineStatusSelect
                      table="requirements"
                      id={r.id}
                      value={r.status}
                      options={REQUIREMENT_STATUS_OPTIONS}
                      logLabel="Updated requirement status"
                      target={r.name}
                      onUpdated={(newStatus) =>
                        setItems((prev) => prev.map((x) => (x.id === r.id ? { ...x, status: newStatus } : x)))
                      }
                      className="w-32"
                    />
                  ) : (
                    <Badge className="capitalize">{r.status}</Badge>
                  )}
                  {isAdmin && (
                    <div className="flex items-center gap-2 border-l border-border pl-2">
                      <button
                        onClick={() => setEditingItem(r)}
                        className="text-muted hover:text-text"
                        aria-label={`Edit ${r.name}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setDeletingItem(r)}
                        className="text-muted hover:text-critical"
                        aria-label={`Delete ${r.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })
        )}
      </div>

      <AddRequirementDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={load}
        lguOptions={lguOptions}
      />
      <AddRequirementDialog
        open={!!editingItem}
        onClose={() => setEditingItem(null)}
        onCreated={load}
        lguOptions={lguOptions}
        requirement={editingItem ?? undefined}
      />
      {deletingItem && (
        <DeleteConfirmDialog
          open={!!deletingItem}
          onClose={() => setDeletingItem(null)}
          onDeleted={load}
          table="requirements"
          id={deletingItem.id}
          itemLabel={deletingItem.name}
          logLabel="Deleted requirement"
        />
      )}
    </AppShell>
  );
}
