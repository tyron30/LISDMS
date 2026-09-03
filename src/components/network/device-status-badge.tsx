import { cn } from "@/lib/utils";
import { DeviceStatus } from "@/lib/types";

const STATUS_MAP: Record<DeviceStatus, { label: string; dot: string }> = {
  online: { label: "Online", dot: "bg-success" },
  offline: { label: "Offline", dot: "bg-critical" },
  maintenance: { label: "Maintenance", dot: "bg-warning" },
};

export function DeviceStatusBadge({ status }: { status: DeviceStatus }) {
  const s = STATUS_MAP[status];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-sm border border-border bg-surface px-2 py-0.5 text-xs font-medium text-text">
      <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />
      {s.label}
    </span>
  );
}
