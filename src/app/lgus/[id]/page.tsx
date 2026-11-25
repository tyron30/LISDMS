"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Phone, Mail, TicketPlus, CalendarPlus, FilePlus, Pencil, Trash2 } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { isSupabaseConfigured, getSupabaseClient } from "@/lib/supabase";
import { useAuth } from "@/lib/use-auth";
import { mockLgus, mockTickets, mockRequirements } from "@/lib/mock-data";
import { Lgu, Ticket, Requirement } from "@/lib/types";
import { TicketDialog } from "@/components/forms/ticket-dialog";
import { ScheduleVisitDialog } from "@/components/forms/schedule-visit-dialog";
import { AddRequirementDialog } from "@/components/forms/add-requirement-dialog";
import { AddLguDialog } from "@/components/forms/add-lgu-dialog";
import { InlineStatusSelect } from "@/components/forms/inline-status-select";
import { DeleteConfirmDialog } from "@/components/forms/delete-confirm-dialog";
import { CredentialsTab } from "@/components/lgus/credentials-tab";
import { SystemTab } from "@/components/lgus/system-tab";
import { SchedulesTab } from "@/components/lgus/schedules-tab";
import { DocumentsTab } from "@/components/lgus/documents-tab";
import { HistoryTab } from "@/components/lgus/history-tab";
import { NotesTab } from "@/components/lgus/notes-tab";
import { ChecklistBadge } from "@/components/ui/checklist-badge";
import { MOA_STATUS_OPTIONS, SIGNOFF_OPTIONS, ORIENTATION_OPTIONS, splitList, telHref, firstPhoneHref } from "@/lib/options";
import { Skeleton } from "@/components/ui/skeleton";

const TABS = ["Overview", "Contacts", "System", "Credentials", "Tickets", "Requirements", "Updates", "Schedules", "Documents", "History"];

const TICKET_STATUS_OPTIONS: { value: Ticket["status"]; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "resolved", label: "Resolved" },
];

const REQUIREMENT_STATUS_OPTIONS: { value: Requirement["status"]; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "submitted", label: "Submitted" },
  { value: "waived", label: "Waived" },
];

