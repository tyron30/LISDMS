"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, Field } from "@/components/ui/select";
import { FormFooter } from "./form-footer";
import { getSupabaseClient } from "@/lib/supabase";
import { useAction } from "@/lib/data";
import { useToast } from "@/lib/toast-context";
import { logAction } from "@/lib/audit";
import { useAuth } from "@/lib/use-auth";
import { NOTE_CATEGORY_OPTIONS, optionLabel } from "@/lib/options";
import { NoteCategory } from "@/lib/types";

const today = () => new Date().toISOString().slice(0, 10);

// Adds a dated update to an LGU's log. Used by the LGU's Updates tab, the MOA
// Tracker (category fixed to MOA) and the Assignments page. Any signed-in user
// may add one — it's a log of what happened, not a record anyone can rewrite.
export function AddNoteDialog({
  open,
  onClose,
  onSaved,
  lguId,
  lguName,
  category,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  lguId: string;
  lguName: string;
  category?: NoteCategory; // when set, the category is fixed and the picker is hidden
}) {
  const [cat, setCat] = useState<NoteCategory>(category ?? "general");
  const [date, setDate] = useState(today());
  const [body, setBody] = useState("");
  const { busy, run } = useAction();
  const { showToast } = useToast();
  const { email } = useAuth();

  useEffect(() => {
    if (open) {
      setCat(category ?? "general");
      setDate(today());
      setBody("");
    }
  }, [open, category]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    const ok = await run(async () => {
      const { error } = await getSupabaseClient()
        .from("lgu_notes")
        .insert({ lgu_id: lguId, category: cat, body: body.trim(), note_date: date || today(), author_email: email });
      if (error) throw error;
      logAction("Logged LGU update", `${lguName} (${optionLabel(NOTE_CATEGORY_OPTIONS, cat)})`);
    }, "Couldn't save the update.");
    if (ok) {
      showToast("Update saved.");
      onSaved();
      onClose();
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={`${category ? optionLabel(NOTE_CATEGORY_OPTIONS, category) + " remark" : "Add update"} — ${lguName}`}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="What happened / what's pending">
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} required placeholder="e.g. Draft MOA emailed to the Mayor's office; waiting for signature." />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          {!category && (
            <Field label="Category">
              <Select value={cat} onChange={(e) => setCat(e.target.value as NoteCategory)}>
                {NOTE_CATEGORY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field label="Date">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>
        <FormFooter busy={busy} onCancel={onClose} label="Save" />
      </form>
    </Dialog>
  );
}
