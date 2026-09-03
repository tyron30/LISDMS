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
import { Lgu, LguStatus } from "@/lib/types";

const STATUS_OPTIONS: { value: LguStatus; label: string }[] = [
  { value: "for_deployment", label: "For Deployment" },
  { value: "deployed", label: "Deployed" },
  { value: "partial_update", label: "Partial Update" },
  { value: "no_update", label: "No Update" },
];

const EMPTY = {
  name: "",
  province: "",
  district: "",
  status: "for_deployment" as LguStatus,
  system: "",
  app_version: "",
  network_setup: "",
  date_deployed: "",
  focal_person: "",
  contact_number: "",
  email: "",
  anydesk_id: "",
  anydesk_password: "",
};

type FormState = typeof EMPTY;

function lguToForm(lgu: Lgu): FormState {
  return {
    name: lgu.name,
    province: lgu.province,
    district: lgu.district ?? "",
    status: lgu.status,
    system: lgu.system ?? "",
    app_version: lgu.app_version ?? "",
    network_setup: lgu.network_setup ?? "",
    date_deployed: lgu.date_deployed ?? "",
    focal_person: lgu.focal_person ?? "",
    contact_number: lgu.contact_number ?? "",
    email: lgu.email ?? "",
    anydesk_id: lgu.anydesk_id ?? "",
    anydesk_password: lgu.anydesk_password ?? "",
  };
}

// Handles both "Add LGU" (no `lgu` prop) and "Edit LGU" (pass the existing
// row) so the two flows share one form instead of drifting apart.
export function AddLguDialog({
  open,
  onClose,
  onCreated,
  lgu,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  lgu?: Lgu;
}) {
  const isEdit = Boolean(lgu);
  const [form, setForm] = useState<FormState>(lgu ? lguToForm(lgu) : EMPTY);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    if (open) setForm(lgu ? lguToForm(lgu) : EMPTY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, lgu?.id]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleClose() {
    setForm(EMPTY);
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isSupabaseConfigured) {
      showToast("Connect Supabase to save real LGUs. This is sample data.", "error");
      return;
    }
    if (!form.name || !form.province) {
      showToast("Name and province are required.", "error");
      return;
    }
    setSaving(true);
    try {
      const supabase = getSupabaseClient();
      const payload = {
        ...form,
        district: form.district || null,
        date_deployed: form.date_deployed || null,
        anydesk_id: form.anydesk_id || null,
        anydesk_password: form.anydesk_password || null,
      };

      if (isEdit && lgu) {
        const { error } = await supabase.from("lgus").update(payload).eq("id", lgu.id);
        if (error) throw error;
        logAction("Updated LGU", form.name);
        showToast("LGU updated.");
      } else {
        const { error } = await supabase.from("lgus").insert(payload);
        if (error) throw error;
        logAction("Created LGU", form.name);
        showToast("LGU created successfully.");
      }

      onCreated();
      handleClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't save LGU.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} title={isEdit ? "Edit LGU" : "Add LGU"} className="max-w-lg">
      <form onSubmit={handleSubmit} className="max-h-[70vh] space-y-5 overflow-y-auto pr-1">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Basic Information</p>
          <Field label="LGU Name">
            <Input value={form.name} onChange={(e) => update("name", e.target.value)} required />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Province">
              <Input value={form.province} onChange={(e) => update("province", e.target.value)} required />
            </Field>
            <Field label="District">
              <Input value={form.district} onChange={(e) => update("district", e.target.value)} placeholder="e.g. 1st District" />
            </Field>
          </div>
          <Field label="Status">
            <Select value={form.status} onChange={(e) => update("status", e.target.value as LguStatus)}>
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Contact Information</p>
          <Field label="Focal Person">
            <Input value={form.focal_person} onChange={(e) => update("focal_person", e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Contact Number">
              <Input value={form.contact_number} onChange={(e) => update("contact_number", e.target.value)} />
            </Field>
            <Field label="Email">
              <Input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} />
            </Field>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">System Information</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="System">
              <Input value={form.system} onChange={(e) => update("system", e.target.value)} placeholder="e.g. QMER" />
            </Field>
            <Field label="App Version">
              <Input value={form.app_version} onChange={(e) => update("app_version", e.target.value)} placeholder="e.g. v2.4.1" />
            </Field>
          </div>
          <Field label="Network Setup">
            <Input value={form.network_setup} onChange={(e) => update("network_setup", e.target.value)} placeholder="e.g. LAN + Online" />
          </Field>
          <Field label="Date Deployed">
            <Input type="date" value={form.date_deployed} onChange={(e) => update("date_deployed", e.target.value)} />
          </Field>
        </div>

        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Remote Access Credentials</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="AnyDesk ID">
              <Input value={form.anydesk_id} onChange={(e) => update("anydesk_id", e.target.value)} placeholder="e.g. 113 041 8272" />
            </Field>
            <Field label="AnyDesk Password">
              <Input value={form.anydesk_password} onChange={(e) => update("anydesk_password", e.target.value)} />
            </Field>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-border pt-3">
          <Button type="button" size="sm" variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? "Saving..." : isEdit ? "Save Changes" : "Add LGU"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
