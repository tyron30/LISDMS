"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, Plus, Pencil, Trash2 } from "lucide-react";
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

export default function LgusPage() {
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
      const [lguRes, concernsRes, requirementsRes, scheduleRes] = await Promise.all([
        supabase.from("lgus").select("*").order("name"),
        supabase.from("concerns").select("lgu_id, status").neq("status", "resolved"),
        supabase.from("requirements").select("lgu_id, status").eq("status", "pending"),
        supabase.from("schedules").select("lgu_id, date").gte("date", today).order("date"),
      ]);

      const openConcernCounts = new Map<string, number>();
      (concernsRes.data ?? []).forEach((c: { lgu_id: string }) => {
        openConcernCounts.set(c.lgu_id, (openConcernCounts.get(c.lgu_id) ?? 0) + 1);
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

      const merged = ((lguRes.data as Lgu[]) ?? []).map((l) => ({
        ...l,
        open_concerns: openConcernCounts.get(l.id) ?? 0,
        pending_requirements: pendingReqCounts.get(l.id) ?? 0,
        next_visit: nextVisit.get(l.id) ?? null,
      }));
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

  return (
    <AppShell title="LGUs">
      <div className="mx-auto max-w-6xl space-y-4">
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
          <>
            {/* Desktop table */}
            <Card className="hidden overflow-hidden md:block">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-bg/60 text-left text-xs font-medium text-muted">
                  <tr>
                    <th className="px-4 py-2.5">LGU</th>
                    <th className="px-4 py-2.5">District</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5">Concerns</th>
                    <th className="px-4 py-2.5">App</th>
                    <th className="px-4 py-2.5">Next Visit</th>
                    {isAdmin && <th className="px-4 py-2.5" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((lgu) => (
                    <tr key={lgu.id} className="hover:bg-bg/60">
                      <td className="px-4 py-3">
                        <Link href={`/lgus/${lgu.id}`} className="font-medium text-text hover:text-brand">
                          {lgu.name}
                        </Link>
                        <p className="text-xs text-muted">{lgu.province}</p>
                      </td>
                      <td className="px-4 py-3 text-muted">{lgu.district || "—"}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={lgu.status} />
                      </td>
                      <td className="px-4 py-3 tabular-nums text-text">{lgu.open_concerns}</td>
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
                              onClick={() => setEditingLgu(lgu)}
                              className="text-muted hover:text-text"
                              aria-label={`Edit ${lgu.name}`}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => setDeletingLgu(lgu)}
                              className="text-muted hover:text-critical"
                              aria-label={`Delete ${lgu.name}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>

            {/* Mobile cards */}
            <div className="space-y-3 md:hidden">
              {filtered.map((lgu) => (
                <Link key={lgu.id} href={`/lgus/${lgu.id}`}>
                  <Card className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-text">{lgu.name}</p>
                        <p className="text-xs text-muted">{lgu.province}</p>
                      </div>
                      <StatusBadge status={lgu.status} />
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <p className="text-muted">Concerns</p>
                        <p className="font-medium text-text">{lgu.open_concerns} open</p>
                      </div>
                      <div>
                        <p className="text-muted">App</p>
                        <p className="font-mono font-medium text-text">{lgu.app_version}</p>
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
          </>
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
          warning="This also deletes all of its concerns, schedules, requirements, documents, and network devices."
          logLabel="Deleted LGU"
        />
      )}
    </AppShell>
  );
}
