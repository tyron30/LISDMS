"use client";

import { startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, isToday, format } from "date-fns";
import { ScheduleEvent } from "@/lib/types";
import { TYPE_CHIP, TYPE_LABEL } from "./event-style";
import { cn } from "@/lib/utils";

export function WeekView({
  date,
  events,
  onSelectEvent,
}: {
  date: Date;
  events: ScheduleEvent[];
  onSelectEvent: (e: ScheduleEvent) => void;
}) {
  const days = eachDayOfInterval({ start: startOfWeek(date), end: endOfWeek(date) });

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-7">
      {days.map((day) => {
        const dayEvents = events
          .filter((e) => isSameDay(new Date(e.date), day))
          .sort((a, b) => a.time.localeCompare(b.time));
        return (
          <div key={day.toISOString()} className="rounded-md border border-border">
            <div
              className={cn(
                "border-b border-border px-2 py-1.5 text-center text-xs font-medium",
                isToday(day) ? "bg-brand/10 text-brand" : "text-muted"
              )}
            >
              {format(day, "EEE d")}
            </div>
            <div className="space-y-1.5 p-1.5">
              {dayEvents.length === 0 && <p className="px-1 py-2 text-center text-[11px] text-muted">—</p>}
              {dayEvents.map((e) => (
                <button
                  key={e.id}
                  onClick={() => onSelectEvent(e)}
                  className={cn(
                    "block w-full rounded-sm px-1.5 py-1 text-left text-[11px] font-medium",
                    TYPE_CHIP[e.type]
                  )}
                  title={TYPE_LABEL[e.type]}
                >
                  <p className="truncate">{e.time} · {e.lgu_name}</p>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
