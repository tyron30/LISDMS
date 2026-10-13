"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Plus, Pencil, Trash2, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { isSupabaseConfigured, getSupabaseClient } from "@/lib/supabase";
import { useAuth } from "@/lib/use-auth";
import { mockLgus } from "@/lib/mock-data";
import { Lgu } from "@/lib/types";
import { AddLguDialog } from "@/components/forms/add-lgu-dialog";
import { DeleteConfirmDialog } from "@/components/forms/delete-confirm-dialog";
import { TableSkeleton } from "@/components/ui/skeleton";

// LGUs without a district set land in this group, shown last.
const DISTRICT_ORDER = ["Provincial Government", "1st District", "2nd District", "3rd District", "4th District", "5th District"];
const NO_DISTRICT = "No District Set";

export default function LgusPage() {
  const router = useRouter();
  const [lgus, setLgus] = useState<Lgu[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLgu, setEditingLgu] = useState<Lgu | null>(null);
  const [deletingLgu, setDeletingLgu] = useState<Lgu | null>(null);
  const { isAdmin } = useAuth();

  async function load() {
    if (!isSupabaseConfigured) {
      setLgus(mockLgus);
      setLoading(false);
      return;
    }
    try {
      const supabase = getSupabaseClient();
      const today = new Date().toISOString().slice(0, 10);
      const [lguRes, ticketsRes, requirementsRes, scheduleRes] = await Promise.all([
        // Join assigned_persons to show a name instead of just the id.
        supabase.from("lgus").select("*, assigned_persons(name)").order("name"),
        supabase.from("tickets").select("lgu_id, status").neq("status", "resolved"),
        supabase.from("requirements").select("lgu_id, status").eq("status", "pending"),
        supabase.from("schedules").select("lgu_id, date").gte("date", today).order("date"),
      ]);

      const openTicketCounts = new Map<string, number>();
      (ticketsRes.data ?? []).forEach((c: { lgu_id: string }) => {
        openTicketCounts.set(c.lgu_id, (openTicketCounts.get(c.lgu_id) ?? 0) + 1);
      });

      const pendingReqCounts = new Map<string, number>();
      (requirementsRes.data ?? []).forEach((r: { lgu_id: string }) => {
        pendingReqCounts.set(r.lgu_id, (pendingReqCounts.get(r.lgu_id) ?? 0) + 1);
      });

      // schedules were fetched sorted by date ascending, so the first match
      // per LGU is its next upcoming visit.
      const nextVisit = new Map<string, string>();
      (scheduleRes.data ?? []).forEach((s: { lgu_id: string; date: string }) => {
        if (!nextVisit.has(s.lgu_id)) nextVisit.set(s.lgu_id, s.date);
      });

      const merged = ((lguRes.data as Record<string, unknown>[]) ?? []).map((row) => ({
        ...row,
        assigned_person_name: (row.assigned_persons as { name?: string } | null)?.name ?? null,
        open_tickets: openTicketCounts.get(row.id as string) ?? 0,
        pending_requirements: pendingReqCounts.get(row.id as string) ?? 0,
        next_visit: nextVisit.get(row.id as string) ?? null,
      })) as Lgu[];
      setLgus(merged);
    } catch {
      setLgus(mockLgus);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(
    () => lgus.filter((l) => l.name.toLowerCase().includes(query.toLowerCase())),
    [lgus, query]
  );

  const grouped = useMemo(() => {
    const map = new Map<string, Lgu[]>();
    filtered.forEach((l) => {
      const key = l.district || NO_DISTRICT;
      const list = map.get(key) ?? [];
      list.push(l);
      map.set(key, list);
    });
    const order = [...DISTRICT_ORDER, NO_DISTRICT];
    return order
      .map((district) => ({ district, lgus: map.get(district) ?? [] }))
      .filter((g) => g.lgus.length > 0);
  }, [filtered]);

  return (
    <AppShell title="LGUs">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input
              placeholder="Search LGUs..."
              className="pl-9"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          {isAdmin && (
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4" /> Add LGU
            </Button>
          )}
        </div>

        {loading ? (
          <TableSkeleton rows={6} cols={5} />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No LGUs found"
            description="Try a different search term, or add a new LGU to get started."
            actionLabel={isAdmin ? "Add LGU" : undefined}
            onAction={() => setDialogOpen(true)}
          />
        ) : (
          grouped.map((group) => (
            <div key={group.district} className="space-y-3">
              <div className="flex items-baseline gap-2">
                <h2 className="text-sm font-semibold text-text">{group.district}</h2>
                <span className="text-xs text-muted">{group.lgus.length} LGU{group.lgus.length === 1 ? "" : "s"}</span>
              </div>

              {/* Desktop table */}
              <Card className="hidden overflow-hidden md:block">
                <table className="w-full text-sm">
                  <thead className="border-b border-border bg-bg/60 text-left text-xs font-medium text-muted">
                    <tr>
                      <th className="px-4 py-2.5">LGU</th>
                      <th className="px-4 py-2.5">Status</th>
                      <th className="px-4 py-2.5">Assigned</th>
                      <th className="px-4 py-2.5">Tickets</th>
                      <th className="px-4 py-2.5">App</th>
                      <th className="px-4 py-2.5">Next Visit</th>
                      {isAdmin && <th className="px-4 py-2.5" />}
                      <th className="w-8 px-2 py-2.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {group.lgus.map((lgu) => (
                      <tr
                        key={lgu.id}
                        onClick={() => router.push(`/lgus/${lgu.id}`)}
                        className="cursor-pointer hover:bg-bg/60"
                      >
                        <td className="px-4 py-3">
                          <Link
                            href={`/lgus/${lgu.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="font-medium text-brand underline decoration-brand/30 underline-offset-2 hover:decoration-brand"
                          >
                            {lgu.name}
                          </Link>
                          <p className="text-xs text-muted">{lgu.province}</p>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={lgu.status} />
                        </td>
                        <td className="px-4 py-3 text-muted">{lgu.assigned_person_name || "—"}</td>
                        <td className="px-4 py-3 tabular-nums text-text">{lgu.open_tickets}</td>
                        <td className="px-4 py-3 font-mono text-xs text-muted">{lgu.app_version}</td>
                        <td className="px-4 py-3 text-muted">
                          {lgu.next_visit
                            ? new Date(lgu.next_visit).toLocaleDateString("en-PH", {
                                month: "short",
                                day: "numeric",
                              })
                            : "—"}
                        </td>
                        {isAdmin && (
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-3">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingLgu(lgu);
                                }}
                                className="text-muted hover:text-text"
                                aria-label={`Edit ${lgu.name}`}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeletingLgu(lgu);
                                }}
                                className="text-muted hover:text-critical"
                                aria-label={`Delete ${lgu.name}`}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        )}
                        <td className="w-8 px-2 py-3">
                          <ChevronRight className="h-4 w-4 text-muted" aria-hidden />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>

              {/* Mobile cards */}
              <div className="space-y-3 md:hidden">
                {group.lgus.map((lgu) => (
                  <Link key={lgu.id} href={`/lgus/${lgu.id}`}>
                    <Card className="p-4 transition-colors active:bg-bg/60">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div>
                            <p className="font-medium text-text">{lgu.name}</p>
                            <p className="text-xs text-muted">{lgu.province}</p>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <StatusBadge status={lgu.status} />
                          <ChevronRight className="h-4 w-4 text-muted" aria-hidden />
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <p className="text-muted">Assigned</p>
                          <p className="font-medium text-text">{lgu.assigned_person_name || "—"}</p>
                        </div>
                        <div>
                          <p className="text-muted">Tickets</p>
                          <p className="font-medium text-text">{lgu.open_tickets} open</p>
                        </div>
                        <div>
                          <p className="text-muted">Next Visit</p>
                          <p className="font-medium text-text">
                            {lgu.next_visit
                              ? new Date(lgu.next_visit).toLocaleDateString("en-PH", { month: "short", day: "numeric" })
                              : "—"}
                          </p>
                        </div>
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      <AddLguDialog open={dialogOpen} onClose={() => setDialogOpen(false)} onCreated={load} />
      <AddLguDialog
        open={!!editingLgu}
        onClose={() => setEditingLgu(null)}
        onCreated={load}
        lgu={editingLgu ?? undefined}
      />
      {deletingLgu && (
        <DeleteConfirmDialog
          open={!!deletingLgu}
          onClose={() => setDeletingLgu(null)}
          onDeleted={load}
          table="lgus"
          id={deletingLgu.id}
          itemLabel={deletingLgu.name}
          warning="This also deletes all of its tickets, schedules, requirements, documents, and network devices."
          logLabel="Deleted LGU"
        />
      )}
    </AppShell>
  );
}
