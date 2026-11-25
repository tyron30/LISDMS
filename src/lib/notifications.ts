import { isSupabaseConfigured, getSupabaseClient } from "./supabase";
import { mockSchedule, mockTickets, mockRequirements, mockNetworkDevices } from "./mock-data";
import { joinedName } from "./data";
import type { Preferences } from "./preferences";

export interface AppNotification {
  id: string;
  lguId: string;
  title: string;
  detail: string;
  severity: "info" | "warning" | "critical";
  href?: string; // overrides the default /lgus/{lguId} destination when set
}

type Row = { id: string; lguId: string; lguName: string; text: string };
interface Sources {
  visits: Row[];
  tickets: (Row & { number: number; priority: string })[];
  requirements: Row[];
  devices: Row[];
}

const dayStr = (offsetDays = 0) => new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);

// Pulls the raw rows (sample data when there's no database) in one normalised shape.
async function fetchSources(today: string, soon: string): Promise<Sources> {
  if (!isSupabaseConfigured) {
    return {
      visits: mockSchedule.filter((s) => s.date >= today && s.date <= soon).map((s) => ({ id: s.id, lguId: s.lgu_id, lguName: s.lgu_name, text: `${s.title} on ${s.date}` })),
      tickets: mockTickets
        .filter((t) => t.status !== "resolved" && (t.priority === "critical" || t.priority === "high"))
        .map((t) => ({ id: t.id, lguId: t.lgu_id, lguName: t.lgu_name, text: t.title, number: t.ticket_number, priority: t.priority })),
      requirements: mockRequirements.filter((r) => r.status === "pending" && r.due_date && r.due_date < today).map((r) => ({ id: r.id, lguId: r.lgu_id, lguName: r.lgu_name, text: r.name })),
      devices: mockNetworkDevices.filter((d) => d.status === "offline").map((d) => ({ id: d.id, lguId: d.lgu_id, lguName: d.lgu_name, text: d.device_name })),
    };
  }
  const sb = getSupabaseClient();
  const [v, t, r, d] = await Promise.all([
    sb.from("schedules").select("id, title, date, lgu_id, lgus(name)").gte("date", today).lte("date", soon),
    sb.from("tickets").select("id, ticket_number, title, priority, lgu_id, lgus(name)").neq("status", "resolved").in("priority", ["high", "critical"]),
    sb.from("requirements").select("id, name, due_date, lgu_id, lgus(name)").eq("status", "pending").lt("due_date", today),
    sb.from("network_devices").select("id, device_name, lgu_id, lgus(name)").eq("status", "offline"),
  ]);
  for (const res of [v, t, r, d]) if (res.error) throw res.error;
  const base = (x: Record<string, unknown>) => ({ id: x.id as string, lguId: x.lgu_id as string, lguName: joinedName(x, "lgus") ?? "Unknown LGU" });
  return {
    visits: (v.data ?? []).map((x) => ({ ...base(x), text: `${x.title} on ${x.date}` })),
    tickets: (t.data ?? []).map((x) => ({ ...base(x), text: x.title as string, number: x.ticket_number as number, priority: x.priority as string })),
    requirements: (r.data ?? []).map((x) => ({ ...base(x), text: x.name as string })),
    devices: (d.data ?? []).map((x) => ({ ...base(x), text: x.device_name as string })),
  };
}

// Notifications are computed on the fly from existing data rather than stored,
// so they always reflect current state (and can't be dismissed individually —
// there's nothing to persist a dismissal against). Which kinds appear, and how
// far ahead visits are looked for, comes from the user's Preferences.
export async function getNotifications(prefs: Pick<Preferences, "notify" | "visitWindowDays">): Promise<AppNotification[]> {
  const today = dayStr();
  let src: Sources;
  try {
    src = await fetchSources(today, dayStr(prefs.visitWindowDays));
  } catch {
    return [];
  }

  const out: AppNotification[] = [];
  if (prefs.notify.visits)
    src.visits.forEach((x) => out.push({ id: `visit-${x.id}`, lguId: x.lguId, title: `Upcoming visit — ${x.lguName}`, detail: x.text, severity: "info" }));
  if (prefs.notify.tickets)
    src.tickets.forEach((x) =>
      out.push({
        id: `ticket-${x.id}`,
        lguId: x.lguId,
        title: `${x.priority === "critical" ? "Critical" : "High-priority"} ticket — ${x.lguName}`,
        detail: `#${x.number} ${x.text}`,
        severity: x.priority === "critical" ? "critical" : "warning",
        href: `/tickets/${x.id}`,
      })
    );
  if (prefs.notify.requirements)
    src.requirements.forEach((x) => out.push({ id: `req-${x.id}`, lguId: x.lguId, title: `Overdue requirement — ${x.lguName}`, detail: x.text, severity: "warning" }));
  if (prefs.notify.devices)
    src.devices.forEach((x) => out.push({ id: `device-${x.id}`, lguId: x.lguId, title: `Device offline — ${x.lguName}`, detail: x.text, severity: "critical" }));
  return out;
}