export default function LguDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [lgu, setLgu] = useState<Lgu | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const requestedTab = useSearchParams().get("tab") ?? "";
  const [tab, setTab] = useState(TABS.includes(requestedTab) ? requestedTab : "Overview");
  const [reloadKey, setReloadKey] = useState(0);
  const [ticketDialogOpen, setTicketDialogOpen] = useState(false);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [requirementDialogOpen, setRequirementDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteLguOpen, setDeleteLguOpen] = useState(false);
  const [deletingTicket, setDeletingTicket] = useState<Ticket | null>(null);
  const [deletingRequirement, setDeletingRequirement] = useState<Requirement | null>(null);
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);
  const [editingRequirement, setEditingRequirement] = useState<Requirement | null>(null);
  const { isAdmin } = useAuth();

  async function load() {
    setReloadKey((k) => k + 1);
    if (!isSupabaseConfigured) {
      const mock = mockLgus.find((l) => l.id === params.id) ?? mockLgus[0];
      setLgu(mock);
      setTickets(mockTickets.filter((t) => t.lgu_id === mock.id));
      setRequirements(mockRequirements.filter((r) => r.lgu_id === mock.id));
      return;
    }
    try {
      const supabase = getSupabaseClient();
      const [lguRes, ticketsRes, requirementsRes] = await Promise.all([
        supabase.from("lgus").select("*, assigned_persons(name)").eq("id", params.id).maybeSingle(),
        supabase
          .from("tickets")
          .select("*, assigned_persons(name)")
          .eq("lgu_id", params.id)
          .order("created_at", { ascending: false }),
        supabase.from("requirements").select("*").eq("lgu_id", params.id).order("created_at", { ascending: false }),
      ]);
      const lguRow = lguRes.data as (Record<string, unknown> & { assigned_persons?: { name?: string } | null }) | null;
      setLgu(
        lguRow
          ? ({
              ...lguRow,
              assigned_person_name: lguRow.assigned_persons?.name ?? null,
            } as Lgu)
          : null
      );
      const mappedTickets = (ticketsRes.data ?? []).map((row: Record<string, unknown>) => ({
        ...row,
        assigned_person_name: (row.assigned_persons as { name?: string } | null)?.name ?? null,
      })) as Ticket[];
      setTickets(mappedTickets);
      setRequirements((requirementsRes.data as Requirement[]) ?? []);
    } catch {
      const mock = mockLgus.find((l) => l.id === params.id) ?? mockLgus[0];
      setLgu(mock);
      setTickets(mockTickets.filter((t) => t.lgu_id === mock.id));
      setRequirements(mockRequirements.filter((r) => r.lgu_id === mock.id));
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  if (!lgu) {
    return (
      <AppShell title="LGU">
        <div className="mx-auto max-w-6xl space-y-5">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-24" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-8 w-20" />
            </div>
          </div>
          <Skeleton className="h-8 w-full" />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
        </div>
      </AppShell>
    );
  }

  const openTicketCount = tickets.filter((t) => t.status !== "resolved").length;
  const pendingRequirementCount = requirements.filter((r) => r.status === "pending").length;

  return (
    <AppShell title={lgu.name}>
      <div className="mx-auto max-w-6xl space-y-5 pb-20 md:pb-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold text-text">{lgu.name.toUpperCase()}</h2>
              <StatusBadge status={lgu.status} />
            </div>
            <p className="text-sm text-muted">{lgu.province}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {/* Real tel:/mailto: links — no dialog needed, just hand off to the OS/browser. */}
            <a href={firstPhoneHref(lgu.contact_number)}>
              <Button size="sm" variant="secondary" disabled={!lgu.contact_number}>
                <Phone className="h-3.5 w-3.5" /> Call
              </Button>
            </a>
            <a href={lgu.email ? `mailto:${lgu.email}` : undefined}>
              <Button size="sm" variant="secondary" disabled={!lgu.email}>
                <Mail className="h-3.5 w-3.5" /> Email
              </Button>
            </a>
            {isAdmin && (
              <>
                <Button size="sm" variant="secondary" onClick={() => setEditDialogOpen(true)}>
                  <Pencil className="h-3.5 w-3.5" /> Edit LGU
                </Button>
                <Button size="sm" variant="destructive" onClick={() => setDeleteLguOpen(true)}>
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setTicketDialogOpen(true)}>
                  <TicketPlus className="h-3.5 w-3.5" /> New Ticket
                </Button>
                <Button size="sm" onClick={() => setScheduleDialogOpen(true)}>
                  <CalendarPlus className="h-3.5 w-3.5" /> Schedule Visit
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="flex gap-1 overflow-x-auto border-b border-border">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                tab === t ? "border-brand text-brand" : "border-transparent text-muted hover:text-text"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === "Overview" && (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Card className="p-4">
              <p className="text-xs text-muted">System</p>
              <p className="mt-1 font-mono text-sm font-medium text-text">{lgu.system} {lgu.app_version}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted">QDTS Setup</p>
              <p className="mt-1 text-sm font-medium text-text">{lgu.network_setup}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted">District</p>
              <p className="mt-1 text-sm font-medium text-text">{lgu.district || "—"}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted">Assigned Person</p>
              <p className="mt-1 text-sm font-medium text-text">{lgu.assigned_person_name || "Unassigned"}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted">Date Deployed</p>
              <p className="mt-1 text-sm font-medium text-text">
                {lgu.date_deployed
                  ? new Date(lgu.date_deployed).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" })
                  : "—"}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted">Open Tickets</p>
              <p className="mt-1 text-sm font-medium text-text">{openTicketCount}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted">Pending Requirements</p>
              <p className="mt-1 text-sm font-medium text-text">{pendingRequirementCount}</p>
            </Card>
          </div>
        )}

        {tab === "Overview" && (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">MOA &amp; Orientation</h3>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Card className="p-4">
                <p className="mb-1.5 text-xs text-muted">With MOA</p>
                <ChecklistBadge value={lgu.moa_status} options={MOA_STATUS_OPTIONS} />
              </Card>
              <Card className="p-4">
                <p className="mb-1.5 text-xs text-muted">With SP Resolution</p>
                <ChecklistBadge value={lgu.sp_resolution} options={SIGNOFF_OPTIONS} />
              </Card>
              <Card className="p-4">
                <p className="mb-1.5 text-xs text-muted">With Gov&apos;s Signature</p>
                <ChecklistBadge value={lgu.gov_signature} options={SIGNOFF_OPTIONS} />
              </Card>
              <Card className="p-4">
                <p className="mb-1.5 text-xs text-muted">Orientation</p>
                <ChecklistBadge value={lgu.orientation_status} options={ORIENTATION_OPTIONS} />
              </Card>
            </div>
          </div>
        )}

        {tab === "Contacts" && (
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Head of Agency</CardTitle></CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p className="font-medium text-text">{lgu.head_of_agency || "—"}</p>
                <p className="text-muted">{lgu.designation || "No designation set"}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>QDTS Point Person(s)</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                {splitList(lgu.focal_person).length === 0 ? (
                  <p className="text-muted">—</p>
                ) : (
                  <ul className="space-y-0.5">
                    {splitList(lgu.focal_person).map((p) => (
                      <li key={p} className="font-medium text-text">{p}</li>
                    ))}
                  </ul>
                )}
                <div className="space-y-1">
                  <p className="text-xs text-muted">Contact numbers</p>
                  {splitList(lgu.contact_number).length === 0 ? (
                    <p className="text-muted">—</p>
                  ) : (
                    splitList(lgu.contact_number).map((n) => (
                      <a key={n} href={telHref(n)} className="block text-brand underline decoration-brand/30 underline-offset-2 hover:decoration-brand">
                        {n}
                      </a>
                    ))
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted">Email</p>
                  {splitList(lgu.email).length === 0 ? (
                    <p className="text-muted">—</p>
                  ) : (
                    splitList(lgu.email).map((m) => (
                      <a key={m} href={`mailto:${m}`} className="block break-all text-brand underline decoration-brand/30 underline-offset-2 hover:decoration-brand">
                        {m}
                      </a>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {tab === "Credentials" && (
          <CredentialsTab
            lguName={lgu.name}
            anydeskId={lgu.anydesk_id}
            anydeskPassword={lgu.anydesk_password}
          />
        )}

        {tab === "Tickets" && (
          <Card>
            <CardContent className="divide-y divide-border p-0">
              {tickets.length === 0 && <p className="p-4 text-sm text-muted">No tickets on record.</p>}
              {tickets.map((t) => (
                <div key={t.id} className="flex items-center justify-between px-4 py-3">
                  <div className="min-w-0">
                    <Link href={`/tickets/${t.id}`} className="truncate text-sm font-medium text-brand underline decoration-brand/30 underline-offset-2 hover:decoration-brand">
                      #{t.ticket_number} — {t.title}
                    </Link>
                    <p className="truncate text-xs text-muted">
                      {t.category} • {t.assigned_person_name ? `Assigned: ${t.assigned_person_name} • ` : ""}
                      {new Date(t.created_at).toLocaleDateString("en-PH")}
                    </p>
                  </div>
                  {isAdmin ? (
                    <div className="flex shrink-0 items-center gap-2">
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
                  ) : (
                    <span className="shrink-0 text-xs font-medium capitalize text-muted">{t.status.replace("_", " ")}</span>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {tab === "Requirements" && (
          <div className="space-y-3">
            {isAdmin && (
              <div className="flex justify-end">
                <Button size="sm" variant="secondary" onClick={() => setRequirementDialogOpen(true)}>
                  <FilePlus className="h-3.5 w-3.5" /> Add Requirement
                </Button>
              </div>
            )}
            <Card>
              <CardContent className="divide-y divide-border p-0">
                {requirements.length === 0 && <p className="p-4 text-sm text-muted">No requirements on record.</p>}
                {requirements.map((r) => (
                  <div key={r.id} className="flex items-center justify-between px-4 py-3">
                    <p className="text-sm font-medium text-text">{r.name}</p>
                    {isAdmin ? (
                      <div className="flex items-center gap-2">
                        <InlineStatusSelect
                          table="requirements"
                          id={r.id}
                          value={r.status}
                          options={REQUIREMENT_STATUS_OPTIONS}
                          logLabel="Updated requirement status"
                          target={r.name}
                          onUpdated={(newStatus) =>
                            setRequirements((prev) => prev.map((x) => (x.id === r.id ? { ...x, status: newStatus } : x)))
                          }
                          className="w-32"
                        />
                        <button
                          onClick={() => setEditingRequirement(r)}
                          className="text-muted hover:text-text"
                          aria-label={`Edit ${r.name}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setDeletingRequirement(r)}
                          className="text-muted hover:text-critical"
                          aria-label={`Delete ${r.name}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs font-medium capitalize text-muted">{r.status}</span>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}

        {tab === "Updates" && <NotesTab lguId={lgu.id} lguName={lgu.name} isAdmin={isAdmin} reloadKey={reloadKey} />}

        {tab === "System" && <SystemTab lgu={lgu} isAdmin={isAdmin} reloadKey={reloadKey} />}

        {tab === "Schedules" && (
          <SchedulesTab lguId={lgu.id} lguName={lgu.name} isAdmin={isAdmin} reloadKey={reloadKey} />
        )}

        {tab === "Documents" && <DocumentsTab lguId={lgu.id} isAdmin={isAdmin} reloadKey={reloadKey} />}

        {tab === "History" && (
          <HistoryTab lgu={lgu} tickets={tickets} requirements={requirements} reloadKey={reloadKey} />
        )}
      </div>

      {/* Mobile-only quick actions, always reachable with one thumb at the
          bottom of the screen instead of scrolling back up to the header. */}
      <div className="fixed inset-x-0 bottom-0 z-30 flex items-stretch border-t border-border bg-surface/95 shadow-[0_-4px_16px_-4px_rgba(0,0,0,0.15)] backdrop-blur-sm md:hidden">
        <a
          href={firstPhoneHref(lgu.contact_number)}
          className={`flex min-h-[52px] flex-1 flex-col items-center justify-center gap-0.5 ${!lgu.contact_number ? "pointer-events-none opacity-40" : "text-muted hover:text-brand"}`}
        >
          <Phone className="h-5 w-5" />
          <span className="text-[10px] font-medium">Call</span>
        </a>
        <a
          href={lgu.email ? `mailto:${lgu.email}` : undefined}
          className={`flex min-h-[52px] flex-1 flex-col items-center justify-center gap-0.5 border-l border-border ${!lgu.email ? "pointer-events-none opacity-40" : "text-muted hover:text-brand"}`}
        >
          <Mail className="h-5 w-5" />
          <span className="text-[10px] font-medium">Email</span>
        </a>
        {isAdmin && (
          <>
            <button
              onClick={() => setTicketDialogOpen(true)}
              className="flex min-h-[52px] flex-1 flex-col items-center justify-center gap-0.5 border-l border-border text-muted hover:text-brand"
            >
              <TicketPlus className="h-5 w-5" />
              <span className="text-[10px] font-medium">Ticket</span>
            </button>
            <button
              onClick={() => setScheduleDialogOpen(true)}
              className="flex min-h-[52px] flex-1 flex-col items-center justify-center gap-0.5 border-l border-border text-muted hover:text-brand"
            >
              <CalendarPlus className="h-5 w-5" />
              <span className="text-[10px] font-medium">Schedule</span>
            </button>
          </>
        )}
      </div>

      <AddLguDialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        onCreated={load}
        lgu={lgu}
      />
      <DeleteConfirmDialog
        open={deleteLguOpen}
        onClose={() => setDeleteLguOpen(false)}
        onDeleted={() => router.push("/lgus")}
        table="lgus"
        id={lgu.id}
        itemLabel={lgu.name}
        warning="This also deletes all of its tickets, schedules, requirements, documents, and network devices."
        logLabel="Deleted LGU"
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
      {deletingRequirement && (
        <DeleteConfirmDialog
          open={!!deletingRequirement}
          onClose={() => setDeletingRequirement(null)}
          onDeleted={load}
          table="requirements"
          id={deletingRequirement.id}
          itemLabel={deletingRequirement.name}
          logLabel="Deleted requirement"
        />
      )}
      <TicketDialog
        open={ticketDialogOpen}
        onClose={() => setTicketDialogOpen(false)}
        onCreated={load}
        lguOptions={[{ id: lgu.id, name: lgu.name }]}
        fixedLguId={lgu.id}
      />
      <TicketDialog
        open={!!editingTicket}
        onClose={() => setEditingTicket(null)}
        onCreated={load}
        lguOptions={[{ id: lgu.id, name: lgu.name }]}
        fixedLguId={lgu.id}
        ticket={editingTicket ?? undefined}
      />
      <ScheduleVisitDialog
        open={scheduleDialogOpen}
        onClose={() => setScheduleDialogOpen(false)}
        onCreated={load}
        lguOptions={[{ id: lgu.id, name: lgu.name }]}
        fixedLguId={lgu.id}
      />
      <AddRequirementDialog
        open={requirementDialogOpen}
        onClose={() => setRequirementDialogOpen(false)}
        onCreated={load}
        lguOptions={[{ id: lgu.id, name: lgu.name }]}
        fixedLguId={lgu.id}
      />
      <AddRequirementDialog
        open={!!editingRequirement}
        onClose={() => setEditingRequirement(null)}
        onCreated={load}
        lguOptions={[{ id: lgu.id, name: lgu.name }]}
        fixedLguId={lgu.id}
        requirement={editingRequirement ?? undefined}
      />
    </AppShell>
  );
}
