"use client";

import { useState } from "react";
import { Sidebar } from "./sidebar";
import { TopNav } from "./topnav";
import { useSessionGuard } from "./session-guard";

export function AppShell({ title, children }: { title: string; children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const ready = useSessionGuard();

  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      <Sidebar mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopNav title={title} onOpenMobile={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{ready ? children : null}</main>
      </div>
    </div>
  );
}
