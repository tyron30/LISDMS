"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, Field } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { isSupabaseConfigured, getSupabaseClient } from "@/lib/supabase";
import { useToast } from "@/lib/toast-context";
import { logAction } from "@/lib/audit";

export function AddRequirementDialog({
  open,
  onClose,
  onCreated,
  lguOptions,
  fixedLguId,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  lguOptions: { id: string; name: string }[];
  fixedLguId?: string;
}) {
  const [lguId, setLguId] = useState(fixedLguId ?? lguOptions[0]?.id ?? "");
  const [name, setName] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    if (open) setLguId(fixedLguId ?? lguOptions[0]?.id ?? "");
  }, [open, fixedLguId, lguOptions]);

  function reset() {
    setName("");
    setDueDate("");
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isSupabaseConfigured) {
      showToast("Connect Supabase to save real requirements. This is sample data.", "error");
      return;
    }
    if (!lguId || !name) {
      showToast("LGU and requirement name are required.", "error");
      return;
    }
    setSaving(true);
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.from("requirements").insert({
        lgu_id: lguId,
        name,
        status: "pending",
        due_date: dueDate || null,
      });
      if (error) throw error;
      logAction("Added requirement", name);
      showToast("Requirement added.");
      onCreated();
      handleClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't add requirement.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} title="Add Requirement">
      <form onSubmit={handleSubmit} className="space-y-4">
        {!fixedLguId && (
          <Field label="LGU">
            <Select value={lguId} onChange={(e) => setLguId(e.target.value)} required>
              <option value="" disabled>
                Select LGU
              </option>
              {lguOptions.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
          </Field>
        )}

        <Field label="Requirement">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Signed MOA" required />
        </Field>

        <Field label="Due Date (optional)">
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </Field>

        <div className="flex justify-end gap-2 border-t border-border pt-3">
          <Button type="button" size="sm" variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? "Saving..." : "Add Requirement"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
