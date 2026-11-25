import { cn } from "@/lib/utils";
import { Option, optionLabel, toneFor } from "@/lib/options";

const DOT = {
  good: "bg-success",
  bad: "bg-critical",
  pending: "bg-warning",
  muted: "bg-muted",
} as const;

// Small status pill for the MOA / SP Resolution / Gov's Signature /
// Orientation fields: green = done, red = missing, amber = in progress.
export function ChecklistBadge({ value, options }: { value: string | null | undefined; options: Option[] }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-sm border border-border bg-surface px-2 py-0.5 text-xs font-medium text-text">
      <span className={cn("h-1.5 w-1.5 rounded-full", DOT[toneFor(value)])} />
      {optionLabel(options, value)}
    </span>
  );
}
