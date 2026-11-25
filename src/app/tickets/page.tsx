"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Search, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { isSupabaseConfigured, getSupabaseClient } from "@/lib/supabase";
import { useAuth } from "@/lib/use-auth";
import { mockTickets, mockLgus } from "@/lib/mock-data";
import { Ticket, TicketStatus, TicketPriority } from "@/lib/types";
import { TicketDialog } from "@/components/forms/ticket-dialog";
import { InlineStatusSelect } from "@/components/forms/inline-status-select";
import { DeleteConfirmDialog } from "@/components/forms/delete-confirm-dialog";
import { ListSkeleton } from "@/components/ui/skeleton";
import { useSupabaseData, fetchLguOptions, joinedName, toLguOptions, withLguName, LguOption } from "@/lib/data";
import { ErrorState } from "@/components/ui/error-state";
import { TICKET_STATUS_OPTIONS, TICKET_PRIORITY_OPTIONS, PRIORITY_DOT } from "@/lib/options";

export default function TicketsPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<TicketStatus | "all">("all");
  const [priorityFilter, setPriorityFilter] = useState<TicketPriority | "all">("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);
  const [deletingTicket, setDeletingTicket] = useState<Ticket | null>(null);
  const { isAdmin } = useAuth();

  const { data, setData, loading, error, reload: load } = useSupabaseData(
    async (sb) => {
      const [t, lguOptions] = await Promise.all([
        sb.from("tickets").select("*, lgus(name), assigned_persons(name)").order("created_at", { ascending: false }),
        fetchLguOptions(sb),
      ]);
      if (t.error) throw t.error;
      const tickets = withLguName<Ticket>(t.data).map((r) => ({
        ...r,
        assigned_person_name: joinedName(r as unknown as Record<string, unknown>, "assigned_persons"),
      }));
      return { tickets, lguOptions };
    },
    {
      mock: { tickets: mockTickets, lguOptions: toLguOptions(mockLgus) },
      empty: { tickets: [] as Ticket[], lguOptions: [] as LguOption[] },
    }
  );
  const { tickets, lguOptions } = data;
  const setTickets = (fn: (prev: Ticket[]) => Ticket[]) => setData((d) => ({ ...d, tickets: fn(d.tickets) }));


  const filtered = useMemo(() => {
    return tickets.filter((t) => {
      const matchesQuery =
        t.title.toLowerCase().includes(query.toLowerCase()) ||
        t.lgu_name.toLowerCase().includes(query.toLowerCase()) ||
        String(t.ticket_number).includes(query);
      const matchesStatus = statusFilter === "all" || t.status === statusFilter;
      const matchesPriority = priorityFilter === "all" || t.priority === priorityFilter;
      return matchesQuery && matchesStatus && matchesPriority;
    });
  }, [tickets, query, statusFilter, priorityFilter]);

  return (
    <AppShell title="Tickets">
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-col gap-2 sm:flex-row">
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <Input
                placeholder="Search #, title, LGU..."
                className="pl-9"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as TicketStatus | "all")} className="sm:w-40">
              <option value="all">All statuses</option>
              {TICKET_STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
            <Select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value as TicketPriority | "all")} className="sm:w-36">
              <option value="all">All priorities</option>
              {TICKET_PRIORITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
          {isAdmin && (
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4" /> New Ticket
            </Button>
          )}
        </div>

        {error ? (
          <ErrorState message={error} onRetry={load} />
        ) : loading ? (
          <ListSkeleton rows={5} />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No tickets found"
            description="Try a different search or filter, or create a new ticket."
            actionLabel={isAdmin ? "New Ticket" : undefined}
            onAction={() => setDialogOpen(true)}
          />
        ) : (
          <div className="space-y-2">
            {filtered.map((t) => (
              <Card
                key={t.id}
                onClick={() => router.push(`/tickets/${t.id}`)}
                className="flex cursor-pointer items-center gap-3 p-4 transition-colors hover:bg-bg/40"
              >
                <span className={`h-2 w-2 shrink-0 rounded-full ${PRIORITY_DOT[t.priority]}`} aria-hidden />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/tickets/${t.id}`}
                    className="truncate text-sm font-medium text-brand underline decoration-brand/30 underline-offset-2 hover:decoration-brand"
                  >
                    #{t.ticket_number} — {t.title}
                  </Link>
                  <p className="truncate text-xs text-muted">
                    <Link
                      href={`/lgus/${t.lgu_id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-brand underline decoration-brand/30 underline-offset-2 hover:decoration-brand"
                    >
                      {t.lgu_name}
                    </Link>
                    {" • "}
                    {t.category}
                    {t.assigned_person_name ? ` • Assigned: ${t.assigned_person_name}` : ""} •{" "}
                    {new Date(t.created_at).toLocaleDateString("en-PH", { month: "short", day: "numeric" })}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3" onClick={(e) => e.stopPropagation()}>
                  <span className="hidden text-xs font-medium capitalize text-muted sm:inline">{t.priority}</span>
                  {isAdmin ? (
                    <InlineStatusSelect
                      table="tickets"
                      id={t.id}
                      value={t.status}
                      options={TICKET_STATUS_OPTIONS}
                      logLabel="Updated ticket status"
                      target={`#${t.ticket_number} ${t.title}`}
                      onUpdated={(newStatus) =>
                        setTickets((prev) => prev.map((x) => (x.id === t.id ? { ...x, status: newStatus } : x)))
                      }
                      className="w-32"
                    />
                  ) : (
                    <Badge className="capitalize">{t.status.replace("_", " ")}</Badge>
                  )}
                  {isAdmin && (
                    <div className="flex items-center gap-2 border-l border-border pl-3">
                      <button
                        onClick={() => setEditingTicket(t)}
                        className="text-muted hover:text-text"
                        aria-label={`Edit ticket #${t.ticket_number}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setDeletingTicket(t)}
                        className="text-muted hover:text-critical"
                        aria-label={`Delete ticket #${t.ticket_number}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden />
              </Card>
            ))}
          </div>
        )}
      </div>

      <TicketDialog open={dialogOpen} onClose={() => setDialogOpen(false)} onCreated={load} lguOptions={lguOptions} />
      <TicketDialog
        open={!!editingTicket}
        onClose={() => setEditingTicket(null)}
        onCreated={load}
        lguOptions={lguOptions}
        ticket={editingTicket ?? undefined}
      />
      {deletingTicket && (
        <DeleteConfirmDialog
          open={!!deletingTicket}
          onClose={() => setDeletingTicket(null)}
          onDeleted={load}
          table="tickets"
          id={deletingTicket.id}
          itemLabel={`#${deletingTicket.ticket_number} ${deletingTicket.title}`}
          logLabel="Deleted ticket"
        />
      )}
    </AppShell>
  );
}
