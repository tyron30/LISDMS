"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/dashboard/stat-card";
import { StatCardSkeleton, Skeleton } from "@/components/ui/skeleton";
import { Building2, CircleCheck, CircleAlert, FileClock } from "lucide-react";
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { isSupabaseConfigured, getSupabaseClient } from "@/lib/supabase";
import { mockLgus, mockConcerns, mockRequirements } from "@/lib/mock-data";
import { Lgu, Concern, Requirement, LguStatus } from "@/lib/types";

// Matches the semantic colors in tailwind.config.ts. Recharts needs real
// color values (not Tailwind class names), and these aren't exposed as
// CSS custom properties like --brand is, so they're duplicated here.
const STATUS_COLOR: Record<LguStatus, string> = {
  deployed: "#16A34A",
  for_deployment: "#2563EB",
  partial_update: "#D97706",
  no_update: "#DC2626",
};
const STATUS_LABEL: Record<LguStatus, string> = {
  deployed: "Deployed",
  for_deployment: "For Deployment",
  partial_update: "Partial Update",
  no_update: "No Update",
};
const SEVERITY_COLOR: Record<Concern["severity"], string> = {
  low: "#8F99A5",
  medium: "#D97706",
  high: "#D97706",
  critical: "#DC2626",
};

const tooltipStyle = {
  backgroundColor: "rgb(var(--surface))",
  border: "1px solid rgb(var(--border))",
  borderRadius: 8,
  fontSize: 12,
};

