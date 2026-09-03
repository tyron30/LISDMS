import { isSupabaseConfigured, getSupabaseClient } from "./supabase";
import { mockSchedule, mockConcerns, mockRequirements, mockNetworkDevices } from "./mock-data";

export interface AppNotification {
  id: string;
  lguId: string;
  title: string;
  detail: string;
  severity: "info" | "warning" | "critical";
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function daysFromNowStr(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// Notifications are computed on the fly from existing data — upcoming
// visits, high/critical open concerns, overdue requirements, offline
// devices — rather than stored in their own table. Simple to reason about
// and always reflects current state, at the cost of not being able to
// "dismiss" one individually (nothing to persist that against yet).
export async function getNotifications(): Promise<AppNotification[]> {
  const today = todayStr();
  const soon = daysFromNowStr(3);
  const notifications: AppNotification[] = [];

  if (!isSupabaseConfigured) {
    mockSchedule
      .filter((s) => s.date >= today && s.date <= soon)
      .forEach((s) =>
        notifications.push({
          id: `visit-${s.id}`,
          lguId: s.lgu_id,
          title: `Upcoming visit — ${s.lgu_name}`,
          detail: `${s.title} on ${s.date}`,
          severity: "info",
        })
      );
    mockConcerns
      .filter((c) => c.status !== "resolved" && (c.severity === "critical" || c.severity === "high"))
      .forEach((c) =>
        notifications.push({
          id: `concern-${c.id}`,
          lguId: c.lgu_id,
          title: `${c.severity === "critical" ? "Critical" : "High-severity"} concern — ${c.lgu_name}`,
          detail: c.title,
          severity: c.severity === "critical" ? "critical" : "warning",
        })
      );
    mockRequirements
      .filter((r) => r.status === "pending" && r.due_date && r.due_date < today)
      .forEach((r) =>
        notifications.push({
          id: `req-${r.id}`,
          lguId: r.lgu_id,
          title: `Overdue requirement — ${r.lgu_name}`,
          detail: r.name,
          severity: "warning",
        })
      );
    mockNetworkDevices
      .filter((d) => d.status === "offline")
      .forEach((d) =>
        notifications.push({
          id: `device-${d.id}`,
          lguId: d.lgu_id,
          title: `Device offline — ${d.lgu_name}`,
          detail: d.device_name,
          severity: "critical",
        })
      );
    return notifications;
  }

  try {
    const supabase = getSupabaseClient();
    const [scheduleRes, concernRes, reqRes, deviceRes] = await Promise.all([
      supabase.from("schedules").select("id, title, date, lgu_id, lgus(name)").gte("date", today).lte("date", soon),
      supabase.from("concerns").select("id, title, severity, lgu_id, lgus(name)").neq("status", "resolved").in("severity", ["high", "critical"]),
      supabase.from("requirements").select("id, name, due_date, lgu_id, lgus(name)").eq("status", "pending").lt("due_date", today),
      supabase.from("network_devices").select("id, device_name, lgu_id, lgus(name)").eq("status", "offline"),
    ]);

    (scheduleRes.data ?? []).forEach((s: Record<string, unknown>) =>
      notifications.push({
        id: `visit-${s.id}`,
        lguId: s.lgu_id as string,
        title: `Upcoming visit — ${(s.lgus as { name?: string } | null)?.name ?? "Unknown LGU"}`,
        detail: `${s.title} on ${s.date}`,
        severity: "info",
      })
    );
    (concernRes.data ?? []).forEach((c: Record<string, unknown>) =>
      notifications.push({
        id: `concern-${c.id}`,
        lguId: c.lgu_id as string,
        title: `${c.severity === "critical" ? "Critical" : "High-severity"} concern — ${(c.lgus as { name?: string } | null)?.name ?? "Unknown LGU"}`,
        detail: c.title as string,
        severity: c.severity === "critical" ? "critical" : "warning",
      })
    );
    (reqRes.data ?? []).forEach((r: Record<string, unknown>) =>
      notifications.push({
        id: `req-${r.id}`,
        lguId: r.lgu_id as string,
        title: `Overdue requirement — ${(r.lgus as { name?: string } | null)?.name ?? "Unknown LGU"}`,
        detail: r.name as string,
        severity: "warning",
      })
    );
    (deviceRes.data ?? []).forEach((d: Record<string, unknown>) =>
      notifications.push({
        id: `device-${d.id}`,
        lguId: d.lgu_id as string,
        title: `Device offline — ${(d.lgus as { name?: string } | null)?.name ?? "Unknown LGU"}`,
        detail: d.device_name as string,
        severity: "critical",
      })
    );
  } catch {
    // Leave notifications as whatever was gathered before the failure.
  }

  return notifications;
}
