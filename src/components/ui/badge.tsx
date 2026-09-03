import { cn } from "@/lib/utils";
import { LguStatus } from "@/lib/types";

const STATUS_MAP: Record<LguStatus, { label: string; dot: string }> = {
  deployed: { label: "Deployed", dot: "bg-success" },
  for_deployment: { label: "For Deployment", dot: "bg-orientation" },
  partial_update: { label: "Partial Update", dot: "bg-warning" },
  no_update: { label: "No Update", dot: "bg-critical" },
};

export function StatusBadge({ status }: { status: LguStatus }) {
  const s = STATUS_MAP[status];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-sm border border-border bg-surface px-2 py-0.5 text-xs font-medium text-text">
      <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />
      {s.label}
    </span>
  );
}

export function Badge({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm border border-border bg-surface px-2 py-0.5 text-xs font-medium text-muted",
        className
      )}
    >
      {children}
    </span>
  );
}
