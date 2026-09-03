"use client";

import { ShieldAlert } from "lucide-react";
import { useAuth } from "@/lib/use-auth";
import { Card } from "@/components/ui/card";

// Client-side gate for admin-only pages. This is a UX convenience, not the
// real security boundary — the actual enforcement lives in Supabase RLS
// policies (see supabase/schema.sql) that check profiles.role = 'admin'.
export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { isAdmin, loading } = useAuth();

  if (loading) return null;

  if (!isAdmin) {
    return (
      <Card className="mx-auto flex max-w-md flex-col items-center gap-2 p-8 text-center">
        <ShieldAlert className="h-6 w-6 text-warning" />
        <p className="text-sm font-medium text-text">Admins only</p>
        <p className="text-sm text-muted">
          This section is restricted to administrators. Contact an admin if you need access.
        </p>
      </Card>
    );
  }

  return <>{children}</>;
}
