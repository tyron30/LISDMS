import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

// Cancel / Save row that every dialog form ended with.
export function FormFooter({
  busy,
  onCancel,
  label,
  busyLabel = "Saving...",
}: {
  busy: boolean;
  onCancel: () => void;
  label: string;
  busyLabel?: string;
}) {
  return (
    <div className="flex justify-end gap-2 border-t border-border pt-3">
      <Button type="button" size="sm" variant="secondary" onClick={onCancel}>
        Cancel
      </Button>
      <Button type="submit" size="sm" disabled={busy}>
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        {busy ? busyLabel : label}
      </Button>
    </div>
  );
}
