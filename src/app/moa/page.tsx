"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, FileSignature, CircleCheck, Hourglass, CircleDashed } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatCard } from "@/components/dashboard/stat-card";
import { StatCardSkeleton, TableSkeleton } from "@/components/ui/skeleton";
import { ChecklistBadge } from "@/components/ui/checklist-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { InlineStatusSelect } from "@/components/forms/inline-status-select";
import { isSupabaseConfigured, getSupabaseClient } from "@/lib/supabase";
import { useAuth } from "@/lib/use-auth";
import { mockLgus, mockLguNotes } from "@/lib/mock-data";
import { Lgu, LguNote } from "@/lib/types";
import { MOA_STATUS_OPTIONS, SIGNOFF_OPTIONS } from "@/lib/lgu-options";

const DISTRICT_ORDER = ["Provincial Government", "1st District", "2nd District", "3rd District", "4th District", "5th District", "No District Set"];

type MoaState = "complete" | "progress" | "not_started" | "na";

// Complete = MOA, SP resolution and the Governor's signature are all "Yes".
// N/A on the MOA itself means it doesn't apply (e.g. the Provincial
// Government), so it's left out of the progress counts.
function moaState(l: Lgu): MoaState {
  if (l.moa_status === "na") return "na";
  if (l.moa_status === "yes" && l.sp_resolution === "yes" && l.gov_signature === "yes") return "complete";
  const anyYes = [l.moa_status, l.sp_resolution, l.gov_signature].some((v) => v === "yes");
  return anyYes || l.moa_status === "for_preparation" || l.moa_status === "for_discussion" || l.moa_status === "for_schedule"
    ? "progress"
    : "not_started";
}

// The spreadsheet's "MOA Status" tab: With MOA / With SP Resolution / With
// Gov's Signature per LGU, plus the latest MOA remark.
export default function MoaPage() {
  const { isAdmin } = useAuth();
  const [lgus, setLgus] = useState<Lgu[]>([]);
  const [latestRemark, setLatestRemark] = useState<Map<string, LguNote>>(new Map());
  const [loading, setLoading] = useState(true);
  const [usingMock, setUsingMock] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    function pick(notes: LguNote[]) {
      const m = new Map<string, LguNote>();
      notes.forEach((n) => {
        if (n.category === "moa" && !m.has(n.lgu_id)) m.set(n.lgu_id, n);
      });
      return m;
    }
    async function load() {
      if (!isSupabaseConfigured) {
        setLgus(mockLgus.map((l) => ({ ...l })));
        setLatestRemark(pick([...mockLguNotes].sort((a, b) => b.note_date.localeCompare(a.note_date))));
        setUsingMock(true);
        setLoading(false);
        return;
      }
      try {
        const supabase = getSupabaseClient();
        const [lguRes, noteRes] = await Promise.all([
          supabase.from("lgus").select("*").order("name"),
          supabase.from("lgu_notes").select("*").eq("category", "moa").order("note_date", { ascending: false }).order("created_at", { ascending: false }).limit(1000),
        ]);
        if (lguRes.error) throw lguRes.error;
        setLgus((lguRes.data as Lgu[]) ?? []);
        setLatestRemark(pick((noteRes.data as LguNote[]) ?? []));
      } catch {
        setLgus(mockLgus.map((l) => ({ ...l })));
        setUsingMock(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function updateLgu(id: string, patch: Partial<Lgu>) {
    setLgus((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  const counts = useMemo(() => {
    const c = { complete: 0, progress: 0, not_started: 0, total: 0 };
    lgus.forEach((l) => {
      const s = moaState(l);
      if (s === "na") return;
      c.total += 1;
      c[s] += 1;
    });
    return c;
  }, [lgus]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const map = new Map<string, Lgu[]>();
    lgus
      .filter((l) => !q || l.name.toLowerCase().includes(q))
      .forEach((l) => {
        const key = l.district || "No District Set";
        map.set(key, [...(map.get(key) ?? []), l]);
      });
    return DISTRICT_ORDER.map((d) => ({ district: d, lgus: (map.get(d) ?? []).sort((a, b) => a.name.localeCompare(b.name)) })).filter((g) => g.lgus.length > 0);
  }, [lgus, query]);

  function checklistCell(l: Lgu, column: "moa_status" | "sp_resolution" | "gov_signature") {
    const options = column === "moa_status" ? MOA_STATUS_OPTIONS : SIGNOFF_OPTIONS;
    const value = (l[column] ?? "") as string;
    if (!isAdmin) return <ChecklistBadge value={value} options={options} />;
    return (
      <InlineStatusSelect
        table="lgus"
        id={l.id}
        column={column}
        value={value}
        options={options}
        logLabel={`Updated ${column === "moa_status" ? "MOA" : column === "sp_resolution" ? "SP resolution" : "Governor's signature"}`}
        target={l.name}
        onUpdated={(v) => updateLgu(l.id, { [column]: v || null } as Partial<Lgu>)}
        className="w-36"
      />
    );
  }

  return (
    <AppShell title="MOA Tracker">
      <div className="mx-auto max-w-6xl space-y-6">
        {usingMock && (
          <p className="inline-block rounded-sm border border-warning/30 bg-warning/10 px-2 py-1 text-xs text-warning">
            Showing sample data — connect Supabase to see real MOA status.
          </p>
        )}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {loading ? (
            <>
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
            </>
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
                <span className="text-xs text-muted">{g.lgus.length} LGU{g.lgus.length === 1 ? "" : "s"}</span>
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
                    {g.lgus.map((l) => {
                      const remark = latestRemark.get(l.id);
                      return (
                        <tr key={l.id} className="align-top hover:bg-bg/60">
                          <td className="px-4 py-3">
                            <Link href={`/lgus/${l.id}`} className="font-medium text-brand underline decoration-brand/30 underline-offset-2 hover:decoration-brand">
                              {l.name}
                            </Link>
                          </td>
                          <td className="px-4 py-3">{checklistCell(l, "moa_status")}</td>
                          <td className="px-4 py-3">{checklistCell(l, "sp_resolution")}</td>
                          <td className="px-4 py-3">{checklistCell(l, "gov_signature")}</td>
                          <td className="px-4 py-3">
                            {remark ? (
                              <div className="max-w-xs">
                                <p className="line-clamp-2 text-sm text-text">{remark.body}</p>
                                <p className="text-xs text-muted">
                                  {new Date(remark.note_date).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
                                </p>
                              </div>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Card>

              <div className="space-y-3 md:hidden">
                {g.lgus.map((l) => (
                  <Link key={l.id} href={`/lgus/${l.id}`}>
                    <Card className="p-4 transition-colors active:bg-bg/60">
                      <p className="font-medium text-brand">{l.name}</p>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <p className="mb-1 text-muted">MOA</p>
                          <ChecklistBadge value={l.moa_status} options={MOA_STATUS_OPTIONS} />
                        </div>
                        <div>
                          <p className="mb-1 text-muted">SP Resolution</p>
                          <ChecklistBadge value={l.sp_resolution} options={SIGNOFF_OPTIONS} />
                        </div>
                        <div>
                          <p className="mb-1 text-muted">Gov&apos;s Signature</p>
                          <ChecklistBadge value={l.gov_signature} options={SIGNOFF_OPTIONS} />
                        </div>
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </AppShell>
  );
}
