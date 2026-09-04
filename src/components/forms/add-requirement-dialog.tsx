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
import { Requirement } from "@/lib/types";

const STATUS_OPTIONS: Requirement["status"][] = ["pending", "submitted", "waived"];

// Handles both "Add Requirement" (no `requirement` prop) and "Edit
// Requirement" (pass the existing row), same pattern as AddLguDialog.
export function AddRequirementDialog({
  open,
  onClose,
  onCreated,
  lguOptions,
  fixedLguId,
  requirement,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  lguOptions: { id: string; name: string }[];
  fixedLguId?: string;
  requirement?: Requirement;
}) {
  const isEdit = Boolean(requirement);
  const [lguId, setLguId] = useState(requirement?.lgu_id ?? fixedLguId ?? lguOptions[0]?.id ?? "");
  const [name, setName] = useState(requirement?.name ?? "");
  const [dueDate, setDueDate] = useState(requirement?.due_date ?? "");
  const [status, setStatus] = useState<Requirement["status"]>(requirement?.status ?? "pending");
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    if (open) {
      setLguId(requirement?.lgu_id ?? fixedLguId ?? lguOptions[0]?.id ?? "");
      setName(requirement?.name ?? "");
      setDueDate(requirement?.due_date ?? "");
      setStatus(requirement?.status ?? "pending");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, requirement?.id]);

  function handleClose() {
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

      if (isEdit && requirement) {
        const { error } = await supabase
          .from("requirements")
          .update({ lgu_id: lguId, name, status, due_date: dueDate || null })
          .eq("id", requirement.id);
        if (error) throw error;
        logAction("Updated requirement", name);
        showToast("Requirement updated.");
      } else {
        const { error } = await supabase.from("requirements").insert({
          lgu_id: lguId,
          name,
          status: "pending",
          due_date: dueDate || null,
        });
        if (error) throw error;
        logAction("Added requirement", name);
        showToast("Requirement added.");
      }

      onCreated();
      handleClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't save requirement.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} title={isEdit ? "Edit Requirement" : "Add Requirement"}>
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

        {isEdit && (
          <Field label="Status">
            <Select value={status} onChange={(e) => setStatus(e.target.value as Requirement["status"])}>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s} className="capitalize">
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </Select>
          </Field>
        )}

        <div className="flex justify-end gap-2 border-t border-border pt-3">
          <Button type="button" size="sm" variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? "Saving..." : isEdit ? "Save Changes" : "Add Requirement"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
