import { isSupabaseConfigured, getSupabaseClient } from "./supabase";
import { mockLgus, mockTickets, mockSchedule, mockRequirements } from "./mock-data";

export interface CommandResult {
  id: string;
  lguId: string;
  primary: string; // LGU name — every result belongs to an LGU
  secondary: string; // the matched detail (ticket title, requirement name, etc.)
  category: "LGU" | "Ticket" | "Schedule" | "Requirement";
  href?: string; // overrides the default /lgus/{lguId} destination when set
}

export async function searchAll(query: string): Promise<CommandResult[]> {
  const q = query.trim();
  if (!q) return [];

  if (!isSupabaseConfigured) {
    const lower = q.toLowerCase();
    const results: CommandResult[] = [];
    mockLgus
      .filter((l) => l.name.toLowerCase().includes(lower) || (l.province ?? "").toLowerCase().includes(lower))
      .forEach((l) => results.push({ id: l.id, lguId: l.id, primary: l.name, secondary: l.province, category: "LGU" }));
    mockTickets
      .filter((t) => t.title.toLowerCase().includes(lower) || t.lgu_name.toLowerCase().includes(lower) || String(t.ticket_number).includes(lower))
      .forEach((t) =>
        results.push({
          id: t.id,
          lguId: t.lgu_id,
          primary: t.lgu_name,
          secondary: `#${t.ticket_number} ${t.title}`,
          category: "Ticket",
          href: `/tickets/${t.id}`,
        })
      );
    mockSchedule
      .filter((s) => s.title.toLowerCase().includes(lower) || s.lgu_name.toLowerCase().includes(lower))
      .forEach((s) => results.push({ id: s.id, lguId: s.lgu_id, primary: s.lgu_name, secondary: s.title, category: "Schedule" }));
    mockRequirements
      .filter((r) => r.name.toLowerCase().includes(lower) || r.lgu_name.toLowerCase().includes(lower))
      .forEach((r) => results.push({ id: r.id, lguId: r.lgu_id, primary: r.lgu_name, secondary: r.name, category: "Requirement" }));
    return results.slice(0, 20);
  }

  try {
    const supabase = getSupabaseClient();
    const like = `%${q}%`;
    const [lguRes, ticketRes, scheduleRes, reqRes] = await Promise.all([
      supabase.from("lgus").select("id, name, province").ilike("name", like).limit(5),
      supabase.from("tickets").select("id, ticket_number, title, lgu_id, lgus(name)").ilike("title", like).limit(5),
      supabase.from("schedules").select("id, title, lgu_id, lgus(name)").ilike("title", like).limit(5),
      supabase.from("requirements").select("id, name, lgu_id, lgus(name)").ilike("name", like).limit(5),
    ]);

    const results: CommandResult[] = [];
    (lguRes.data ?? []).forEach((l: Record<string, unknown>) =>
      results.push({ id: l.id as string, lguId: l.id as string, primary: l.name as string, secondary: (l.province as string) ?? "", category: "LGU" })
    );
    (ticketRes.data ?? []).forEach((t: Record<string, unknown>) =>
      results.push({
        id: t.id as string,
        lguId: t.lgu_id as string,
        primary: (t.lgus as { name?: string } | null)?.name ?? "Unknown LGU",
        secondary: `#${t.ticket_number} ${t.title}`,
        category: "Ticket",
        href: `/tickets/${t.id}`,
      })
    );
    (scheduleRes.data ?? []).forEach((s: Record<string, unknown>) =>
      results.push({
        id: s.id as string,
        lguId: s.lgu_id as string,
        primary: (s.lgus as { name?: string } | null)?.name ?? "Unknown LGU",
        secondary: s.title as string,
        category: "Schedule",
      })
    );
    (reqRes.data ?? []).forEach((r: Record<string, unknown>) =>
      results.push({
        id: r.id as string,
        lguId: r.lgu_id as string,
        primary: (r.lgus as { name?: string } | null)?.name ?? "Unknown LGU",
        secondary: r.name as string,
        category: "Requirement",
      })
    );
    return results;
  } catch {
    return [];
  }
}
