import { TicketStatus, TicketPriority, Requirement, DeviceStatus } from "./types";

// Vocabulary taken straight from the QDTS Tracker spreadsheet so the system
// uses the same words the team already does.

export interface Option {
  value: string;
  label: string;
}

// "With MOA" (MOA Status tab) + the MOA column on the Assignments tab.
export const MOA_STATUS_OPTIONS: Option[] = [
  { value: "", label: "Not set" },
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "for_preparation", label: "For preparation" },
  { value: "for_discussion", label: "For discussion" },
  { value: "for_schedule", label: "For schedule" },
  { value: "na", label: "N/A" },
];

// "With SP Resolution" and "With Gov's Signature"
export const SIGNOFF_OPTIONS: Option[] = [
  { value: "", label: "Not set" },
  { value: "yes", label: "Yes" },
  { value: "none", label: "None" },
  { value: "na", label: "N/A" },
];

// "Orientation/Re-Orientation"
export const ORIENTATION_OPTIONS: Option[] = [
  { value: "", label: "Not set" },
  { value: "ok", label: "Ok" },
  { value: "upcoming", label: "Upcoming" },
  { value: "for_schedule", label: "For schedule" },
  { value: "no_orientation", label: "No orientation" },
  { value: "tbd", label: "TBD" },
];

// "Designation" column in the Directory tab
export const DESIGNATION_OPTIONS = ["Governor", "Municipal Mayor", "City Mayor"];

// "QDTS Setup" column in the deployment tab
export const SETUP_OPTIONS = ["Online", "LAN"];

export const NOTE_CATEGORY_OPTIONS: Option[] = [
  { value: "general", label: "General" },
  { value: "moa", label: "MOA" },
  { value: "orientation", label: "Orientation" },
  { value: "procurement", label: "Procurement" },
  { value: "hardware", label: "Hardware" },
];

export function optionLabel(options: Option[], value: string | null | undefined) {
  if (!value) return "Not set";
  return options.find((o) => o.value === value)?.label ?? value;
}

type Tone = "good" | "bad" | "pending" | "muted";

export function toneFor(value: string | null | undefined): Tone {
  switch (value) {
    case "yes":
    case "ok":
      return "good";
    case "no":
    case "none":
    case "no_orientation":
      return "bad";
    case "for_preparation":
    case "for_discussion":
    case "for_schedule":
    case "upcoming":
    case "tbd":
      return "pending";
    default:
      return "muted"; // N/A or not set
  }
}

// The spreadsheet keeps several people / numbers in one cell, separated by "/".
export function splitList(value: string | null | undefined): string[] {
  return (value ?? "")
    .split(/[\/,;\n]+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

export function telHref(number: string) {
  return `tel:${number.replace(/[^\d+]/g, "")}`;
}

// Header "Call" button: dial the first number when several are listed.
export function firstPhoneHref(value: string | null | undefined) {
  const first = splitList(value)[0];
  return first ? telHref(first) : undefined;
}

// ---- Districts (were redefined in four files) ----
export const DISTRICTS = ["Provincial Government", "1st District", "2nd District", "3rd District", "4th District", "5th District"];
export const NO_DISTRICT = "No District Set";

export function districtRank(d?: string | null) {
  const i = DISTRICTS.indexOf(d ?? "");
  return i === -1 ? DISTRICTS.length : i;
}

// Groups rows by district in display order; "No District Set" goes last and
// empty groups are dropped.
export function groupByDistrict<T extends { district?: string | null }>(rows: T[]) {
  const map = new Map<string, T[]>();
  rows.forEach((r) => {
    const key = r.district || NO_DISTRICT;
    map.set(key, [...(map.get(key) ?? []), r]);
  });
  return [...DISTRICTS, NO_DISTRICT]
    .map((district) => ({ district, rows: map.get(district) ?? [] }))
    .filter((g) => g.rows.length > 0);
}

// ---- Status / priority vocab shared across pages and dialogs ----
export const TICKET_STATUS_OPTIONS: { value: TicketStatus; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "resolved", label: "Resolved" },
];

export const TICKET_PRIORITY_OPTIONS: { value: TicketPriority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

export const TICKET_CATEGORY_OPTIONS = ["Network", "Hardware", "Software", "Account/Access", "Other"];

export const PRIORITY_DOT: Record<TicketPriority, string> = {
  low: "bg-muted",
  medium: "bg-warning",
  high: "bg-warning",
  critical: "bg-critical",
};

export const PRIORITY_CHIP: Record<TicketPriority, string> = {
  low: "bg-border/60 text-muted",
  medium: "bg-warning/10 text-warning",
  high: "bg-warning/10 text-warning",
  critical: "bg-critical/10 text-critical",
};

export const REQUIREMENT_STATUS_OPTIONS: { value: Requirement["status"]; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "submitted", label: "Submitted" },
  { value: "waived", label: "Waived" },
];

export const DEVICE_STATUS_OPTIONS: { value: DeviceStatus; label: string }[] = [
  { value: "online", label: "Online" },
  { value: "offline", label: "Offline" },
  { value: "maintenance", label: "Maintenance" },
];
