"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
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

const REQUIREMENT_STATUS_OPTIONS: { value: Requirement["status"]; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "submitted", label: "Submitted" },
  { value: "waived", label: "Waived" },
];

export default function RequirementsPage() {
  const [items, setItems] = useState<Requirement[]>([]);
  const [lguOptions, setLguOptions] = useState<{ id: string; name: string }[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deletingItem, setDeletingItem] = useState<Requirement | null>(null);
  const { isAdmin } = useAuth();

  async function load() {
    if (!isSupabaseConfigured) {
      setItems(mockRequirements);
      setLguOptions(mockLgus.map((l) => ({ id: l.id, name: l.name })));
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
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <AppShell title="Requirements">
      <div className="mx-auto max-w-4xl space-y-3">
        {isAdmin && (
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4" /> Add Requirement
            </Button>
          </div>
        )}

        {items.length === 0 ? (
          <EmptyState
            title="No requirements found"
            description="Nothing is pending across your LGUs."
            actionLabel={isAdmin ? "Add Requirement" : undefined}
            onAction={() => setDialogOpen(true)}
          />
        ) : (
          items.map((r) => (
            <Card key={r.id} className="flex items-center justify-between p-4">
              <div>
                <p className="text-sm font-medium text-text">{r.name}</p>
                <p className="text-xs text-muted">{r.lgu_name}{r.due_date ? ` • Due ${r.due_date}` : ""}</p>
              </div>
              <div className="flex items-center gap-2">
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
                  <button
                    onClick={() => setDeletingItem(r)}
                    className="text-muted hover:text-critical"
                    aria-label={`Delete ${r.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </Card>
          ))
        )}
      </div>

      <AddRequirementDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={load}
        lguOptions={lguOptions}
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
