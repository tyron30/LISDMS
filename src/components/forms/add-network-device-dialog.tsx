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
import { DeviceStatus, DeviceType } from "@/lib/types";

const TYPE_OPTIONS: { value: DeviceType; label: string }[] = [
  { value: "router", label: "Router" },
  { value: "switch", label: "Switch" },
  { value: "access_point", label: "Access Point" },
  { value: "modem", label: "Modem" },
  { value: "printer", label: "Printer" },
  { value: "other", label: "Other" },
];

const STATUS_OPTIONS: { value: DeviceStatus; label: string }[] = [
  { value: "online", label: "Online" },
  { value: "offline", label: "Offline" },
  { value: "maintenance", label: "Maintenance" },
];

export function AddNetworkDeviceDialog({
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
  const [deviceName, setDeviceName] = useState("");
  const [deviceType, setDeviceType] = useState<DeviceType>("router");
  const [ipAddress, setIpAddress] = useState("");
  const [macAddress, setMacAddress] = useState("");
  const [status, setStatus] = useState<DeviceStatus>("online");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    if (open) setLguId(fixedLguId ?? lguOptions[0]?.id ?? "");
  }, [open, fixedLguId, lguOptions]);

  function reset() {
    setDeviceName("");
    setDeviceType("router");
    setIpAddress("");
    setMacAddress("");
    setStatus("online");
    setNotes("");
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isSupabaseConfigured) {
      showToast("Connect Supabase to save real devices. This is sample data.", "error");
      return;
    }
    if (!lguId || !deviceName) {
      showToast("LGU and device name are required.", "error");
      return;
    }
    setSaving(true);
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.from("network_devices").insert({
        lgu_id: lguId,
        device_name: deviceName,
        device_type: deviceType,
        ip_address: ipAddress || null,
        mac_address: macAddress || null,
        status,
        notes: notes || null,
        last_seen: new Date().toISOString(),
      });
      if (error) throw error;
      logAction("Added network device", deviceName);
      showToast("Device added.");
      onCreated();
      handleClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't add device.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} title="Add Network Device">
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

        <Field label="Device Name">
          <Input value={deviceName} onChange={(e) => setDeviceName(e.target.value)} placeholder="e.g. Main Router" required />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Device Type">
            <Select value={deviceType} onChange={(e) => setDeviceType(e.target.value as DeviceType)}>
              {TYPE_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Status">
            <Select value={status} onChange={(e) => setStatus(e.target.value as DeviceStatus)}>
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="IP Address">
            <Input value={ipAddress} onChange={(e) => setIpAddress(e.target.value)} placeholder="192.168.1.1" />
          </Field>
          <Field label="MAC Address">
            <Input value={macAddress} onChange={(e) => setMacAddress(e.target.value)} placeholder="AA:BB:CC:00:11:22" />
          </Field>
        </div>

        <Field label="Notes">
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
        </Field>

        <div className="flex justify-end gap-2 border-t border-border pt-3">
          <Button type="button" size="sm" variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? "Saving..." : "Add Device"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
