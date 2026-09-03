"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Phone, Mail, CirclePlus, CalendarPlus, FilePlus, Pencil, Trash2 } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { isSupabaseConfigured, getSupabaseClient } from "@/lib/supabase";
import { useAuth } from "@/lib/use-auth";
import { mockLgus, mockConcerns, mockRequirements } from "@/lib/mock-data";
import { Lgu, Concern, Requirement } from "@/lib/types";
import { NewConcernDialog } from "@/components/forms/new-concern-dialog";
import { ScheduleVisitDialog } from "@/components/forms/schedule-visit-dialog";
import { AddRequirementDialog } from "@/components/forms/add-requirement-dialog";
import { AddLguDialog } from "@/components/forms/add-lgu-dialog";
import { InlineStatusSelect } from "@/components/forms/inline-status-select";
import { DeleteConfirmDialog } from "@/components/forms/delete-confirm-dialog";
import { CredentialsTab } from "@/components/lgus/credentials-tab";

const TABS = ["Overview", "Contacts", "System", "Credentials", "Concerns", "Requirements", "Schedules", "Documents", "History"];

const CONCERN_STATUS_OPTIONS: { value: Concern["status"]; label: string }[] = [
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
  const [concerns, setConcerns] = useState<Concern[]>([]);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [tab, setTab] = useState("Overview");
  const [concernDialogOpen, setConcernDialogOpen] = useState(false);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [requirementDialogOpen, setRequirementDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteLguOpen, setDeleteLguOpen] = useState(false);
  const [deletingConcern, setDeletingConcern] = useState<Concern | null>(null);
  const [deletingRequirement, setDeletingRequirement] = useState<Requirement | null>(null);
  const { isAdmin } = useAuth();

  async function load() {
    if (!isSupabaseConfigured) {
      const mock = mockLgus.find((l) => l.id === params.id) ?? mockLgus[0];
      setLgu(mock);
      setConcerns(mockConcerns.filter((c) => c.lgu_id === mock.id));
      setRequirements(mockRequirements.filter((r) => r.lgu_id === mock.id));
      return;
    }
    try {
      const supabase = getSupabaseClient();
      const [lguRes, concernsRes, requirementsRes] = await Promise.all([
        supabase.from("lgus").select("*").eq("id", params.id).maybeSingle(),
        supabase.from("concerns").select("*").eq("lgu_id", params.id).order("created_at", { ascending: false }),
        supabase.from("requirements").select("*").eq("lgu_id", params.id).order("created_at", { ascending: false }),
      ]);
      setLgu((lguRes.data as Lgu) ?? null);
      setConcerns((concernsRes.data as Concern[]) ?? []);
      setRequirements((requirementsRes.data as Requirement[]) ?? []);
    } catch {
      const mock = mockLgus.find((l) => l.id === params.id) ?? mockLgus[0];
      setLgu(mock);
      setConcerns(mockConcerns.filter((c) => c.lgu_id === mock.id));
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
        <p className="text-sm text-muted">Loading…</p>
      </AppShell>
    );
  }

  const openConcernCount = concerns.filter((c) => c.status !== "resolved").length;
  const pendingRequirementCount = requirements.filter((r) => r.status === "pending").length;

  return (
    <AppShell title={lgu.name}>
      <div className="mx-auto max-w-6xl space-y-5">
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
            <a href={lgu.contact_number ? `tel:${lgu.contact_number.replace(/\s+/g, "")}` : undefined}>
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
                <Button size="sm" variant="secondary" onClick={() => setConcernDialogOpen(true)}>
                  <CirclePlus className="h-3.5 w-3.5" /> New Concern
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
              <p className="text-xs text-muted">Network</p>
              <p className="mt-1 text-sm font-medium text-text">{lgu.network_setup}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted">District</p>
              <p className="mt-1 text-sm font-medium text-text">{lgu.district || "—"}</p>
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
              <p className="text-xs text-muted">Open Concerns</p>
              <p className="mt-1 text-sm font-medium text-text">{openConcernCount}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted">Pending Requirements</p>
              <p className="mt-1 text-sm font-medium text-text">{pendingRequirementCount}</p>
            </Card>
          </div>
        )}

        {tab === "Contacts" && (
          <Card>
            <CardHeader><CardTitle>Focal Person</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p className="font-medium text-text">{lgu.focal_person || "—"}</p>
              <p className="text-muted">{lgu.contact_number || "—"}</p>
              <p className="text-muted">{lgu.email || "—"}</p>
            </CardContent>
          </Card>
        )}

        {tab === "Credentials" && (
          <CredentialsTab
            lguName={lgu.name}
            anydeskId={lgu.anydesk_id}
            anydeskPassword={lgu.anydesk_password}
          />
        )}

        {tab === "Concerns" && (
          <Card>
            <CardContent className="divide-y divide-border p-0">
              {concerns.length === 0 && <p className="p-4 text-sm text-muted">No concerns on record.</p>}
              {concerns.map((c) => (
                <div key={c.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-text">{c.title}</p>
                    <p className="text-xs text-muted">{c.category} • {new Date(c.created_at).toLocaleDateString("en-PH")}</p>
                  </div>
                  {isAdmin ? (
                    <div className="flex items-center gap-2">
                      <InlineStatusSelect
                        table="concerns"
                        id={c.id}
                        value={c.status}
                        options={CONCERN_STATUS_OPTIONS}
                        logLabel="Updated concern status"
                        target={c.title}
                        onUpdated={(newStatus) =>
                          setConcerns((prev) => prev.map((x) => (x.id === c.id ? { ...x, status: newStatus } : x)))
                        }
                        className="w-32"
                      />
                      <button
                        onClick={() => setDeletingConcern(c)}
                        className="text-muted hover:text-critical"
                        aria-label={`Delete ${c.title}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs font-medium capitalize text-muted">{c.status.replace("_", " ")}</span>
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

        {["System", "Schedules", "Documents", "History"].includes(tab) && (
          <Card className="p-8 text-center text-sm text-muted">
            This section is scaffolded and ready to be wired to your Supabase tables.
          </Card>
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
        warning="This also deletes all of its concerns, schedules, requirements, documents, and network devices."
        logLabel="Deleted LGU"
      />
      {deletingConcern && (
        <DeleteConfirmDialog
          open={!!deletingConcern}
          onClose={() => setDeletingConcern(null)}
          onDeleted={load}
          table="concerns"
          id={deletingConcern.id}
          itemLabel={deletingConcern.title}
          logLabel="Deleted concern"
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
      <NewConcernDialog
        open={concernDialogOpen}
        onClose={() => setConcernDialogOpen(false)}
        onCreated={load}
        lguOptions={[{ id: lgu.id, name: lgu.name }]}
        fixedLguId={lgu.id}
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
    </AppShell>
  );
}
