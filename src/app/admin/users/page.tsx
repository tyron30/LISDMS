"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { AdminGuard } from "@/components/admin/admin-guard";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { isSupabaseConfigured, getSupabaseClient } from "@/lib/supabase";
import { useAuth } from "@/lib/use-auth";
import { useToast } from "@/lib/toast-context";
import { logAction } from "@/lib/audit";
import { Profile, Role } from "@/lib/use-auth";

const MOCK_USERS: Profile[] = [
  { id: "u1", email: "admin@lisdms.gov.ph", full_name: "Tyrone Delvalle", avatar_url: null, role: "admin" },
  { id: "u2", email: "fieldstaff@lisdms.gov.ph", full_name: "Field Staff", avatar_url: null, role: "user" },
];

function UsersPageContent() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const { profile: currentProfile } = useAuth();
  const { showToast } = useToast();

  async function load() {
    if (!isSupabaseConfigured) {
      setUsers(MOCK_USERS);
      setLoading(false);
      return;
    }
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from("profiles").select("*").order("email");
    if (error) {
      showToast("Couldn't load users. Has supabase/schema.sql been run?", "error");
    }
    setUsers((data as Profile[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function changeRole(userId: string, role: Role) {
    if (!isSupabaseConfigured) {
      showToast("Connect Supabase to change real roles. This is sample data.", "error");
      return;
    }
    const supabase = getSupabaseClient();
    const { error } = await supabase.from("profiles").update({ role }).eq("id", userId);
    if (error) {
      showToast(error.message, "error");
      return;
    }
    setUsers((u) => u.map((p) => (p.id === userId ? { ...p, role } : p)));
    const target = users.find((u) => u.id === userId);
    logAction(`Changed role to ${role}`, target?.email ?? userId);
    showToast("Role updated.");
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <p className="text-sm text-muted">
          Admins can create and edit LGUs, tickets, schedules, and requirements. Viewers can only
          browse. Manage who has which role below.
        </p>
        {!isSupabaseConfigured && (
          <p className="mt-2 inline-block rounded-sm border border-warning/30 bg-warning/10 px-2 py-1 text-xs text-warning">
            Showing sample users — connect Supabase to manage real accounts.
          </p>
        )}
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-bg/60 text-left text-xs font-medium text-muted">
            <tr>
              <th className="px-4 py-2.5">User</th>
              <th className="px-4 py-2.5">Role</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {!loading && users.length === 0 && (
              <tr>
                <td colSpan={2} className="px-4 py-6 text-center text-muted">
                  No users yet.
                </td>
              </tr>
            )}
            {users.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-3">
                  <p className="font-medium text-text">{u.full_name || u.email || "Unnamed"}</p>
                  <p className="text-xs text-muted">{u.email}</p>
                </td>
                <td className="px-4 py-3">
                  <Select
                    value={u.role}
                    onChange={(e) => changeRole(u.id, e.target.value as Role)}
                    disabled={u.id === currentProfile?.id}
                    className="w-32"
                  >
                    <option value="admin">Admin</option>
                    <option value="user">User</option>
                  </Select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

export default function UsersPage() {
  return (
    <AppShell title="Users">
      <AdminGuard>
        <UsersPageContent />
      </AdminGuard>
    </AppShell>
  );
}