export default function ReportsPage() {
  const [lgus, setLgus] = useState<Lgu[]>([]);
  const [concerns, setConcerns] = useState<Concern[]>([]);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingMock, setUsingMock] = useState(false);

  useEffect(() => {
    async function load() {
      if (!isSupabaseConfigured) {
        setLgus(mockLgus);
        setConcerns(mockConcerns);
        setRequirements(mockRequirements);
        setUsingMock(true);
        setLoading(false);
        return;
      }
      try {
        const supabase = getSupabaseClient();
        const [lguRes, concernRes, reqRes] = await Promise.all([
          supabase.from("lgus").select("*"),
          supabase.from("concerns").select("*"),
          supabase.from("requirements").select("*"),
        ]);
        setLgus((lguRes.data as Lgu[]) ?? []);
        setConcerns((concernRes.data as Concern[]) ?? []);
        setRequirements((reqRes.data as Requirement[]) ?? []);
      } catch {
        setLgus(mockLgus);
        setConcerns(mockConcerns);
        setRequirements(mockRequirements);
        setUsingMock(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const statusData = useMemo(() => {
    const counts: Record<LguStatus, number> = { deployed: 0, for_deployment: 0, partial_update: 0, no_update: 0 };
    lgus.forEach((l) => {
      counts[l.status] = (counts[l.status] ?? 0) + 1;
    });
    return (Object.keys(counts) as LguStatus[]).map((s) => ({
      status: s,
      label: STATUS_LABEL[s],
      count: counts[s],
      fill: STATUS_COLOR[s],
    }));
  }, [lgus]);

  const versionData = useMemo(() => {
    const counts = new Map<string, number>();
    lgus.forEach((l) => {
      const v = l.app_version?.trim() || "Unknown";
      counts.set(v, (counts.get(v) ?? 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([version, count]) => ({ version, count }))
      .sort((a, b) => b.count - a.count);
  }, [lgus]);

  const severityData = useMemo(() => {
    const open = concerns.filter((c) => c.status !== "resolved");
    const counts: Record<Concern["severity"], number> = { low: 0, medium: 0, high: 0, critical: 0 };
    open.forEach((c) => {
      counts[c.severity] = (counts[c.severity] ?? 0) + 1;
    });
    return (Object.keys(counts) as Concern["severity"][]).map((s) => ({
      severity: s,
      label: s.charAt(0).toUpperCase() + s.slice(1),
      count: counts[s],
      fill: SEVERITY_COLOR[s],
    }));
  }, [concerns]);

  const districtData = useMemo(() => {
    const map = new Map<string, { total: number; deployed: number }>();
    lgus.forEach((l) => {
      const d = l.district || "No District Set";
      const entry = map.get(d) ?? { total: 0, deployed: 0 };
      entry.total += 1;
      if (l.status === "deployed") entry.deployed += 1;
      map.set(d, entry);
    });
    return Array.from(map.entries())
      .map(([district, stats]) => ({ district, ...stats }))
      .sort((a, b) => a.district.localeCompare(b.district));
  }, [lgus]);

  const totalLgus = lgus.length;
  const deployedCount = lgus.filter((l) => l.status === "deployed").length;
  const deployedPct = totalLgus > 0 ? Math.round((deployedCount / totalLgus) * 100) : 0;
  const openConcerns = concerns.filter((c) => c.status !== "resolved").length;
  const today = new Date().toISOString().slice(0, 10);
  const overdueRequirements = requirements.filter((r) => r.status === "pending" && r.due_date && r.due_date < today).length;

  return (
    <AppShell title="Reports">
      <div className="mx-auto max-w-6xl space-y-6">
        {usingMock && (
          <p className="inline-block rounded-sm border border-warning/30 bg-warning/10 px-2 py-1 text-xs text-warning">
            Showing sample data — connect Supabase to see real reports.
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
              <StatCard label="Total LGUs" value={totalLgus} icon={Building2} />
              <StatCard label="Deployed" value={`${deployedPct}%`} icon={CircleCheck} />
              <StatCard label="Open Concerns" value={openConcerns} icon={CircleAlert} tone="critical" />
              <StatCard label="Overdue Requirements" value={overdueRequirements} icon={FileClock} tone="warning" />
            </>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card className="p-4">
            <p className="mb-4 text-sm font-semibold text-text">LGU Status Distribution</p>
            {loading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={statusData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" />
                    <XAxis dataKey="label" stroke="rgb(var(--muted))" fontSize={11} interval={0} angle={-15} textAnchor="end" height={50} />
                    <YAxis stroke="rgb(var(--muted))" fontSize={12} allowDecimals={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {statusData.map((d) => (
                        <Cell key={d.status} fill={d.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          <Card className="p-4">
            <p className="mb-4 text-sm font-semibold text-text">Open Concerns by Severity</p>
            {loading ? (
              <Skeleton className="h-64 w-full" />
            ) : openConcerns === 0 ? (
              <div className="flex h-64 items-center justify-center text-sm text-muted">No open concerns right now.</div>
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={severityData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" />
                    <XAxis dataKey="label" stroke="rgb(var(--muted))" fontSize={12} />
                    <YAxis stroke="rgb(var(--muted))" fontSize={12} allowDecimals={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {severityData.map((d) => (
                        <Cell key={d.severity} fill={d.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          <Card className="p-4">
            <p className="mb-4 text-sm font-semibold text-text">App Version Distribution</p>
            <p className="mb-3 -mt-2 text-xs text-muted">Which LGUs are running an outdated build.</p>
            {loading ? (
              <Skeleton className="h-56 w-full" />
            ) : (
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={versionData} layout="vertical" margin={{ left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" horizontal={false} />
                    <XAxis type="number" stroke="rgb(var(--muted))" fontSize={12} allowDecimals={false} />
                    <YAxis dataKey="version" type="category" stroke="rgb(var(--muted))" fontSize={12} width={110} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="count" fill="rgb(var(--brand))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          <Card className="p-4">
            <p className="mb-4 text-sm font-semibold text-text">Deployment Coverage by District</p>
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
              </div>
            ) : districtData.length === 0 ? (
              <p className="text-sm text-muted">No LGUs on record yet.</p>
            ) : (
              <div className="space-y-3">
                {districtData.map((d) => {
                  const pct = d.total > 0 ? Math.round((d.deployed / d.total) * 100) : 0;
                  return (
                    <div key={d.district}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="font-medium text-text">{d.district}</span>
                        <span className="text-muted">
                          {d.deployed}/{d.total} deployed
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-border/60">
                        <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
