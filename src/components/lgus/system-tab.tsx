"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2, Router, Wifi, Printer, HardDrive, Network as NetworkIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { DeviceStatusBadge } from "@/components/network/device-status-badge";
import { isSupabaseConfigured, getSupabaseClient } from "@/lib/supabase";
import { mockNetworkDevices } from "@/lib/mock-data";
import { Lgu, NetworkDevice, DeviceType } from "@/lib/types";
import { AddNetworkDeviceDialog } from "@/components/forms/add-network-device-dialog";
import { DeleteConfirmDialog } from "@/components/forms/delete-confirm-dialog";

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

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <div className="mt-1 text-sm font-medium text-text">{children}</div>
    </div>
  );
}

// Technical profile of the LGU's deployment, plus the network equipment
// installed at this site (the global list lives at /network).
export function SystemTab({ lgu, isAdmin, reloadKey }: { lgu: Lgu; isAdmin: boolean; reloadKey: number }) {
  const [devices, setDevices] = useState<NetworkDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<NetworkDevice | null>(null);
  const [deleting, setDeleting] = useState<NetworkDevice | null>(null);

  async function load() {
    if (!isSupabaseConfigured) {
      setDevices(mockNetworkDevices.filter((d) => d.lgu_id === lgu.id));
      setLoading(false);
      return;
    }
    try {
      const supabase = getSupabaseClient();
      const { data } = await supabase.from("network_devices").select("*").eq("lgu_id", lgu.id).order("device_name");
      setDevices(((data ?? []) as Record<string, unknown>[]).map((r) => ({ ...r, lgu_name: lgu.name })) as NetworkDevice[]);
    } catch {
      setDevices(mockNetworkDevices.filter((d) => d.lgu_id === lgu.id));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lgu.id, reloadKey]);

  const lguOptions = [{ id: lgu.id, name: lgu.name }];
  const offline = devices.filter((d) => d.status === "offline").length;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>System &amp; Deployment</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-3">
            <Detail label="System">{lgu.system || "—"}</Detail>
            <Detail label="App Version">
              <span className="font-mono">{lgu.app_version || "—"}</span>
            </Detail>
            <Detail label="Network Setup">{lgu.network_setup || "—"}</Detail>
            <Detail label="Deployment Status">
              <StatusBadge status={lgu.status} />
            </Detail>
            <Detail label="Date Deployed">
              {lgu.date_deployed
                ? new Date(lgu.date_deployed).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" })
                : "—"}
            </Detail>
            <Detail label="District">{lgu.district || "—"}</Detail>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <div className="flex items-baseline gap-3">
            <CardTitle>Network Devices</CardTitle>
            {!loading && (
              <span className="text-xs text-muted">
                {devices.length} device{devices.length === 1 ? "" : "s"}
                {offline > 0 && <span className="ml-1.5 font-medium text-critical">· {offline} offline</span>}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Link href="/network" className="text-xs font-medium text-brand hover:underline">
              All devices
            </Link>
            {isAdmin && (
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" /> Add Device
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4">
              <Skeleton className="h-20 w-full" />
            </div>
          ) : devices.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title="No devices recorded"
                description={`Routers, switches, access points and printers installed at ${lgu.name} will be listed here.`}
                actionLabel={isAdmin ? "Add Device" : undefined}
                onAction={() => setCreateOpen(true)}
              />
            </div>
          ) : (
            <div className="divide-y divide-border">
              {devices.map((d) => {
                const Icon = TYPE_ICON[d.device_type];
                return (
                  <div key={d.id} className="flex items-center gap-3 px-4 py-3">
                    <Icon className="h-4 w-4 shrink-0 text-muted" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-text">{d.device_name}</p>
                      <p className="truncate text-xs text-muted">
                        {TYPE_LABEL[d.device_type]}
                        {d.ip_address ? ` · ${d.ip_address}` : ""}
                        {d.notes ? ` · ${d.notes}` : ""}
                      </p>
                    </div>
                    <DeviceStatusBadge status={d.status} />
                    {isAdmin && (
                      <div className="flex shrink-0 items-center gap-2 border-l border-border pl-3">
                        <button onClick={() => setEditing(d)} className="text-muted hover:text-text" aria-label={`Edit ${d.device_name}`}>
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => setDeleting(d)} className="text-muted hover:text-critical" aria-label={`Delete ${d.device_name}`}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <AddNetworkDeviceDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={load}
        lguOptions={lguOptions}
        fixedLguId={lgu.id}
      />
      <AddNetworkDeviceDialog
        open={!!editing}
        onClose={() => setEditing(null)}
        onCreated={load}
        lguOptions={lguOptions}
        fixedLguId={lgu.id}
        device={editing ?? undefined}
      />
      {deleting && (
        <DeleteConfirmDialog
          open={!!deleting}
          onClose={() => setDeleting(null)}
          onDeleted={load}
          table="network_devices"
          id={deleting.id}
          itemLabel={deleting.device_name}
          logLabel="Deleted network device"
        />
      )}
    </div>
  );
}
