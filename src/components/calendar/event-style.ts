import { ScheduleEvent } from "@/lib/types";

export const TYPE_DOT: Record<ScheduleEvent["type"], string> = {
  orientation: "bg-orientation",
  network_installation: "bg-warning",
  feedbacking: "bg-feedback",
  critical_visit: "bg-critical",
};

export const TYPE_CHIP: Record<ScheduleEvent["type"], string> = {
  orientation: "bg-orientation/10 text-orientation",
  network_installation: "bg-warning/10 text-warning",
  feedbacking: "bg-feedback/10 text-feedback",
  critical_visit: "bg-critical/10 text-critical",
};

export const TYPE_LABEL: Record<ScheduleEvent["type"], string> = {
  orientation: "Orientation",
  network_installation: "Network Installation",
  feedbacking: "Feedbacking",
  critical_visit: "Critical Visit",
};
