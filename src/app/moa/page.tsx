"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, FileSignature, CircleCheck, Hourglass, CircleDashed } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatCard } from "@/components/dashboard/stat-card";
import { StatCardSkeleton, TableSkeleton } from "@/components/ui/skeleton";
import { ChecklistBadge } from "@/components/ui/checklist-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { InlineStatusSelect } from "@/components/forms/inline-status-select";
import { AddNoteDialog } from "@/components/forms/add-note-dialog";
import { NoteSnippet } from "@/components/lgus/note-snippet";
import { useSupabaseData } from "@/lib/data";
import { useAuth } from "@/lib/use-auth";
import { mockLgus, mockLguNotes } from "@/lib/mock-data";
import { Lgu, LguNote } from "@/lib/types";
import { MOA_STATUS_OPTIONS, SIGNOFF_OPTIONS, groupByDistrict } from "@/lib/options";

type Column = "moa_status" | "sp_resolution" | "gov_signature";
type MoaState = "complete" | "progress" | "not_started" | "na";

// Complete = MOA, SP resolution and the Governor's signature are all "Yes".
// N/A on the MOA means it doesn't apply (e.g. the Provincial Government), so
// it's left out of the progress counts.
function moaState(l: Lgu): MoaState {
  if (l.moa_status === "na") return "na";
  if (l.moa_status === "yes" && l.sp_resolution === "yes" && l.gov_signature === "yes") return "complete";
  const started = [l.moa_status, l.sp_resolution, l.gov_signature].includes("yes") || ["for_preparation", "for_discussion", "for_schedule"].includes(l.moa_status ?? "");
  return started ? "progress" : "not_started";
}

