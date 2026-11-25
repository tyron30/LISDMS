import Link from "next/link";
import { LguNote } from "@/lib/types";

// The "latest remark / update" cell shared by the MOA Tracker and the
// Assignments page: shows the most recent note and lets anyone add another.
export function NoteSnippet({
  note,
  lguId,
  onAdd,
  addLabel = "Add update",
}: {
  note?: LguNote;
  lguId: string;
  onAdd: () => void;
  addLabel?: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <div className="min-w-0 max-w-xs flex-1">
        {note ? (
          <>
            <p className="line-clamp-2 text-sm text-text">{note.body}</p>
            <p className="text-xs text-muted">
              {new Date(note.note_date).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
              {" · "}
              <Link href={`/lgus/${lguId}?tab=Updates`} className="text-brand hover:underline">
                View all
              </Link>
            </p>
          </>
        ) : (
          <span className="text-muted">—</span>
        )}
      </div>
      <button
        onClick={onAdd}
        className="shrink-0 rounded-md border border-border px-2 py-1 text-xs font-medium text-brand hover:bg-bg"
      >
        {note ? "Add" : addLabel}
      </button>
    </div>
  );
}
