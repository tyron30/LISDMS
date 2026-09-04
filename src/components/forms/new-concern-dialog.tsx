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
import { Concern } from "@/lib/types";

const SEVERITY_OPTIONS: Concern["severity"][] = ["low", "medium", "high", "critical"];
const STATUS_OPTIONS: Concern["status"][] = ["open", "in_progress", "resolved"];

// Handles both "New Concern" (no `concern` prop) and "Edit Concern" (pass
// the existing row), same pattern as AddLguDialog.
export function NewConcernDialog({
  open,
  onClose,
  onCreated,
  lguOptions,
  fixedLguId,
  concern,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  lguOptions: { id: string; name: string }[];
  fixedLguId?: string;
  concern?: Concern;
}) {
  const isEdit = Boolean(concern);
  const [lguId, setLguId] = useState(concern?.lgu_id ?? fixedLguId ?? lguOptions[0]?.id ?? "");
  const [title, setTitle] = useState(concern?.title ?? "");
  const [category, setCategory] = useState(concern?.category ?? "");
  const [severity, setSeverity] = useState<Concern["severity"]>(concern?.severity ?? "medium");
  const [status, setStatus] = useState<Concern["status"]>(concern?.status ?? "open");
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    if (open) {
      setLguId(concern?.lgu_id ?? fixedLguId ?? lguOptions[0]?.id ?? "");
      setTitle(concern?.title ?? "");
      setCategory(concern?.category ?? "");
      setSeverity(concern?.severity ?? "medium");
      setStatus(concern?.status ?? "open");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, concern?.id]);

  function handleClose() {
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isSupabaseConfigured) {
      showToast("Connect Supabase to save real concerns. This is sample data.", "error");
      return;
    }
    if (!lguId || !title) {
      showToast("LGU and title are required.", "error");
      return;
    }
    setSaving(true);
    try {
      const supabase = getSupabaseClient();

      if (isEdit && concern) {
        const { error } = await supabase
          .from("concerns")
          .update({ lgu_id: lguId, title, category: category || null, severity, status })
          .eq("id", concern.id);
        if (error) throw error;
        logAction("Updated concern", title);
        showToast("Concern updated.");
      } else {
        const { error } = await supabase.from("concerns").insert({
          lgu_id: lguId,
          title,
          category: category || null,
          severity,
          status: "open",
        });
        if (error) throw error;
        logAction("Created concern", title);
        showToast("Concern created successfully.");
      }

      onCreated();
      handleClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't save concern.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} title={isEdit ? "Edit Concern" : "New Concern"}>
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

        <Field label="Title">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Short summary of the issue" required />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Category">
            <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Network, Hardware" />
          </Field>
          <Field label="Severity">
            <Select value={severity} onChange={(e) => setSeverity(e.target.value as Concern["severity"])}>
              {SEVERITY_OPTIONS.map((s) => (
                <option key={s} value={s} className="capitalize">
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {isEdit && (
          <Field label="Status">
            <Select value={status} onChange={(e) => setStatus(e.target.value as Concern["status"])}>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s === "in_progress" ? "In Progress" : s.charAt(0).toUpperCase() + s.slice(1)}
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
            {saving ? "Saving..." : isEdit ? "Save Changes" : "Create Concern"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
