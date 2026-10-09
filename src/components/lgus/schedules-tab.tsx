"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, CalendarDays } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { isSupabaseConfigured, getSupabaseClient } from "@/lib/supabase";
import { mockSchedule } from "@/lib/mock-data";
import { ScheduleEvent } from "@/lib/types";
import { TYPE_CHIP, TYPE_LABEL, TYPE_DOT } from "@/components/calendar/event-style";
import { ScheduleVisitDialog } from "@/components/forms/schedule-visit-dialog";
import { DeleteConfirmDialog } from "@/components/forms/delete-confirm-dialog";
import { cn } from "@/lib/utils";

// Self-contained: fetches this LGU's visits itself (same pattern as
// CredentialsTab) so the page component doesn't have to carry every tab's data.
export function SchedulesTab({
  lguId,
  lguName,
  isAdmin,
  reloadKey,
}: {
  lguId: string;
  lguName: string;
  isAdmin: boolean;
  reloadKey: number;
}) {
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<ScheduleEvent | null>(null);
  const [deleting, setDeleting] = useState<ScheduleEvent | null>(null);

  async function load() {
    if (!isSupabaseConfigured) {
      setEvents(mockSchedule.filter((s) => s.lgu_id === lguId));
      setLoading(false);
      return;
    }
    try {
      const supabase = getSupabaseClient();
      const { data } = await supabase.from("schedules").select("*").eq("lgu_id", lguId);
      setEvents(
        ((data ?? []) as Record<string, unknown>[]).map((r) => ({
          ...r,
          lgu_name: lguName,
          // Postgres `time` comes back as HH:MM:SS; the UI works in HH:MM.
          time: String(r.time ?? "").slice(0, 5),
        })) as ScheduleEvent[]
      );
    } catch {
      setEvents(mockSchedule.filter((s) => s.lgu_id === lguId));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lguId, reloadKey]);

  const { upcoming, past } = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const key = (e: ScheduleEvent) => `${e.date} ${e.time}`;
    return {
      upcoming: events.filter((e) => e.date >= today).sort((a, b) => key(a).localeCompare(key(b))),
      past: events.filter((e) => e.date < today).sort((a, b) => key(b).localeCompare(key(a))),
    };
  }, [events]);

  function renderRow(e: ScheduleEvent) {
    return (
      <div key={e.id} className="flex items-center gap-3 px-4 py-3">
        <span className={cn("h-2 w-2 shrink-0 rounded-full", TYPE_DOT[e.type])} aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-text">{e.title}</p>
          <p className="text-xs text-muted">
            {new Date(e.date).toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
            {e.time ? ` · ${e.time}` : ""}
          </p>
        </div>
        <span className={cn("hidden shrink-0 rounded-sm px-2 py-0.5 text-[11px] font-medium sm:inline", TYPE_CHIP[e.type])}>
          {TYPE_LABEL[e.type]}
        </span>
        {isAdmin && (
          <div className="flex shrink-0 items-center gap-2 border-l border-border pl-3">
            <button onClick={() => setEditing(e)} className="text-muted hover:text-text" aria-label={`Edit ${e.title}`}>
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => setDeleting(e)} className="text-muted hover:text-critical" aria-label={`Delete ${e.title}`}>
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    );
  }

  const lguOptions = [{ id: lguId, name: lguName }];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">
          {loading ? "Loading…" : `${upcoming.length} upcoming · ${past.length} past`}
        </p>
        {isAdmin && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> Schedule Visit
          </Button>
        )}
      </div>

      {loading ? (
        <Skeleton className="h-32 w-full" />
      ) : events.length === 0 ? (
        <EmptyState
          title="No visits scheduled"
          description={`There are no visits on record for ${lguName} yet.`}
          actionLabel={isAdmin ? "Schedule Visit" : undefined}
          onAction={() => setCreateOpen(true)}
        />
      ) : (
        <>
          {upcoming.length > 0 && (
            <div className="space-y-2">
              <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
                <CalendarDays className="h-3.5 w-3.5" /> Upcoming
              </h3>
              <Card>
                <CardContent className="divide-y divide-border p-0">{upcoming.map(renderRow)}</CardContent>
              </Card>
            </div>
          )}
          {past.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Past visits</h3>
              <Card>
                <CardContent className="divide-y divide-border p-0">{past.map(renderRow)}</CardContent>
              </Card>
            </div>
          )}
        </>
      )}

      <ScheduleVisitDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={load}
        lguOptions={lguOptions}
        fixedLguId={lguId}
      />
      <ScheduleVisitDialog
        open={!!editing}
        onClose={() => setEditing(null)}
        onCreated={load}
        lguOptions={lguOptions}
        fixedLguId={lguId}
        schedule={editing ?? undefined}
      />
      {deleting && (
        <DeleteConfirmDialog
          open={!!deleting}
          onClose={() => setDeleting(null)}
          onDeleted={load}
          table="schedules"
          id={deleting.id}
          itemLabel={deleting.title}
          logLabel="Deleted schedule"
        />
      )}
    </div>
  );
}
