"use client";

import { CalendarDays, Clock, Building2 } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScheduleEvent } from "@/lib/types";
import { TYPE_CHIP, TYPE_LABEL } from "./event-style";
import Link from "next/link";

export function EventDetailDialog({
  event,
  onClose,
}: {
  event: ScheduleEvent | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!event} onClose={onClose} title="Visit details">
      {event && (
        <div className="space-y-4">
          <div>
            <span className={`inline-block rounded-sm px-2 py-0.5 text-xs font-medium ${TYPE_CHIP[event.type]}`}>
              {TYPE_LABEL[event.type]}
            </span>
            <h3 className="mt-2 text-base font-semibold text-text">{event.title}</h3>
          </div>

          <div className="space-y-2 text-sm text-text">
            <div className="flex items-center gap-2 text-muted">
              <Building2 className="h-4 w-4" />
              <Link href={`/lgus/${event.lgu_id}`} className="text-brand hover:underline" onClick={onClose}>
                {event.lgu_name}
              </Link>
            </div>
            <div className="flex items-center gap-2 text-muted">
              <CalendarDays className="h-4 w-4" />
              {new Date(event.date).toLocaleDateString("en-PH", {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </div>
            <div className="flex items-center gap-2 text-muted">
              <Clock className="h-4 w-4" />
              {event.time}
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-border pt-3">
            <Button size="sm" variant="secondary" onClick={onClose}>
              Close
            </Button>
            <Link href={`/lgus/${event.lgu_id}`}>
              <Button size="sm">View LGU</Button>
            </Link>
          </div>
        </div>
      )}
    </Dialog>
  );
}
