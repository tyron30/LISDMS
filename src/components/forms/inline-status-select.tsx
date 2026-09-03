"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Select } from "@/components/ui/select";
import { isSupabaseConfigured, getSupabaseClient } from "@/lib/supabase";
import { useToast } from "@/lib/toast-context";
import { logAction } from "@/lib/audit";

// A dropdown that writes straight to Supabase on change — used anywhere a
// record just needs its status flipped (concern resolved, requirement
// submitted, device back online) without opening a full edit form.
export function InlineStatusSelect<T extends string>({
  table,
  id,
  value,
  options,
  logLabel,
  target,
  onUpdated,
  className,
}: {
  table: string;
  id: string;
  value: T;
  options: { value: T; label: string }[];
  logLabel: string;
  target: string;
  onUpdated: (newValue: T) => void;
  className?: string;
}) {
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  async function handleChange(newValue: T) {
    if (!isSupabaseConfigured) {
      showToast("Connect Supabase to update status. This is sample data.", "error");
      return;
    }
    setSaving(true);
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.from(table).update({ status: newValue }).eq("id", id);
      if (error) throw error;
      onUpdated(newValue);
      logAction(logLabel, target);
      showToast("Status updated.");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't update status.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="relative inline-flex items-center">
      <Select
        value={value}
        disabled={saving}
        onChange={(e) => handleChange(e.target.value as T)}
        className={className ?? "w-40"}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
      {saving && <Loader2 className="ml-1.5 h-3.5 w-3.5 shrink-0 animate-spin text-muted" />}
    </div>
  );
}
