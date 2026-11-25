"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, Field } from "@/components/ui/select";
import { FormFooter } from "./form-footer";
import { LguSelectField } from "./lgu-select-field";
import { LguNameAutocomplete } from "./lgu-name-autocomplete";
import { getSupabaseClient } from "@/lib/supabase";
import { useAction } from "@/lib/data";
import { useToast } from "@/lib/toast-context";
import { logAction } from "@/lib/audit";
import { designationFor } from "@/lib/leyte-towns";
import { ScheduleEvent } from "@/lib/types";
import { TYPE_LABEL } from "@/components/calendar/event-style";

const NEW_LGU = "__new__";
const TYPE_OPTIONS = Object.entries(TYPE_LABEL) as [ScheduleEvent["type"], string][];

// Handles both "Schedule Visit" (no `schedule` prop) and "Edit Visit".
// The LGU can also be one that isn't in the system yet — e.g. a first
// courtesy visit to a town that hasn't been onboarded. Picking "New LGU"
// creates it (status "For Deployment") together with the visit, so the visit
// and everything that follows stay attached to one record.
export function ScheduleVisitDialog({
  open,
  onClose,
  onCreated,
  lguOptions,
  fixedLguId,
  schedule,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  lguOptions: { id: string; name: string }[];
  fixedLguId?: string;
  schedule?: ScheduleEvent;
}) {
  const isEdit = Boolean(schedule);
  const [lguId, setLguId] = useState("");
  const [newName, setNewName] = useState("");
  const [newDistrict, setNewDistrict] = useState<string | null>(null);
  const [newDesignation, setNewDesignation] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<ScheduleEvent["type"]>("orientation");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const { busy, run } = useAction();
  const { showToast } = useToast();

  useEffect(() => {
    if (!open) return;
    setLguId(schedule?.lgu_id ?? fixedLguId ?? lguOptions[0]?.id ?? "");
    setNewName("");
    setNewDistrict(null);
    setNewDesignation(null);
    setTitle(schedule?.title ?? "");
    setType(schedule?.type ?? "orientation");
    setDate(schedule?.date ?? "");
    setTime(schedule?.time ?? "09:00");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, schedule?.id]);

  const isNew = lguId === NEW_LGU;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!lguId || !title || !date || (isNew && !name)) {
      showToast(isNew && !name ? "Enter the name of the new LGU." : "LGU, title, and date are required.", "error");
      return;
    }
    // Typed a name that's already in the system? Use that LGU, don't duplicate it.
    const existing = isNew ? lguOptions.find((l) => l.name.toLowerCase() === name.toLowerCase()) : undefined;

    const ok = await run(async () => {
      const sb = getSupabaseClient();
      let targetId = existing ? existing.id : lguId;

      if (isNew && !existing) {
        const { data, error } = await sb
          .from("lgus")
          .insert({ name, province: "Leyte", district: newDistrict, designation: newDesignation, status: "for_deployment" })
          .select("id")
          .single();
        if (error) throw error;
        targetId = data.id;
        logAction("Created LGU", name);
      }

      const payload = { lgu_id: targetId, title, type, date, time };
      const { error } =
        isEdit && schedule
          ? await sb.from("schedules").update(payload).eq("id", schedule.id)
          : await sb.from("schedules").insert(payload);
      if (error) throw error;
      logAction(isEdit ? "Updated schedule" : "Scheduled visit", title);
    }, "Couldn't save the schedule.");

    if (ok) {
      showToast(isNew && !existing ? `${name} added as a new LGU, and the visit scheduled.` : isEdit ? "Schedule updated." : "Schedule created.");
      onCreated();
      onClose();
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={isEdit ? "Edit Visit" : "Schedule Visit"}>
      <form onSubmit={submit} className="space-y-4">
        <LguSelectField
          value={lguId}
          onChange={setLguId}
          options={lguOptions}
          fixed={!!fixedLguId}
          extra={[{ value: NEW_LGU, label: "＋ New LGU (not in the system yet)…" }]}
        />

        {isNew && (
          <div className="space-y-2 rounded-md border border-dashed border-border p-3">
            <Field label="New LGU name">
              <LguNameAutocomplete
                value={newName}
                onChange={(v) => {
                  setNewName(v);
                  setNewDistrict(null);
                  setNewDesignation(null);
                }}
                onSelectTown={(t) => {
                  setNewDistrict(t.district);
                  setNewDesignation(designationFor(t.name));
                }}
                exclude={lguOptions.map((l) => l.name)}
              />
            </Field>
            <p className="text-xs text-muted">
              {newDistrict ? `${newDistrict}. ` : ""}It&apos;s added to the system as &quot;For Deployment&quot; so this visit stays on its record.
              Fill in the rest of its details later from the LGUs page.
            </p>
          </div>
        )}

        <Field label="Visit Title">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Initial talk with the Mayor" required />
        </Field>

        <Field label="Visit Type">
          <Select value={type} onChange={(e) => setType(e.target.value as ScheduleEvent["type"])}>
            {TYPE_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
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

        <FormFooter busy={busy} onCancel={onClose} label={isEdit ? "Save Changes" : "Schedule Visit"} />
      </form>
    </Dialog>
  );
}
