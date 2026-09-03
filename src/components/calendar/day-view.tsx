"use client";

import { isSameDay } from "date-fns";
import { CalendarDays } from "lucide-react";
import { ScheduleEvent } from "@/lib/types";
import { TYPE_CHIP, TYPE_LABEL, TYPE_DOT } from "./event-style";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function DayView({
  date,
  events,
  onSelectEvent,
}: {
  date: Date;
  events: ScheduleEvent[];
  onSelectEvent: (e: ScheduleEvent) => void;
}) {
  const dayEvents = events
    .filter((e) => isSameDay(new Date(e.date), date))
    .sort((a, b) => a.time.localeCompare(b.time));

  if (dayEvents.length === 0) {
    return (
      <Card className="flex flex-col items-center justify-center gap-2 py-16 text-center">
        <CalendarDays className="h-6 w-6 text-muted" />
        <p className="text-sm text-muted">No visits scheduled for this day.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {dayEvents.map((e) => (
        <Card
          key={e.id}
          className="flex cursor-pointer items-center gap-3 p-3 hover:bg-bg/60"
          onClick={() => onSelectEvent(e)}
        >
          <div className="w-14 shrink-0 text-sm font-medium text-text">{e.time}</div>
          <span className={cn("h-2 w-2 shrink-0 rounded-full", TYPE_DOT[e.type])} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-text">{e.lgu_name}</p>
            <p className="truncate text-xs text-muted">{e.title}</p>
          </div>
          <span className={cn("shrink-0 rounded-sm px-2 py-0.5 text-[11px] font-medium", TYPE_CHIP[e.type])}>
            {TYPE_LABEL[e.type]}
          </span>
        </Card>
      ))}
    </div>
  );
}
