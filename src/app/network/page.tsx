"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Search, Router, Wifi, Printer, HardDrive, Network as NetworkIcon, Pencil, Trash2 } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { DeviceStatusBadge } from "@/components/network/device-status-badge";
import { isSupabaseConfigured, getSupabaseClient } from "@/lib/supabase";
import { useAuth } from "@/lib/use-auth";
import { mockNetworkDevices, mockLgus } from "@/lib/mock-data";
import { NetworkDevice, DeviceStatus, DeviceType } from "@/lib/types";
import { AddNetworkDeviceDialog } from "@/components/forms/add-network-device-dialog";
import { InlineStatusSelect } from "@/components/forms/inline-status-select";
import { DeleteConfirmDialog } from "@/components/forms/delete-confirm-dialog";
import { TableSkeleton } from "@/components/ui/skeleton";

const DEVICE_STATUS_OPTIONS: { value: DeviceStatus; label: string }[] = [
  { value: "online", label: "Online" },
  { value: "offline", label: "Offline" },
  { value: "maintenance", label: "Maintenance" },
];

const TYPE_ICON: Record<DeviceType, typeof Router> = {
  router: Router,
  switch: NetworkIcon,
  access_point: Wifi,
  modem: Router,
  printer: Printer,
  other: HardDrive,
};

const TYPE_LABEL: Record<DeviceType, string> = {
  router: "Router",
  switch: "Switch",
  access_point: "Access Point",
  modem: "Modem",
  printer: "Printer",
  other: "Other",
};

