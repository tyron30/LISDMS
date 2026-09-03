"use client";

import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type CalendarView = "month" | "week" | "day" | "agenda";

const VIEWS: { id: CalendarView; label: string }[] = [
  { id: "month", label: "Month" },
  { id: "week", label: "Week" },
  { id: "day", label: "Day" },
  { id: "agenda", label: "Agenda" },
];

function labelFor(view: CalendarView, date: Date) {
  if (view === "month") return format(date, "MMMM yyyy");
  if (view === "day") return format(date, "EEEE, MMMM d, yyyy");
  if (view === "agenda") return "Upcoming";
  return format(date, "MMMM yyyy");
}

export function CalendarHeader({
  view,
  onViewChange,
  date,
  onPrev,
  onNext,
  onToday,
  canCreate,
  onScheduleVisit,
}: {
  view: CalendarView;
  onViewChange: (v: CalendarView) => void;
  date: Date;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  canCreate: boolean;
  onScheduleVisit: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2">
        {/* Prev/Next/Today only apply to the grid views, which are desktop-only,
            so they're hidden on mobile with plain CSS (no JS timing to get wrong). */}
        <div className="hidden items-center gap-1 md:flex">
          <button
            onClick={onPrev}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted hover:bg-bg hover:text-text"
            aria-label="Previous"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={onNext}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted hover:bg-bg hover:text-text"
            aria-label="Next"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <h2 className="text-sm font-semibold text-text sm:text-base">
          <span className="hidden md:inline">{labelFor(view, date)}</span>
          <span className="md:hidden">Upcoming</span>
        </h2>

        <Button size="sm" variant="secondary" onClick={onToday} className="hidden md:inline-flex">
          Today
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <div className="hidden rounded-md border border-border p-0.5 md:flex">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              onClick={() => onViewChange(v.id)}
              className={cn(
                "rounded-sm px-2.5 py-1 text-xs font-medium transition-colors",
                view === v.id ? "bg-brand text-brand-fg" : "text-muted hover:text-text"
              )}
            >
              {v.label}
            </button>
          ))}
        </div>
        {canCreate && (
          <Button size="sm" onClick={onScheduleVisit}>
            <Plus className="h-4 w-4" /> Schedule Visit
          </Button>
        )}
      </div>
    </div>
  );
}
