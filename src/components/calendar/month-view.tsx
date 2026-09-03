"use client";

import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  format,
} from "date-fns";
import { ScheduleEvent } from "@/lib/types";
import { TYPE_DOT } from "./event-style";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function MonthView({
  date,
  events,
  onSelectEvent,
}: {
  date: Date;
  events: ScheduleEvent[];
  onSelectEvent: (e: ScheduleEvent) => void;
}) {
  const gridStart = startOfWeek(startOfMonth(date));
  const gridEnd = endOfWeek(endOfMonth(date));
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  return (
    <div className="overflow-hidden rounded-md border border-border">
      <div className="grid grid-cols-7 border-b border-border bg-bg/60 text-center text-xs font-medium text-muted">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-2">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const dayEvents = events.filter((e) => isSameDay(new Date(e.date), day));
          const inMonth = isSameMonth(day, date);
          return (
            <div
              key={day.toISOString()}
              className={cn(
                "min-h-[92px] border-b border-r border-border p-1.5 last:border-r-0",
                !inMonth && "bg-bg/40"
              )}
            >
              <span
                className={cn(
                  "inline-flex h-5 w-5 items-center justify-center rounded-full text-xs",
                  isToday(day) ? "bg-brand font-semibold text-brand-fg" : "text-muted",
                  !inMonth && "text-muted/50"
                )}
              >
                {format(day, "d")}
              </span>
              <div className="mt-1 space-y-0.5">
                {dayEvents.slice(0, 3).map((e) => (
                  <button
                    key={e.id}
                    onClick={() => onSelectEvent(e)}
                    className="flex w-full items-center gap-1 rounded-sm px-1 py-0.5 text-left text-[11px] text-text hover:bg-bg"
                  >
                    <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", TYPE_DOT[e.type])} />
                    <span className="truncate">{e.lgu_name}</span>
                  </button>
                ))}
                {dayEvents.length > 3 && (
                  <p className="px-1 text-[11px] text-muted">+{dayEvents.length - 3} more</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