export default function NetworkPage() {
  const [devices, setDevices] = useState<NetworkDevice[]>([]);
  const [lguOptions, setLguOptions] = useState<{ id: string; name: string }[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<DeviceStatus | "all">("all");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<NetworkDevice | null>(null);
  const [deletingDevice, setDeletingDevice] = useState<NetworkDevice | null>(null);
  const [usingMock, setUsingMock] = useState(false);
  const { isAdmin } = useAuth();

  async function load() {
    if (!isSupabaseConfigured) {
      setDevices(mockNetworkDevices);
      setLguOptions(mockLgus.map((l) => ({ id: l.id, name: l.name })));
      setUsingMock(true);
      setLoading(false);
      return;
    }
    try {
      const supabase = getSupabaseClient();
      const [deviceRes, lgusRes] = await Promise.all([
        // network_devices only stores lgu_id — join lgus to get a display name.
        supabase.from("network_devices").select("*, lgus(name)").order("device_name"),
        supabase.from("lgus").select("id, name").order("name"),
      ]);
      if (deviceRes.error) throw deviceRes.error;
      const mapped = (deviceRes.data ?? []).map((row: Record<string, unknown>) => ({
        ...row,
        lgu_name: (row.lgus as { name?: string } | null)?.name ?? "Unknown LGU",
      })) as NetworkDevice[];
      setDevices(mapped);
      setLguOptions((lgusRes.data as { id: string; name: string }[]) ?? []);
    } catch {
      setDevices(mockNetworkDevices);
      setLguOptions(mockLgus.map((l) => ({ id: l.id, name: l.name })));
      setUsingMock(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    return devices.filter((d) => {
      const matchesQuery =
        d.device_name.toLowerCase().includes(query.toLowerCase()) ||
        d.lgu_name.toLowerCase().includes(query.toLowerCase()) ||
        (d.ip_address ?? "").includes(query);
      const matchesStatus = statusFilter === "all" || d.status === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [devices, query, statusFilter]);

  const onlineCount = devices.filter((d) => d.status === "online").length;
  const offlineCount = devices.filter((d) => d.status === "offline").length;

  return (
    <AppShell title="Network">
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="flex flex-wrap items-center gap-4 text-sm text-muted">
          <span>{loading ? "Loading…" : `${devices.length} device(s) total`}</span>
          {!loading && <span className="text-success">{onlineCount} online</span>}
          {!loading && <span className="text-critical">{offlineCount} offline</span>}
          {usingMock && (
            <span className="rounded-sm border border-warning/30 bg-warning/10 px-2 py-1 text-xs text-warning">
              Showing sample data
            </span>
          )}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-col gap-2 sm:flex-row">
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <Input
                placeholder="Search devices, LGU, IP..."
                className="pl-9"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as DeviceStatus | "all")}
              className="sm:w-40"
            >
              <option value="all">All statuses</option>
              <option value="online">Online</option>
              <option value="offline">Offline</option>
              <option value="maintenance">Maintenance</option>
            </Select>
          </div>
          {isAdmin && (
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4" /> Add Device
            </Button>
          )}
        </div>

        {loading ? (
          <TableSkeleton rows={5} cols={6} />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No devices found"
            description="Try a different search or filter, or add a device to get started."
            actionLabel={isAdmin ? "Add Device" : undefined}
            onAction={() => setDialogOpen(true)}
          />
        ) : (
          <>
            {/* Desktop table */}
            <Card className="hidden overflow-hidden md:block">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-bg/60 text-left text-xs font-medium text-muted">
                  <tr>
                    <th className="px-4 py-2.5">Device</th>
                    <th className="px-4 py-2.5">LGU</th>
                    <th className="px-4 py-2.5">Type</th>
                    <th className="px-4 py-2.5">IP Address</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5">Last Seen</th>
                    {isAdmin && <th className="px-4 py-2.5" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((d) => {
                    const Icon = TYPE_ICON[d.device_type];
                    return (
                      <tr key={d.id} className="hover:bg-bg/60">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4 shrink-0 text-muted" />
                            <span className="font-medium text-text">{d.device_name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Link href={`/lgus/${d.lgu_id}`} className="text-brand underline decoration-brand/30 underline-offset-2 hover:decoration-brand">
                            {d.lgu_name}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-muted">{TYPE_LABEL[d.device_type]}</td>
                        <td className="px-4 py-3 font-mono text-xs text-muted">{d.ip_address ?? "—"}</td>
                        <td className="px-4 py-3">
                          {isAdmin ? (
                            <InlineStatusSelect
                              table="network_devices"
                              id={d.id}
                              value={d.status}
                              options={DEVICE_STATUS_OPTIONS}
                              logLabel="Updated device status"
                              target={d.device_name}
                              onUpdated={(newStatus) =>
                                setDevices((prev) => prev.map((x) => (x.id === d.id ? { ...x, status: newStatus } : x)))
                              }
                              className="w-32"
                            />
                          ) : (
                            <DeviceStatusBadge status={d.status} />
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted">
                          {d.last_seen
                            ? new Date(d.last_seen).toLocaleDateString("en-PH", { month: "short", day: "numeric" })
                            : "—"}
                        </td>
                        {isAdmin && (
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-3">
                              <button
                                onClick={() => setEditingDevice(d)}
                                className="text-muted hover:text-text"
                                aria-label={`Edit ${d.device_name}`}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => setDeletingDevice(d)}
                                className="text-muted hover:text-critical"
                                aria-label={`Delete ${d.device_name}`}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>

            {/* Mobile cards */}
            <div className="space-y-3 md:hidden">
              {filtered.map((d) => {
                const Icon = TYPE_ICON[d.device_type];
                return (
                  <Card key={d.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 shrink-0 text-muted" />
                        <div>
                          <p className="font-medium text-text">{d.device_name}</p>
                          <p className="text-xs text-muted">{d.lgu_name}</p>
                        </div>
                      </div>
                      <DeviceStatusBadge status={d.status} />
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <p className="text-muted">Type</p>
                        <p className="font-medium text-text">{TYPE_LABEL[d.device_type]}</p>
                      </div>
                      <div>
                        <p className="text-muted">IP Address</p>
                        <p className="font-mono font-medium text-text">{d.ip_address ?? "—"}</p>
                      </div>
                    </div>
                    {isAdmin && (
                      <div className="mt-3 flex justify-end gap-3 border-t border-border pt-3">
                        <button
                          onClick={() => setEditingDevice(d)}
                          className="flex items-center gap-1 text-xs text-muted hover:text-text"
                        >
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </button>
                        <button
                          onClick={() => setDeletingDevice(d)}
                          className="flex items-center gap-1 text-xs text-muted hover:text-critical"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Delete
                        </button>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </div>

      <AddNetworkDeviceDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={load}
        lguOptions={lguOptions}
      />
      <AddNetworkDeviceDialog
        open={!!editingDevice}
        onClose={() => setEditingDevice(null)}
        onCreated={load}
        lguOptions={lguOptions}
        device={editingDevice ?? undefined}
      />
      {deletingDevice && (
        <DeleteConfirmDialog
          open={!!deletingDevice}
          onClose={() => setDeletingDevice(null)}
          onDeleted={load}
          table="network_devices"
          id={deletingDevice.id}
          itemLabel={deletingDevice.device_name}
          logLabel="Deleted network device"
        />
      )}
    </AppShell>
  );
}
