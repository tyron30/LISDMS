"use client";

import { useState } from "react";
import { addMonths, subMonths, addWeeks, subWeeks, addDays, subDays } from "date-fns";
import { CalendarHeader, CalendarView } from "./calendar-header";
import { MonthView } from "./month-view";
import { WeekView } from "./week-view";
import { DayView } from "./day-view";
import { AgendaView } from "./agenda-view";
import { EventDetailDialog } from "./event-detail-dialog";
import { ScheduleEvent } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
import { ScheduleVisitDialog } from "@/components/forms/schedule-visit-dialog";

export function Calendar({
  events,
  lguOptions,
  onCreated,
}: {
  events: ScheduleEvent[];
  lguOptions: { id: string; name: string }[];
  onCreated: () => void;
}) {
  const [view, setView] = useState<CalendarView>("month");
  const [date, setDate] = useState(new Date());
  const [selected, setSelected] = useState<ScheduleEvent | null>(null);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const { isAdmin } = useAuth();

  function goPrev() {
    if (view === "month") setDate((d) => subMonths(d, 1));
    else if (view === "week") setDate((d) => subWeeks(d, 1));
    else if (view === "day") setDate((d) => subDays(d, 1));
  }

  function goNext() {
    if (view === "month") setDate((d) => addMonths(d, 1));
    else if (view === "week") setDate((d) => addWeeks(d, 1));
    else if (view === "day") setDate((d) => addDays(d, 1));
  }

  return (
    <div className="space-y-4">
      <CalendarHeader
        view={view}
        onViewChange={setView}
        date={date}
        onPrev={goPrev}
        onNext={goNext}
        onToday={() => setDate(new Date())}
        canCreate={isAdmin}
        onScheduleVisit={() => setScheduleDialogOpen(true)}
      />

      {/* Mobile: always the agenda list, driven purely by CSS breakpoints so
          it never depends on JS running before first paint. */}
      <div className="md:hidden">
        <AgendaView events={events} onSelectEvent={setSelected} />
      </div>

      {/* Desktop: whichever grid view is selected */}
      <div className="hidden md:block">
        {view === "month" && <MonthView date={date} events={events} onSelectEvent={setSelected} />}
        {view === "week" && <WeekView date={date} events={events} onSelectEvent={setSelected} />}
        {view === "day" && <DayView date={date} events={events} onSelectEvent={setSelected} />}
        {view === "agenda" && <AgendaView events={events} onSelectEvent={setSelected} />}
      </div>

      <EventDetailDialog event={selected} onClose={() => setSelected(null)} onDeleted={onCreated} />
      <ScheduleVisitDialog
        open={scheduleDialogOpen}
        onClose={() => setScheduleDialogOpen(false)}
        onCreated={onCreated}
        lguOptions={lguOptions}
      />
    </div>
  );
}
