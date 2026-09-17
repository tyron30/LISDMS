"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { isSupabaseConfigured, getSupabaseClient } from "@/lib/supabase";
import { useToast } from "@/lib/toast-context";
import { logAction } from "@/lib/audit";

// Reused for every destructive delete in the app: LGUs, tickets, schedules,
// requirements, network devices. Always requires this confirmation — never
// deletes on a single click.
export function DeleteConfirmDialog({
  open,
  onClose,
  onDeleted,
  table,
  id,
  itemLabel,
  warning,
  logLabel,
}: {
  open: boolean;
  onClose: () => void;
  onDeleted: () => void;
  table: string;
  id: string;
  itemLabel: string;
  warning?: string;
  logLabel: string;
}) {
  const [deleting, setDeleting] = useState(false);
  const { showToast } = useToast();

  async function handleDelete() {
    if (!isSupabaseConfigured) {
      showToast("Connect Supabase to delete real records. This is sample data.", "error");
      return;
    }
    setDeleting(true);
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
      logAction(logLabel, itemLabel);
      showToast("Deleted.");
      onDeleted();
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't delete.", "error");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={`Delete ${itemLabel}?`}>
      <p className="text-sm text-muted">
        This action cannot be easily undone.{warning ? ` ${warning}` : ""}
      </p>
      <div className="mt-4 flex justify-end gap-2 border-t border-border pt-4">
        <Button type="button" size="sm" variant="secondary" onClick={onClose} disabled={deleting}>
          Cancel
        </Button>
        <Button type="button" size="sm" variant="destructive" onClick={handleDelete} disabled={deleting}>
          {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
          {deleting ? "Deleting..." : "Delete"}
        </Button>
      </div>
    </Dialog>
  );
}
