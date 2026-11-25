"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/badge";
import { ChecklistBadge } from "@/components/ui/checklist-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { TableSkeleton } from "@/components/ui/skeleton";
import { InlineStatusSelect } from "@/components/forms/inline-status-select";
import { AddNoteDialog } from "@/components/forms/add-note-dialog";
import { NoteSnippet } from "@/components/lgus/note-snippet";
import { useSupabaseData, joinedName } from "@/lib/data";
import { useAuth } from "@/lib/use-auth";
import { mockLgus, mockLguNotes, mockTickets } from "@/lib/mock-data";
import { Lgu, LguNote } from "@/lib/types";
import { MOA_STATUS_OPTIONS, ORIENTATION_OPTIONS, districtRank } from "@/lib/options";

const UNASSIGNED = "Unassigned";
const byName = (a: string, b: string) => (a === UNASSIGNED ? 1 : b === UNASSIGNED ? -1 : a.localeCompare(b));
const personOf = (l: Lgu) => l.assigned_person_name || UNASSIGNED;

// The spreadsheet's "Assignments" tab: every LGU grouped under the staff
// member responsible for it, with MOA / orientation state (editable in place
// by admins), the latest dated update (anyone can add one), and open tickets.
export default function AssignmentsPage() {
  const { isAdmin } = useAuth();
  const [query, setQuery] = useState("");
  const [person, setPerson] = useState("all");
  const [noteFor, setNoteFor] = useState<Lgu | null>(null);

  const { data, setData, loading, error, usingMock, reload } = useSupabaseData(
    async (sb) => {
      const [l, n, t] = await Promise.all([
        sb.from("lgus").select("*, assigned_persons(name)").order("name"),
        sb.from("lgu_notes").select("*").order("note_date", { ascending: false }).order("created_at", { ascending: false }).limit(2000),
        sb.from("tickets").select("lgu_id").neq("status", "resolved"),
      ]);
      if (l.error) throw l.error;
      if (n.error) throw n.error;
      if (t.error) throw t.error;
      return {
        lgus: (l.data ?? []).map((r) => ({ ...r, assigned_person_name: joinedName(r, "assigned_persons") })) as Lgu[],
        notes: (n.data ?? []) as LguNote[],
        openTickets: (t.data ?? []).map((r) => r.lgu_id as string),
      };
    },
    {
      mock: {
        lgus: mockLgus,
        notes: mockLguNotes,
        openTickets: mockTickets.filter((t) => t.status !== "resolved").map((t) => t.lgu_id),
      },
      empty: { lgus: [] as Lgu[], notes: [] as LguNote[], openTickets: [] as string[] },
    }
  );

  const latest = useMemo(() => {
    const m = new Map<string, LguNote>();
    [...data.notes]
      .sort((a, b) => b.note_date.localeCompare(a.note_date) || b.created_at.localeCompare(a.created_at))
      .forEach((n) => m.has(n.lgu_id) || m.set(n.lgu_id, n));
    return m;
  }, [data.notes]);

  const ticketCount = useMemo(() => {
    const m = new Map<string, number>();
    data.openTickets.forEach((id) => m.set(id, (m.get(id) ?? 0) + 1));
    return m;
  }, [data.openTickets]);

  const people = useMemo(() => Array.from(new Set(data.lgus.map(personOf))).sort(byName), [data.lgus]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return people
      .filter((p) => person === "all" || p === person)
      .map((p) => ({
        person: p,
        lgus: data.lgus
          .filter((l) => personOf(l) === p && (!q || l.name.toLowerCase().includes(q)))
          .sort((a, b) => districtRank(a.district) - districtRank(b.district) || a.name.localeCompare(b.name)),
      }))
      .filter((g) => g.lgus.length > 0);
  }, [people, data.lgus, query, person]);

  const setField = (id: string, patch: Partial<Lgu>) =>
    setData((d) => ({ ...d, lgus: d.lgus.map((l) => (l.id === id ? { ...l, ...patch } : l)) }));

  const select = (l: Lgu, column: "moa_status" | "orientation_status", options: typeof MOA_STATUS_OPTIONS, label: string) =>
    isAdmin ? (
      <InlineStatusSelect
        table="lgus"
        id={l.id}
        column={column}
        value={l[column] ?? ""}
        options={options}
        logLabel={`Updated ${label}`}
        target={l.name}
        onUpdated={(v) => setField(l.id, { [column]: v || null } as Partial<Lgu>)}
        className="w-36"
      />
    ) : (
      <ChecklistBadge value={l[column]} options={options} />
    );

  const snippet = (l: Lgu) => <NoteSnippet note={latest.get(l.id)} lguId={l.id} onAdd={() => setNoteFor(l)} />;

  return (
    <AppShell title="Assignments">
      <div className="mx-auto max-w-7xl space-y-6">
        {usingMock && (
          <p className="inline-block rounded-sm border border-warning/30 bg-warning/10 px-2 py-1 text-xs text-warning">
            Showing sample data — connect Supabase to see real assignments.
          </p>
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input placeholder="Search LGUs..." className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <Select value={person} onChange={(e) => setPerson(e.target.value)} className="sm:w-48">
            <option value="all">Everyone</option>
            {people.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
        </div>

        {error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : loading ? (
          <TableSkeleton rows={6} cols={6} />
        ) : groups.length === 0 ? (
          <EmptyState title="No LGUs found" description="Try a different search, or assign LGUs to a person from the LGU's Edit form." />
        ) : (
          groups.map((g) => (
            <section key={g.person} className="space-y-3">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h2 className="text-sm font-semibold text-text">{g.person}</h2>
                <span className="text-xs text-muted">
                  {g.lgus.length} LGU{g.lgus.length === 1 ? "" : "s"} · MOA done: {g.lgus.filter((l) => l.moa_status === "yes").length}/{g.lgus.length}
                </span>
              </div>

              <Card className="hidden overflow-hidden md:block">
                <table className="w-full text-sm">
                  <thead className="border-b border-border bg-bg/60 text-left text-xs font-medium text-muted">
                    <tr>
                      <th className="px-4 py-2.5">LGU</th>
                      <th className="px-4 py-2.5">Deployment</th>
                      <th className="px-4 py-2.5">MOA</th>
                      <th className="px-4 py-2.5">Orientation</th>
                      <th className="px-4 py-2.5">Latest update</th>
                      <th className="px-4 py-2.5">Tickets</th>
                      <th className="w-8 px-2 py-2.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {g.lgus.map((l) => (
                      <tr key={l.id} className="align-top hover:bg-bg/60">
                        <td className="px-4 py-3">
                          <Link href={`/lgus/${l.id}`} className="font-medium text-brand underline decoration-brand/30 underline-offset-2 hover:decoration-brand">
                            {l.name}
                          </Link>
                          <p className="text-xs text-muted">{l.district || "No district"}</p>
                        </td>
                        <td className="px-4 py-3"><StatusBadge status={l.status} /></td>
                        <td className="px-4 py-3">{select(l, "moa_status", MOA_STATUS_OPTIONS, "MOA status")}</td>
                        <td className="px-4 py-3">{select(l, "orientation_status", ORIENTATION_OPTIONS, "orientation status")}</td>
                        <td className="px-4 py-3">{snippet(l)}</td>
                        <td className="px-4 py-3 tabular-nums text-text">{ticketCount.get(l.id) ?? 0}</td>
                        <td className="px-2 py-3">
                          <Link href={`/lgus/${l.id}`} aria-label={`Open ${l.name}`}>
                            <ChevronRight className="h-4 w-4 text-muted" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>

              <div className="space-y-3 md:hidden">
                {g.lgus.map((l) => (
                  <Card key={l.id} className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <Link href={`/lgus/${l.id}`} className="font-medium text-brand underline decoration-brand/30 underline-offset-2">
                          {l.name}
                        </Link>
                        <p className="text-xs text-muted">{l.district || "No district"}</p>
                      </div>
                      <StatusBadge status={l.status} />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <ChecklistBadge value={l.moa_status} options={MOA_STATUS_OPTIONS} />
                      <ChecklistBadge value={l.orientation_status} options={ORIENTATION_OPTIONS} />
                    </div>
                    {snippet(l)}
                  </Card>
                ))}
              </div>
            </section>
          ))
        )}
      </div>

      {noteFor && <AddNoteDialog open onClose={() => setNoteFor(null)} onSaved={reload} lguId={noteFor.id} lguName={noteFor.name} />}
    </AppShell>
  );
}
