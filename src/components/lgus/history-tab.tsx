"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Building2, Ticket as TicketIcon, CircleCheck, ClipboardList, CalendarDays, Paperclip, Rocket, StickyNote } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { isSupabaseConfigured, getSupabaseClient } from "@/lib/supabase";
import { mockSchedule, mockDocuments, mockLguNotes } from "@/lib/mock-data";
import { Lgu, Ticket, Requirement, ScheduleEvent, LguDocument, LguNote } from "@/lib/types";
import { NOTE_CATEGORY_OPTIONS, optionLabel } from "@/lib/options";
import { cn } from "@/lib/utils";

type Kind = "lgu" | "deployed" | "ticket" | "resolved" | "requirement" | "visit" | "document" | "note";

interface HistoryEvent {
  id: string;
  at: string; // ISO date or datetime
  kind: Kind;
  title: string;
  detail?: string;
  href?: string;
}

const KIND_ICON: Record<Kind, typeof Building2> = {
  lgu: Building2,
  deployed: Rocket,
  ticket: TicketIcon,
  resolved: CircleCheck,
  requirement: ClipboardList,
  visit: CalendarDays,
  document: Paperclip,
  note: StickyNote,
};

const KIND_TONE: Record<Kind, string> = {
  lgu: "text-muted",
  deployed: "text-success",
  ticket: "text-warning",
  resolved: "text-success",
  requirement: "text-orientation",
  visit: "text-feedback",
  document: "text-muted",
  note: "text-orientation",
};

const PAGE = 25;

// A merged, newest-first timeline of everything that has happened with this
// LGU: tickets opened/resolved, requirements added, visits, documents. It's
// assembled from the records themselves rather than the audit log, because
// audit entries only store a free-text target and can't be reliably tied to
// one LGU. Requirement status changes aren't timestamped in the schema, so
// only when a requirement was added appears here.
export function HistoryTab({
  lgu,
  tickets,
  requirements,
  reloadKey,
}: {
  lgu: Lgu;
  tickets: Ticket[];
  requirements: Requirement[];
  reloadKey: number;
}) {
  const [schedules, setSchedules] = useState<ScheduleEvent[]>([]);
  const [documents, setDocuments] = useState<LguDocument[]>([]);
  const [notes, setNotes] = useState<LguNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [shown, setShown] = useState(PAGE);

  useEffect(() => {
    async function load() {
      if (!isSupabaseConfigured) {
        setSchedules(mockSchedule.filter((s) => s.lgu_id === lgu.id));
        setDocuments(mockDocuments.filter((d) => d.lgu_id === lgu.id));
        setNotes(mockLguNotes.filter((n) => n.lgu_id === lgu.id));
        setLoading(false);
        return;
      }
      try {
        const supabase = getSupabaseClient();
        const [sRes, dRes, nRes] = await Promise.all([
          supabase.from("schedules").select("*").eq("lgu_id", lgu.id),
          supabase.from("documents").select("*").eq("lgu_id", lgu.id),
          supabase.from("lgu_notes").select("*").eq("lgu_id", lgu.id),
        ]);
        setSchedules((sRes.data as ScheduleEvent[]) ?? []);
        setDocuments((dRes.data as LguDocument[]) ?? []);
        setNotes((nRes.data as LguNote[]) ?? []);
      } catch {
        setSchedules([]);
        setDocuments([]);
        setNotes([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [lgu.id, reloadKey]);

  const events = useMemo(() => {
    const out: HistoryEvent[] = [];

    if (lgu.created_at) {
      out.push({ id: "lgu-created", at: lgu.created_at, kind: "lgu", title: "Added to LISDMS", detail: lgu.name });
    }
    if (lgu.date_deployed) {
      out.push({
        id: "lgu-deployed",
        at: lgu.date_deployed,
        kind: "deployed",
        title: "Deployment date",
        detail: [lgu.system, lgu.app_version].filter(Boolean).join(" ") || undefined,
      });
    }

    tickets.forEach((t) => {
      out.push({
        id: `t-${t.id}`,
        at: t.created_at,
        kind: "ticket",
        title: `Ticket #${t.ticket_number} opened`,
        detail: t.title,
        href: `/tickets/${t.id}`,
      });
      if (t.resolved_at) {
        out.push({
          id: `tr-${t.id}`,
          at: t.resolved_at,
          kind: "resolved",
          title: `Ticket #${t.ticket_number} resolved`,
          detail: t.title,
          href: `/tickets/${t.id}`,
        });
      }
    });

    requirements.forEach((r) => {
      if (r.created_at) {
        out.push({ id: `r-${r.id}`, at: r.created_at, kind: "requirement", title: "Requirement added", detail: r.name });
      }
    });

    schedules.forEach((s) => {
      out.push({
        id: `s-${s.id}`,
        at: `${s.date}T${String(s.time || "00:00").slice(0, 5)}`,
        kind: "visit",
        title: s.title,
        detail: "Site visit",
      });
    });

    documents.forEach((d) => {
      out.push({
        id: `d-${d.id}`,
        at: d.uploaded_at,
        kind: "document",
        title: "Document uploaded",
        detail: d.file_name,
      });
    });

    notes.forEach((n) => {
      out.push({
        id: `n-${n.id}`,
        at: `${n.note_date}T12:00`,
        kind: "note",
        title: `${optionLabel(NOTE_CATEGORY_OPTIONS, n.category)} update`,
        detail: n.body,
      });
    });

    return out
      .filter((e) => !Number.isNaN(new Date(e.at).getTime()))
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [lgu, tickets, requirements, schedules, documents, notes]);

  if (loading) return <Skeleton className="h-48 w-full" />;

  if (events.length === 0) {
    return <EmptyState title="No history yet" description={`Activity for ${lgu.name} will build up here as tickets, visits and documents are added.`} />;
  }

  const visible = events.slice(0, shown);
  const now = Date.now();

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="p-4">
          <ol className="relative space-y-5 border-l border-border pl-6">
            {visible.map((e) => {
              const Icon = KIND_ICON[e.kind];
              const upcoming = new Date(e.at).getTime() > now;
              const title = e.href ? (
                <Link href={e.href} className="text-sm font-medium text-brand underline decoration-brand/30 underline-offset-2 hover:decoration-brand">
                  {e.title}
                </Link>
              ) : (
                <span className="text-sm font-medium text-text">{e.title}</span>
              );
              return (
                <li key={e.id} className="relative">
                  <span className="absolute -left-[37px] flex h-6 w-6 items-center justify-center rounded-full border border-border bg-surface">
                    <Icon className={cn("h-3.5 w-3.5", KIND_TONE[e.kind])} aria-hidden />
                  </span>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    {title}
                    {upcoming && (
                      <span className="rounded-sm bg-orientation/10 px-1.5 py-0.5 text-[10px] font-medium text-orientation">Upcoming</span>
                    )}
                  </div>
                  {e.detail && <p className="text-sm text-muted">{e.detail}</p>}
                  <p className="mt-0.5 text-xs text-muted">
                    {new Date(e.at).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
                  </p>
                </li>
              );
            })}
          </ol>
        </CardContent>
      </Card>

      {events.length > shown && (
        <div className="flex justify-center">
          <Button size="sm" variant="secondary" onClick={() => setShown((n) => n + PAGE)}>
            Show more ({events.length - shown} older)
          </Button>
        </div>
      )}
    </div>
  );
}
