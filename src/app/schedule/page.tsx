"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Calendar } from "@/components/calendar/calendar";
import { isSupabaseConfigured, getSupabaseClient } from "@/lib/supabase";
import { mockSchedule, mockLgus } from "@/lib/mock-data";
import { ScheduleEvent } from "@/lib/types";

export default function SchedulePage() {
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [lguOptions, setLguOptions] = useState<{ id: string; name: string }[]>([]);

  async function load() {
    if (!isSupabaseConfigured) {
      setEvents(mockSchedule);
      setLguOptions(mockLgus.map((l) => ({ id: l.id, name: l.name })));
      return;
    }
    try {
      const supabase = getSupabaseClient();
      const [scheduleRes, lgusRes] = await Promise.all([
        // Schedules only store lgu_id — join lgus to get a display name.
        supabase.from("schedules").select("*, lgus(name)").order("date"),
        supabase.from("lgus").select("id, name").order("name"),
      ]);
      const mapped = (scheduleRes.data ?? []).map((row: Record<string, unknown>) => ({
        ...row,
        lgu_name: (row.lgus as { name?: string } | null)?.name ?? "Unknown LGU",
      })) as ScheduleEvent[];
      setEvents(mapped);
      setLguOptions((lgusRes.data as { id: string; name: string }[]) ?? []);
    } catch {
      setEvents(mockSchedule);
      setLguOptions(mockLgus.map((l) => ({ id: l.id, name: l.name })));
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <AppShell title="Schedule">
      <div className="mx-auto max-w-6xl">
        <Calendar events={events} lguOptions={lguOptions} onCreated={load} />
      </div>
    </AppShell>
  );
}
