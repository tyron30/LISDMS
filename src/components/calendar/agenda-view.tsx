"use client";

import { CalendarDays } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ScheduleEvent } from "@/lib/types";
import { TYPE_DOT } from "./event-style";
import { cn } from "@/lib/utils";

export function AgendaView({
  events,
  onSelectEvent,
}: {
  events: ScheduleEvent[];
  onSelectEvent: (e: ScheduleEvent) => void;
}) {
  const sorted = [...events].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

  if (sorted.length === 0) {
    return (
      <EmptyState
        title="No visits scheduled"
        description="Schedule a visit to an LGU to see it appear here."
        actionLabel="Schedule Visit"
      />
    );
  }

  return (
    <div className="space-y-2">
      {sorted.map((e) => (
        <Card
          key={e.id}
          className="flex cursor-pointer items-center gap-4 p-4 hover:bg-bg/60"
          onClick={() => onSelectEvent(e)}
        >
          <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-md border border-border text-xs">
            <CalendarDays className="h-4 w-4 text-muted" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-text">
              {e.lgu_name} — {e.title}
            </p>
            <p className="text-xs text-muted">
              {new Date(e.date).toLocaleDateString("en-PH", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}{" "}
              · {e.time}
            </p>
          </div>
          <span className={cn("h-2 w-2 shrink-0 rounded-full", TYPE_DOT[e.type])} />
        </Card>
      ))}
    </div>
  );
}
