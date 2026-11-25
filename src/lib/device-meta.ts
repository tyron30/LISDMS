import { Router, Wifi, Printer, HardDrive, Network } from "lucide-react";
import { DeviceType } from "./types";

// Icon + label per device type, shared by the Network page, the LGU System
// tab and the device form (previously copy-pasted into each).
export const DEVICE_TYPE_META: Record<DeviceType, { label: string; icon: typeof Router }> = {
  router: { label: "Router", icon: Router },
  switch: { label: "Switch", icon: Network },
  access_point: { label: "Access Point", icon: Wifi },
  modem: { label: "Modem", icon: Router },
  printer: { label: "Printer", icon: Printer },
  other: { label: "Other", icon: HardDrive },
};

export const DEVICE_TYPE_OPTIONS = (Object.keys(DEVICE_TYPE_META) as DeviceType[]).map((value) => ({
  value,
  label: DEVICE_TYPE_META[value].label,
}));
