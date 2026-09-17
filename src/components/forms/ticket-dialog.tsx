"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, Field } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { isSupabaseConfigured, getSupabaseClient } from "@/lib/supabase";
import { useToast } from "@/lib/toast-context";
import { logAction } from "@/lib/audit";
import { Ticket, TicketPriority, TicketStatus, AssignedPerson } from "@/lib/types";
import { mockAssignedPersons } from "@/lib/mock-data";

const PRIORITY_OPTIONS: TicketPriority[] = ["low", "medium", "high", "critical"];
const STATUS_OPTIONS: TicketStatus[] = ["open", "in_progress", "resolved"];
const CATEGORY_OPTIONS = ["Network", "Hardware", "Software", "Account/Access", "Other"];

// Handles both "New Ticket" (no `ticket` prop) and "Edit Ticket" (pass the
// existing row) — same create/edit pattern used across the app.
export function TicketDialog({
  open,
  onClose,
  onCreated,
  lguOptions,
  fixedLguId,
  ticket,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  lguOptions: { id: string; name: string }[];
  fixedLguId?: string;
  ticket?: Ticket;
}) {
  const isEdit = Boolean(ticket);
  const [lguId, setLguId] = useState(ticket?.lgu_id ?? fixedLguId ?? lguOptions[0]?.id ?? "");
  const [title, setTitle] = useState(ticket?.title ?? "");
  const [description, setDescription] = useState(ticket?.description ?? "");
  const [category, setCategory] = useState(ticket?.category ?? CATEGORY_OPTIONS[0]);
  const [priority, setPriority] = useState<TicketPriority>(ticket?.priority ?? "medium");
  const [status, setStatus] = useState<TicketStatus>(ticket?.status ?? "open");
  const [assignedPersonId, setAssignedPersonId] = useState(ticket?.assigned_person_id ?? "");
  const [assignedPersons, setAssignedPersons] = useState<AssignedPerson[]>([]);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    if (open) {
      setLguId(ticket?.lgu_id ?? fixedLguId ?? lguOptions[0]?.id ?? "");
      setTitle(ticket?.title ?? "");
      setDescription(ticket?.description ?? "");
      setCategory(ticket?.category ?? CATEGORY_OPTIONS[0]);
      setPriority(ticket?.priority ?? "medium");
      setStatus(ticket?.status ?? "open");
      setAssignedPersonId(ticket?.assigned_person_id ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ticket?.id]);

  useEffect(() => {
    if (!open) return;
    async function loadPeople() {
      if (!isSupabaseConfigured) {
        setAssignedPersons(mockAssignedPersons);
        return;
      }
      try {
        const supabase = getSupabaseClient();
        const { data } = await supabase.from("assigned_persons").select("*").order("name");
        setAssignedPersons((data as AssignedPerson[]) ?? []);
      } catch {
        setAssignedPersons(mockAssignedPersons);
      }
    }
    loadPeople();
  }, [open]);

  function handleClose() {
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isSupabaseConfigured) {
      showToast("Connect Supabase to save real tickets. This is sample data.", "error");
      return;
    }
    if (!lguId || !title) {
      showToast("LGU and title are required.", "error");
      return;
    }
    setSaving(true);
    try {
      const supabase = getSupabaseClient();

      if (isEdit && ticket) {
        const wasUnresolved = ticket.status !== "resolved";
        const nowResolved = status === "resolved";
        const { error } = await supabase
          .from("tickets")
          .update({
            lgu_id: lguId,
            title,
            description: description || null,
            category,
            priority,
            status,
            assigned_person_id: assignedPersonId || null,
            updated_at: new Date().toISOString(),
            resolved_at: wasUnresolved && nowResolved ? new Date().toISOString() : ticket.resolved_at,
          })
          .eq("id", ticket.id);
        if (error) throw error;
        logAction("Updated ticket", `#${ticket.ticket_number} ${title}`);
        showToast("Ticket updated.");
      } else {
        const { error } = await supabase.from("tickets").insert({
          lgu_id: lguId,
          title,
          description: description || null,
          category,
          priority,
          status: "open",
          assigned_person_id: assignedPersonId || null,
        });
        if (error) throw error;
        logAction("Created ticket", title);
        showToast("Ticket created.");
      }

      onCreated();
      handleClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't save ticket.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} title={isEdit ? `Edit Ticket #${ticket?.ticket_number}` : "New Ticket"} className="max-w-lg">
      <form onSubmit={handleSubmit} className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
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

        <Field label="Description">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="What's happening, what's been tried, anything relevant for troubleshooting"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Category">
            <Select value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Priority">
            <Select value={priority} onChange={(e) => setPriority(e.target.value as TicketPriority)}>
              {PRIORITY_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Assigned To">
            <Select value={assignedPersonId} onChange={(e) => setAssignedPersonId(e.target.value)}>
              <option value="">Unassigned</option>
              {assignedPersons.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          {isEdit && (
            <Field label="Status">
              <Select value={status} onChange={(e) => setStatus(e.target.value as TicketStatus)}>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s === "in_progress" ? "In Progress" : s.charAt(0).toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </Select>
            </Field>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-border pt-3">
          <Button type="button" size="sm" variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? "Saving..." : isEdit ? "Save Changes" : "Create Ticket"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
