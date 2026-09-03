"use client";

import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/dashboard/stat-card";
import { CalendarCheck, CircleCheck, FileClock, Building2 } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const monthly = [
  { month: "May", visits: 12 },
  { month: "Jun", visits: 15 },
  { month: "Jul", visits: 10 },
  { month: "Aug", visits: 18 },
];

export default function ReportsPage() {
  return (
    <AppShell title="Reports">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label="Total Visits" value={18} icon={CalendarCheck} />
          <StatCard label="Concerns Resolved" value={32} icon={CircleCheck} />
          <StatCard label="Pending Requirements" value={7} icon={FileClock} tone="warning" />
          <StatCard label="LGUs Covered" value={41} icon={Building2} />
        </div>

        <Card className="p-4">
          <p className="mb-4 text-sm font-semibold text-text">Visits per Month</p>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" />
                <XAxis dataKey="month" stroke="rgb(var(--muted))" fontSize={12} />
                <YAxis stroke="rgb(var(--muted))" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgb(var(--surface))",
                    border: "1px solid rgb(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="visits" fill="rgb(var(--brand))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
