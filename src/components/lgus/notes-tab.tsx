"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { useSupabaseData } from "@/lib/data";
import { mockLguNotes } from "@/lib/mock-data";
import { LguNote, NoteCategory } from "@/lib/types";
import { NOTE_CATEGORY_OPTIONS, optionLabel } from "@/lib/options";
import { AddNoteDialog } from "@/components/forms/add-note-dialog";
import { DeleteConfirmDialog } from "@/components/forms/delete-confirm-dialog";
import { cn } from "@/lib/utils";

const CATEGORY_TONE: Record<NoteCategory, string> = {
  general: "bg-border/60 text-muted",
  moa: "bg-orientation/10 text-orientation",
  orientation: "bg-feedback/10 text-feedback",
  procurement: "bg-warning/10 text-warning",
  hardware: "bg-success/10 text-success",
};

// Replaces the spreadsheet's dated "Concerns 6/9", "Concerns 7/10" ... columns
// and the MOA remarks: a running log per LGU. Anyone signed in can add an
// update; only admins can delete one.
export function NotesTab({ lguId, lguName, isAdmin, reloadKey }: { lguId: string; lguName: string; isAdmin: boolean; reloadKey: number }) {
  const [filter, setFilter] = useState<NoteCategory | "all">("all");
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<LguNote | null>(null);

  const { data: notes, loading, error, reload } = useSupabaseData(
    async (sb) => {
      const { data, error } = await sb
        .from("lgu_notes")
        .select("*")
        .eq("lgu_id", lguId)
        .order("note_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as LguNote[];
    },
    { mock: mockLguNotes.filter((n) => n.lgu_id === lguId), empty: [] as LguNote[] },
    [lguId, reloadKey]
  );

  const visible = useMemo(() => (filter === "all" ? notes : notes.filter((n) => n.category === filter)), [notes, filter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {[{ value: "all", label: "All" }, ...NOTE_CATEGORY_OPTIONS].map((o) => (
            <button
              key={o.value}
              onClick={() => setFilter(o.value as NoteCategory | "all")}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                filter === o.value ? "border-brand bg-brand/10 text-brand" : "border-border text-muted hover:text-text"
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
        <Button size="sm" onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4" /> Add Update
        </Button>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : loading ? (
        <Skeleton className="h-32 w-full" />
      ) : visible.length === 0 ? (
        <EmptyState
          title={notes.length === 0 ? "No updates yet" : "Nothing in this category"}
          description={notes.length === 0 ? `Dated follow-ups and remarks for ${lguName} will build up here.` : "Try another filter."}
          actionLabel={notes.length === 0 ? "Add Update" : undefined}
          onAction={() => setAdding(true)}
        />
      ) : (
        <div className="space-y-2">
          {visible.map((n) => (
            <Card key={n.id}>
              <CardContent className="flex items-start gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium text-text">
                      {new Date(n.note_date).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                    <span className={cn("rounded-sm px-1.5 py-0.5 text-[10px] font-medium", CATEGORY_TONE[n.category])}>
                      {optionLabel(NOTE_CATEGORY_OPTIONS, n.category)}
                    </span>
                    {n.author_email && <span className="text-xs text-muted">{n.author_email}</span>}
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-text">{n.body}</p>
                </div>
                {isAdmin && (
                  <button onClick={() => setDeleting(n)} className="shrink-0 text-muted hover:text-critical" aria-label="Delete update">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AddNoteDialog open={adding} onClose={() => setAdding(false)} onSaved={reload} lguId={lguId} lguName={lguName} />
      {deleting && (
        <DeleteConfirmDialog
          open
          onClose={() => setDeleting(null)}
          onDeleted={reload}
          table="lgu_notes"
          id={deleting.id}
          itemLabel="this update"
          logLabel="Deleted LGU update"
        />
      )}
    </div>
  );
}
