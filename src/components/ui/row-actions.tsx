import { Pencil, Trash2 } from "lucide-react";

// The edit + delete icon pair that sat at the end of every row.
export function RowActions({
  label,
  onEdit,
  onDelete,
  size = "h-3.5 w-3.5",
}: {
  label: string;
  onEdit?: () => void;
  onDelete?: () => void;
  size?: string;
}) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      {onEdit && (
        <button onClick={onEdit} className="text-muted hover:text-text" aria-label={`Edit ${label}`}>
          <Pencil className={size} />
        </button>
      )}
      {onDelete && (
        <button onClick={onDelete} className="text-muted hover:text-critical" aria-label={`Delete ${label}`}>
          <Trash2 className={size} />
        </button>
      )}
    </div>
  );
}
