export type LguStatus = "deployed" | "for_deployment" | "no_update" | "partial_update";

export interface Lgu {
  id: string;
  name: string;
  province: string;
  district: string | null;
  status: LguStatus;
  system: string;
  app_version: string;
  network_setup: string;
  date_deployed: string | null;
  focal_person: string;
  contact_number: string;
  email: string;
  anydesk_id: string | null;
  anydesk_password: string | null;
  open_concerns: number;
  pending_requirements: number;
  next_visit: string | null;
}

export interface Concern {
  id: string;
  lgu_id: string;
  lgu_name: string;
  title: string;
  category: string;
  status: "open" | "in_progress" | "resolved";
  severity: "low" | "medium" | "high" | "critical";
  created_at: string;
}

export interface ScheduleEvent {
  id: string;
  lgu_id: string;
  lgu_name: string;
  title: string;
  type: "orientation" | "network_installation" | "feedbacking" | "critical_visit";
  date: string;
  time: string;
}

export interface Requirement {
  id: string;
  lgu_id: string;
  lgu_name: string;
  name: string;
  status: "pending" | "submitted" | "waived";
  due_date: string | null;
}

export type DeviceStatus = "online" | "offline" | "maintenance";
export type DeviceType = "router" | "switch" | "access_point" | "modem" | "printer" | "other";

export interface NetworkDevice {
  id: string;
  lgu_id: string;
  lgu_name: string;
  device_name: string;
  device_type: DeviceType;
  ip_address: string | null;
  mac_address: string | null;
  status: DeviceStatus;
  notes: string | null;
  last_seen: string | null;
}
