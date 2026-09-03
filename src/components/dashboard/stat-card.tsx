import { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone?: "default" | "warning" | "critical";
}) {
  const toneClass =
    tone === "warning" ? "text-warning" : tone === "critical" ? "text-critical" : "text-brand";

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted">{label}</p>
        <Icon className={cn("h-4 w-4", toneClass)} />
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-text">{value}</p>
    </Card>
  );
}
