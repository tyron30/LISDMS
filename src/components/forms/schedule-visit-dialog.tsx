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
import { ScheduleEvent } from "@/lib/types";

const TYPE_OPTIONS: { value: ScheduleEvent["type"]; label: string }[] = [
  { value: "orientation", label: "Orientation" },
  { value: "network_installation", label: "Network Installation" },
  { value: "feedbacking", label: "Feedbacking" },
  { value: "critical_visit", label: "Critical Visit" },
];

export function ScheduleVisitDialog({
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
  const [title, setTitle] = useState("");
  const [type, setType] = useState<ScheduleEvent["type"]>("orientation");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    if (open) setLguId(fixedLguId ?? lguOptions[0]?.id ?? "");
  }, [open, fixedLguId, lguOptions]);

  function reset() {
    setTitle("");
    setType("orientation");
    setDate("");
    setTime("09:00");
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isSupabaseConfigured) {
      showToast("Connect Supabase to save real schedules. This is sample data.", "error");
      return;
    }
    if (!lguId || !title || !date) {
      showToast("LGU, title, and date are required.", "error");
      return;
    }
    setSaving(true);
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.from("schedules").insert({
        lgu_id: lguId,
        title,
        type,
        date,
        time,
      });
      if (error) throw error;
      logAction("Scheduled visit", title);
      showToast("Schedule created.");
      onCreated();
      handleClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't create schedule.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} title="Schedule Visit">
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

        <Field label="Visit Title">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Network Expansion Visit" required />
        </Field>

        <Field label="Visit Type">
          <Select value={type} onChange={(e) => setType(e.target.value as ScheduleEvent["type"])}>
            {TYPE_OPTIONS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Date">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </Field>
          <Field label="Time">
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
          </Field>
        </div>

        <div className="flex justify-end gap-2 border-t border-border pt-3">
          <Button type="button" size="sm" variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? "Saving..." : "Schedule Visit"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
