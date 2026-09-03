import { isSupabaseConfigured, getSupabaseClient } from "./supabase";
import { mockLgus, mockConcerns, mockSchedule, mockRequirements } from "./mock-data";

export interface CommandResult {
  id: string;
  lguId: string;
  primary: string; // LGU name — every result belongs to an LGU
  secondary: string; // the matched detail (concern title, requirement name, etc.)
  category: "LGU" | "Concern" | "Schedule" | "Requirement";
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
    mockConcerns
      .filter((c) => c.title.toLowerCase().includes(lower) || c.lgu_name.toLowerCase().includes(lower))
      .forEach((c) => results.push({ id: c.id, lguId: c.lgu_id, primary: c.lgu_name, secondary: c.title, category: "Concern" }));
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
    const [lguRes, concernRes, scheduleRes, reqRes] = await Promise.all([
      supabase.from("lgus").select("id, name, province").ilike("name", like).limit(5),
      supabase.from("concerns").select("id, title, lgu_id, lgus(name)").ilike("title", like).limit(5),
      supabase.from("schedules").select("id, title, lgu_id, lgus(name)").ilike("title", like).limit(5),
      supabase.from("requirements").select("id, name, lgu_id, lgus(name)").ilike("name", like).limit(5),
    ]);

    const results: CommandResult[] = [];
    (lguRes.data ?? []).forEach((l: Record<string, unknown>) =>
      results.push({ id: l.id as string, lguId: l.id as string, primary: l.name as string, secondary: (l.province as string) ?? "", category: "LGU" })
    );
    (concernRes.data ?? []).forEach((c: Record<string, unknown>) =>
      results.push({
        id: c.id as string,
        lguId: c.lgu_id as string,
        primary: (c.lgus as { name?: string } | null)?.name ?? "Unknown LGU",
        secondary: c.title as string,
        category: "Concern",
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
