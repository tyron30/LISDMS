"use client";

import { useEffect, useState } from "react";
import { Building2, CircleAlert, CalendarClock, ClipboardList } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { isSupabaseConfigured, getSupabaseClient } from "@/lib/supabase";
import { useAuth } from "@/lib/use-auth";
import { mockLgus, mockSchedule, mockConcerns } from "@/lib/mock-data";
import { Lgu, ScheduleEvent, Concern } from "@/lib/types";
import Link from "next/link";

function greetingName(email: string | null) {
  if (!email) return "there";
  const name = email.split("@")[0].split(/[._]/)[0];
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export default function DashboardPage() {
  const { email } = useAuth();
  const [lgus, setLgus] = useState<Lgu[]>([]);
  const [schedule, setSchedule] = useState<ScheduleEvent[]>([]);
  const [concerns, setConcerns] = useState<Concern[]>([]);
  const [usingMock, setUsingMock] = useState(false);

  useEffect(() => {
    async function load() {
      if (!isSupabaseConfigured) {
        setLgus(mockLgus);
        setSchedule(mockSchedule);
        setConcerns(mockConcerns);
        setUsingMock(true);
        return;
      }
      try {
        const supabase = getSupabaseClient();
        const [lguRes, scheduleRes, concernRes] = await Promise.all([
          supabase.from("lgus").select("*"),
          // Schedules only store lgu_id — join lgus to get a display name.
          supabase.from("schedules").select("*, lgus(name)").order("date", { ascending: true }).limit(5),
          supabase.from("concerns").select("*").eq("status", "open"),
        ]);
        setLgus((lguRes.data as Lgu[]) ?? []);
        const mappedSchedule = (scheduleRes.data ?? []).map((row: Record<string, unknown>) => ({
          ...row,
          lgu_name: (row.lgus as { name?: string } | null)?.name ?? "Unknown LGU",
        })) as ScheduleEvent[];
        setSchedule(mappedSchedule);
        setConcerns((concernRes.data as Concern[]) ?? []);
      } catch {
        setLgus(mockLgus);
        setSchedule(mockSchedule);
        setConcerns(mockConcerns);
        setUsingMock(true);
      }
    }
    load();
  }, []);

  const forDeployment = lgus.filter((l) => l.status === "for_deployment").length;
  const upcomingVisits = schedule.length;

  return (
    <AppShell title="Dashboard">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-text">Good afternoon, {greetingName(email)}</h2>
          <p className="text-sm text-muted">Here&apos;s what&apos;s happening across your LGUs today.</p>
          {usingMock && (
            <p className="mt-2 inline-block rounded-sm border border-warning/30 bg-warning/10 px-2 py-1 text-xs text-warning">
              Showing sample data — connect Supabase in .env.local to see live records.
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label="LGUs" value={lgus.length} icon={Building2} />
          <StatCard label="Open Concerns" value={concerns.length} icon={CircleAlert} tone="critical" />
          <StatCard label="For Deployment" value={forDeployment} icon={ClipboardList} tone="warning" />
          <StatCard label="Upcoming Visits" value={upcomingVisits} icon={CalendarClock} />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="flex items-center justify-between">
              <CardTitle>Upcoming Visits</CardTitle>
              <Link href="/schedule" className="text-xs font-medium text-brand hover:underline">
                View calendar
              </Link>
            </CardHeader>
            <CardContent className="divide-y divide-border p-0">
              {schedule.length === 0 && (
                <p className="p-4 text-sm text-muted">No visits scheduled.</p>
              )}
              {schedule.map((event) => (
                <div key={event.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-text">{event.lgu_name}</p>
                    <p className="text-xs text-muted">{event.title}</p>
                  </div>
                  <div className="text-right text-xs text-muted">
                    <p className="font-medium text-text">
                      {new Date(event.date).toLocaleDateString("en-PH", {
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                    <p>{event.time}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>LGU Status Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-4">
              {lgus.slice(0, 5).map((lgu) => (
                <div key={lgu.id} className="flex items-center justify-between">
                  <span className="text-sm text-text">{lgu.name}</span>
                  <StatusBadge status={lgu.status} />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
