export type LguStatus = "deployed" | "for_deployment" | "no_update" | "partial_update";

export interface AssignedPerson {
  id: string;
  name: string;
}

export interface Lgu {
  created_at?: string;
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
  assigned_person_id: string | null;
  assigned_person_name?: string | null;
  open_tickets: number;
  pending_requirements: number;
  next_visit: string | null;
}

export type TicketStatus = "open" | "in_progress" | "resolved";
export type TicketPriority = "low" | "medium" | "high" | "critical";

export interface Ticket {
  id: string;
  ticket_number: number;
  lgu_id: string;
  lgu_name: string;
  title: string;
  description: string | null;
  category: string;
  status: TicketStatus;
  priority: TicketPriority;
  requester_name: string | null;
  requester_email: string | null;
  assigned_person_id: string | null;
  assigned_person_name?: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

export interface TicketComment {
  id: string;
  ticket_id: string;
  author_email: string | null;
  body: string;
  created_at: string;
}

export interface TicketAttachment {
  id: string;
  ticket_id: string;
  file_name: string;
  file_url: string;
  uploaded_at: string;
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
  created_at?: string;
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

export interface LguDocument {
  id: string;
  lgu_id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  uploaded_by: string | null;
  uploaded_at: string;
}
