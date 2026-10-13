"use client";

import { useEffect, useMemo, useState } from "react";
import { Send, Loader2, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { isSupabaseConfigured, getSupabaseClient } from "@/lib/supabase";
import { useToast } from "@/lib/toast-context";
import { logAction } from "@/lib/audit";
import { useAuth } from "@/lib/use-auth";
import { mockLguNotes } from "@/lib/mock-data";
import { LguNote, NoteCategory } from "@/lib/types";
import { NOTE_CATEGORY_OPTIONS, optionLabel } from "@/lib/lgu-options";
import { DeleteConfirmDialog } from "@/components/forms/delete-confirm-dialog";
import { cn } from "@/lib/utils";

const CATEGORY_TONE: Record<NoteCategory, string> = {
  general: "bg-border/60 text-muted",
  moa: "bg-orientation/10 text-orientation",
  orientation: "bg-feedback/10 text-feedback",
  procurement: "bg-warning/10 text-warning",
  hardware: "bg-success/10 text-success",
};

const today = () => new Date().toISOString().slice(0, 10);

// Replaces the spreadsheet's "Concerns 6/9", "Concerns 7/10" ... columns and
// the MOA remarks column: a dated running log per LGU. Anyone signed in can
// add an update; only admins can delete one.
export function NotesTab({ lguId, lguName, isAdmin, reloadKey }: { lguId: string; lguName: string; isAdmin: boolean; reloadKey: number }) {
  const [notes, setNotes] = useState<LguNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<NoteCategory | "all">("all");
  const [category, setCategory] = useState<NoteCategory>("general");
  const [noteDate, setNoteDate] = useState(today());
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [deleting, setDeleting] = useState<LguNote | null>(null);
  const { showToast } = useToast();
  const { email } = useAuth();

  async function load() {
    if (!isSupabaseConfigured) {
      setNotes(mockLguNotes.filter((n) => n.lgu_id === lguId));
      setLoading(false);
      return;
    }
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("lgu_notes")
        .select("*")
        .eq("lgu_id", lguId)
        .order("note_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      setNotes((data as LguNote[]) ?? []);
    } catch {
      setNotes([]);
      showToast("Couldn't load updates. Has migration 010 been run?", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lguId, reloadKey]);

  async function handleAdd() {
    if (!body.trim()) return;
    if (!isSupabaseConfigured) {
      showToast("Connect Supabase to save real updates. This is sample data.", "error");
      return;
    }
    setPosting(true);
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.from("lgu_notes").insert({
        lgu_id: lguId,
        category,
        body: body.trim(),
        note_date: noteDate || today(),
        author_email: email,
      });
      if (error) throw error;
      logAction("Logged LGU update", `${lguName} (${optionLabel(NOTE_CATEGORY_OPTIONS, category)})`);
      setBody("");
      setNoteDate(today());
      load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't save the update.", "error");
    } finally {
      setPosting(false);
    }
  }

  const visible = useMemo(() => (filter === "all" ? notes : notes.filter((n) => n.category === filter)), [notes, filter]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 p-4">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            placeholder={`Log an update for ${lguName} — what happened, what's pending, who to follow up with...`}
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Select value={category} onChange={(e) => setCategory(e.target.value as NoteCategory)} className="w-36">
                {NOTE_CATEGORY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
              <Input type="date" value={noteDate} onChange={(e) => setNoteDate(e.target.value)} className="w-40" aria-label="Update date" />
            </div>
            <Button size="sm" onClick={handleAdd} disabled={posting || !body.trim()}>
              {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              {posting ? "Saving..." : "Add Update"}
            </Button>
          </div>
        </CardContent>
      </Card>

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

      {loading ? (
        <Skeleton className="h-32 w-full" />
      ) : visible.length === 0 ? (
        <EmptyState
          title={notes.length === 0 ? "No updates yet" : "Nothing in this category"}
          description={notes.length === 0 ? `Dated follow-ups and remarks for ${lguName} will build up here.` : "Try another filter."}
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

      {deleting && (
        <DeleteConfirmDialog
          open={!!deleting}
          onClose={() => setDeleting(null)}
          onDeleted={load}
          table="lgu_notes"
          id={deleting.id}
          itemLabel="this update"
          logLabel="Deleted LGU update"
        />
      )}
    </div>
  );
}
