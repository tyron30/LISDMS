"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/badge";
import { ChecklistBadge } from "@/components/ui/checklist-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/skeleton";
import { InlineStatusSelect } from "@/components/forms/inline-status-select";
import { isSupabaseConfigured, getSupabaseClient } from "@/lib/supabase";
import { useAuth } from "@/lib/use-auth";
import { mockLgus, mockLguNotes, mockTickets } from "@/lib/mock-data";
import { Lgu, LguNote } from "@/lib/types";
import { MOA_STATUS_OPTIONS, ORIENTATION_OPTIONS } from "@/lib/lgu-options";

const UNASSIGNED = "Unassigned";
const DISTRICT_RANK = ["Provincial Government", "1st District", "2nd District", "3rd District", "4th District", "5th District"];

// The spreadsheet's "Assignments" tab: every LGU grouped under the staff
// member responsible for it, with the MOA / orientation state and the most
// recent check-in note, so each person can see their own list at a glance.
export default function AssignmentsPage() {
  const { isAdmin } = useAuth();
  const [lgus, setLgus] = useState<Lgu[]>([]);
  const [latestNote, setLatestNote] = useState<Map<string, LguNote>>(new Map());
  const [openTickets, setOpenTickets] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [usingMock, setUsingMock] = useState(false);
  const [query, setQuery] = useState("");
  const [person, setPerson] = useState("all");

  useEffect(() => {
    function pickLatest(notes: LguNote[]) {
      const map = new Map<string, LguNote>();
      // notes arrive newest-first, so the first one seen per LGU is the latest
      notes.forEach((n) => {
        if (!map.has(n.lgu_id)) map.set(n.lgu_id, n);
      });
      return map;
    }

    async function load() {
      if (!isSupabaseConfigured) {
        setLgus(mockLgus.map((l) => ({ ...l })));
        setLatestNote(pickLatest([...mockLguNotes].sort((a, b) => b.note_date.localeCompare(a.note_date))));
        const counts = new Map<string, number>();
        mockTickets.filter((t) => t.status !== "resolved").forEach((t) => counts.set(t.lgu_id, (counts.get(t.lgu_id) ?? 0) + 1));
        setOpenTickets(counts);
        setUsingMock(true);
        setLoading(false);
        return;
      }
      try {
        const supabase = getSupabaseClient();
        const [lguRes, noteRes, ticketRes] = await Promise.all([
          supabase.from("lgus").select("*, assigned_persons(name)").order("name"),
          supabase.from("lgu_notes").select("*").order("note_date", { ascending: false }).order("created_at", { ascending: false }).limit(2000),
          supabase.from("tickets").select("lgu_id").neq("status", "resolved"),
        ]);
        if (lguRes.error) throw lguRes.error;
        setLgus(
          ((lguRes.data ?? []) as Record<string, unknown>[]).map((r) => ({
            ...r,
            assigned_person_name: (r.assigned_persons as { name?: string } | null)?.name ?? null,
          })) as Lgu[]
        );
        setLatestNote(pickLatest((noteRes.data as LguNote[]) ?? []));
        const counts = new Map<string, number>();
        ((ticketRes.data ?? []) as { lgu_id: string }[]).forEach((t) => counts.set(t.lgu_id, (counts.get(t.lgu_id) ?? 0) + 1));
        setOpenTickets(counts);
      } catch {
        setLgus(mockLgus.map((l) => ({ ...l })));
        setUsingMock(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const people = useMemo(() => {
    const names = Array.from(new Set(lgus.map((l) => l.assigned_person_name || UNASSIGNED)));
    return names.sort((a, b) => (a === UNASSIGNED ? 1 : b === UNASSIGNED ? -1 : a.localeCompare(b)));
  }, [lgus]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rank = (d?: string | null) => {
      const i = DISTRICT_RANK.indexOf(d ?? "");
      return i === -1 ? 99 : i;
    };
    return people
      .filter((p) => person === "all" || p === person)
      .map((p) => ({
        person: p,
        lgus: lgus
          .filter((l) => (l.assigned_person_name || UNASSIGNED) === p)
          .filter((l) => !q || l.name.toLowerCase().includes(q))
          .sort((a, b) => rank(a.district) - rank(b.district) || a.name.localeCompare(b.name)),
      }))
      .filter((g) => g.lgus.length > 0);
  }, [people, lgus, query, person]);

  function updateLgu(id: string, patch: Partial<Lgu>) {
    setLgus((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  function latestCell(lguId: string) {
    const n = latestNote.get(lguId);
    if (!n) return <span className="text-muted">—</span>;
    return (
      <div className="max-w-xs">
        <p className="line-clamp-2 text-sm text-text">{n.body}</p>
        <p className="text-xs text-muted">
          {new Date(n.note_date).toLocaleDateString("en-PH", { month: "short", day: "numeric" })}
        </p>
      </div>
    );
  }

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

        {loading ? (
          <TableSkeleton rows={6} cols={6} />
        ) : groups.length === 0 ? (
          <EmptyState title="No LGUs found" description="Try a different search, or assign LGUs to a person from the LGU's Edit form." />
        ) : (
          groups.map((g) => {
            const moaOk = g.lgus.filter((l) => l.moa_status === "yes").length;
            return (
              <section key={g.person} className="space-y-3">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h2 className="text-sm font-semibold text-text">{g.person}</h2>
                  <span className="text-xs text-muted">
                    {g.lgus.length} LGU{g.lgus.length === 1 ? "" : "s"} · MOA done: {moaOk}/{g.lgus.length}
                  </span>
                </div>

                {/* Desktop */}
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
                          <td className="px-4 py-3">
                            <StatusBadge status={l.status} />
                          </td>
                          <td className="px-4 py-3">
                            {isAdmin ? (
                              <InlineStatusSelect
                                table="lgus"
                                id={l.id}
                                column="moa_status"
                                value={l.moa_status ?? ""}
                                options={MOA_STATUS_OPTIONS}
                                logLabel="Updated MOA status"
                                target={l.name}
                                onUpdated={(v) => updateLgu(l.id, { moa_status: (v || null) as Lgu["moa_status"] })}
                                className="w-36"
                              />
                            ) : (
                              <ChecklistBadge value={l.moa_status} options={MOA_STATUS_OPTIONS} />
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {isAdmin ? (
                              <InlineStatusSelect
                                table="lgus"
                                id={l.id}
                                column="orientation_status"
                                value={l.orientation_status ?? ""}
                                options={ORIENTATION_OPTIONS}
                                logLabel="Updated orientation status"
                                target={l.name}
                                onUpdated={(v) => updateLgu(l.id, { orientation_status: (v || null) as Lgu["orientation_status"] })}
                                className="w-36"
                              />
                            ) : (
                              <ChecklistBadge value={l.orientation_status} options={ORIENTATION_OPTIONS} />
                            )}
                          </td>
                          <td className="px-4 py-3">{latestCell(l.id)}</td>
                          <td className="px-4 py-3 tabular-nums text-text">{openTickets.get(l.id) ?? 0}</td>
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

                {/* Mobile */}
                <div className="space-y-3 md:hidden">
                  {g.lgus.map((l) => (
                    <Link key={l.id} href={`/lgus/${l.id}`}>
                      <Card className="p-4 transition-colors active:bg-bg/60">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-medium text-brand">{l.name}</p>
                            <p className="text-xs text-muted">{l.district || "No district"}</p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <StatusBadge status={l.status} />
                            <ChevronRight className="h-4 w-4 text-muted" aria-hidden />
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <ChecklistBadge value={l.moa_status} options={MOA_STATUS_OPTIONS} />
                          <ChecklistBadge value={l.orientation_status} options={ORIENTATION_OPTIONS} />
                        </div>
                        <div className="mt-3 text-xs">{latestCell(l.id)}</div>
                      </Card>
                    </Link>
                  ))}
                </div>
              </section>
            );
          })
        )}
      </div>
    </AppShell>
  );
}