// The spreadsheet's "MOA Status" tab: With MOA / With SP Resolution / With
// Gov's Signature per LGU, plus the latest MOA remark (anyone can add one).
export default function MoaPage() {
  const { isAdmin } = useAuth();
  const [query, setQuery] = useState("");
  const [remarkFor, setRemarkFor] = useState<Lgu | null>(null);

  const { data, setData, loading, error, usingMock, reload } = useSupabaseData(
    async (sb) => {
      const [l, n] = await Promise.all([
        sb.from("lgus").select("*").order("name"),
        sb.from("lgu_notes").select("*").eq("category", "moa").order("note_date", { ascending: false }).order("created_at", { ascending: false }).limit(1000),
      ]);
      if (l.error) throw l.error;
      if (n.error) throw n.error;
      return { lgus: (l.data ?? []) as Lgu[], notes: (n.data ?? []) as LguNote[] };
    },
    {
      mock: { lgus: mockLgus, notes: mockLguNotes.filter((n) => n.category === "moa") },
      empty: { lgus: [] as Lgu[], notes: [] as LguNote[] },
    }
  );

  const latest = useMemo(() => {
    const m = new Map<string, LguNote>();
    [...data.notes]
      .sort((a, b) => b.note_date.localeCompare(a.note_date) || b.created_at.localeCompare(a.created_at))
      .forEach((n) => m.has(n.lgu_id) || m.set(n.lgu_id, n));
    return m;
  }, [data.notes]);

  const counts = useMemo(() => {
    const c = { complete: 0, progress: 0, not_started: 0, total: 0 };
    data.lgus.forEach((l) => {
      const s = moaState(l);
      if (s !== "na") {
        c.total += 1;
        c[s] += 1;
      }
    });
    return c;
  }, [data.lgus]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return groupByDistrict(data.lgus.filter((l) => !q || l.name.toLowerCase().includes(q)));
  }, [data.lgus, query]);

  const setField = (id: string, column: Column, v: string) =>
    setData((d) => ({ ...d, lgus: d.lgus.map((l) => (l.id === id ? { ...l, [column]: v || null } : l)) }));

  function checklist(l: Lgu, column: Column) {
    const options = column === "moa_status" ? MOA_STATUS_OPTIONS : SIGNOFF_OPTIONS;
    if (!isAdmin) return <ChecklistBadge value={l[column]} options={options} />;
    const label = { moa_status: "MOA", sp_resolution: "SP resolution", gov_signature: "Governor's signature" }[column];
    return (
      <InlineStatusSelect
        table="lgus"
        id={l.id}
        column={column}
        value={l[column] ?? ""}
        options={options}
        logLabel={`Updated ${label}`}
        target={l.name}
        onUpdated={(v) => setField(l.id, column, v)}
        className="w-36"
      />
    );
  }

  const remark = (l: Lgu) => <NoteSnippet note={latest.get(l.id)} lguId={l.id} onAdd={() => setRemarkFor(l)} addLabel="Add remark" />;

  return (
    <AppShell title="MOA Tracker">
      <div className="mx-auto max-w-6xl space-y-6">
        {usingMock && (
          <p className="inline-block rounded-sm border border-warning/30 bg-warning/10 px-2 py-1 text-xs text-warning">
            Showing sample data — connect Supabase to see real MOA status.
          </p>
        )}

        {error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {loading ? (
                [0, 1, 2, 3].map((i) => <StatCardSkeleton key={i} />)
              ) : (
                <>
                  <StatCard label="Applicable LGUs" value={counts.total} icon={FileSignature} />
                  <StatCard label="Fully complete" value={counts.complete} icon={CircleCheck} />
                  <StatCard label="In progress" value={counts.progress} icon={Hourglass} tone="warning" />
                  <StatCard label="Not started" value={counts.not_started} icon={CircleDashed} tone="critical" />
                </>
              )}
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <Input placeholder="Search LGUs..." className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>

            {loading ? (
              <TableSkeleton rows={6} cols={5} />
            ) : groups.length === 0 ? (
              <EmptyState title="No LGUs found" description="Try a different search." />
            ) : (
              groups.map((g) => (
                <section key={g.district} className="space-y-3">
                  <div className="flex items-baseline gap-2">
                    <h2 className="text-sm font-semibold text-text">{g.district}</h2>
                    <span className="text-xs text-muted">{g.rows.length} LGU{g.rows.length === 1 ? "" : "s"}</span>
                  </div>

                  <Card className="hidden overflow-hidden md:block">
                    <table className="w-full text-sm">
                      <thead className="border-b border-border bg-bg/60 text-left text-xs font-medium text-muted">
                        <tr>
                          <th className="px-4 py-2.5">LGU</th>
                          <th className="px-4 py-2.5">With MOA</th>
                          <th className="px-4 py-2.5">With SP Resolution</th>
                          <th className="px-4 py-2.5">With Gov&apos;s Signature</th>
                          <th className="px-4 py-2.5">Latest remark</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {g.rows.map((l) => (
                          <tr key={l.id} className="align-top hover:bg-bg/60">
                            <td className="px-4 py-3">
                              <Link href={`/lgus/${l.id}`} className="font-medium text-brand underline decoration-brand/30 underline-offset-2 hover:decoration-brand">
                                {l.name}
                              </Link>
                            </td>
                            <td className="px-4 py-3">{checklist(l, "moa_status")}</td>
                            <td className="px-4 py-3">{checklist(l, "sp_resolution")}</td>
                            <td className="px-4 py-3">{checklist(l, "gov_signature")}</td>
                            <td className="px-4 py-3">{remark(l)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </Card>

                  <div className="space-y-3 md:hidden">
                    {g.rows.map((l) => (
                      <Card key={l.id} className="space-y-3 p-4">
                        <Link href={`/lgus/${l.id}`} className="font-medium text-brand underline decoration-brand/30 underline-offset-2">
                          {l.name}
                        </Link>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div><p className="mb-1 text-muted">MOA</p><ChecklistBadge value={l.moa_status} options={MOA_STATUS_OPTIONS} /></div>
                          <div><p className="mb-1 text-muted">SP Resolution</p><ChecklistBadge value={l.sp_resolution} options={SIGNOFF_OPTIONS} /></div>
                          <div><p className="mb-1 text-muted">Gov&apos;s Signature</p><ChecklistBadge value={l.gov_signature} options={SIGNOFF_OPTIONS} /></div>
                        </div>
                        {remark(l)}
                      </Card>
                    ))}
                  </div>
                </section>
              ))
            )}
          </>
        )}
      </div>

      {remarkFor && (
        <AddNoteDialog open onClose={() => setRemarkFor(null)} onSaved={reload} lguId={remarkFor.id} lguName={remarkFor.name} category="moa" />
      )}
    </AppShell>
  );
}
