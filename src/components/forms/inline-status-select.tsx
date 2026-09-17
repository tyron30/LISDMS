"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Select } from "@/components/ui/select";
import { isSupabaseConfigured, getSupabaseClient } from "@/lib/supabase";
import { useToast } from "@/lib/toast-context";
import { logAction } from "@/lib/audit";

// A dropdown that writes straight to Supabase on change — used anywhere a
// record just needs one field flipped (ticket status, priority, assignee;
// requirement submitted; device back online) without opening a full edit
// form. Defaults to updating a "status" column; pass `column` to target a
// different one (e.g. "priority", "assigned_person_id").
export function InlineStatusSelect<T extends string>({
  table,
  id,
  column = "status",
  value,
  options,
  logLabel,
  target,
  onUpdated,
  className,
  successMessage = "Updated.",
}: {
  table: string;
  id: string;
  column?: string;
  value: T;
  options: { value: T; label: string }[];
  logLabel: string;
  target: string;
  onUpdated: (newValue: T) => void;
  className?: string;
  successMessage?: string;
}) {
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  async function handleChange(newValue: T) {
    if (!isSupabaseConfigured) {
      showToast("Connect Supabase to update this. This is sample data.", "error");
      return;
    }
    setSaving(true);
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.from(table).update({ [column]: newValue || null }).eq("id", id);
      if (error) throw error;
      onUpdated(newValue);
      logAction(logLabel, target);
      showToast(successMessage);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't update.", "error");
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
