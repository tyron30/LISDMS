"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Check, X, Loader2 } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { AdminGuard } from "@/components/admin/admin-guard";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { DeleteConfirmDialog } from "@/components/forms/delete-confirm-dialog";
import { isSupabaseConfigured, getSupabaseClient } from "@/lib/supabase";
import { useToast } from "@/lib/toast-context";
import { logAction } from "@/lib/audit";
import { mockAssignedPersons } from "@/lib/mock-data";
import { AssignedPerson } from "@/lib/types";

function AssignedPersonsContent() {
  const [people, setPeople] = useState<AssignedPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingMock, setUsingMock] = useState(false);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleting, setDeleting] = useState<AssignedPerson | null>(null);
  const { showToast } = useToast();

  async function load() {
    if (!isSupabaseConfigured) {
      setPeople(mockAssignedPersons);
      setUsingMock(true);
      setLoading(false);
      return;
    }
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.from("assigned_persons").select("*").order("name");
      if (error) throw error;
      setPeople((data as AssignedPerson[]) ?? []);
    } catch {
      setPeople(mockAssignedPersons);
      setUsingMock(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    if (!isSupabaseConfigured) {
      showToast("Connect Supabase to manage real assigned persons. This is sample data.", "error");
      return;
    }
    setAdding(true);
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.from("assigned_persons").insert({ name });
      if (error) throw error;
      logAction("Added assigned person", name);
      showToast("Added.");
      setNewName("");
      load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't add person.", "error");
    } finally {
      setAdding(false);
    }
  }

  function startEdit(p: AssignedPerson) {
    setEditingId(p.id);
    setEditingName(p.name);
  }

  async function saveEdit(id: string) {
    const name = editingName.trim();
    if (!name) return;
    setSavingEdit(true);
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.from("assigned_persons").update({ name }).eq("id", id);
      if (error) throw error;
      logAction("Renamed assigned person", name);
      showToast("Updated.");
      setEditingId(null);
      load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't update.", "error");
    } finally {
      setSavingEdit(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <p className="text-sm text-muted">
          The people LGUs can be assigned to (shown as a dropdown on the Add/Edit LGU form).
          Renaming someone here updates it everywhere they're assigned.
        </p>
        {usingMock && (
          <p className="mt-2 inline-block rounded-sm border border-warning/30 bg-warning/10 px-2 py-1 text-xs text-warning">
            Showing sample data — connect Supabase to manage the real list.
          </p>
        )}
      </div>

      <form onSubmit={handleAdd} className="flex gap-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Add a name..."
          className="flex-1"
        />
        <Button type="submit" size="sm" disabled={adding || !newName.trim()}>
          {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Add
        </Button>
      </form>

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : people.length === 0 ? (
        <EmptyState title="No one on the list yet" description="Add a name above to get started." />
      ) : (
        <Card className="divide-y divide-border p-0">
          {people.map((p) => (
            <div key={p.id} className="flex items-center justify-between px-4 py-3">
              {editingId === p.id ? (
                <div className="flex flex-1 items-center gap-2">
                  <Input
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    autoFocus
                    className="h-8"
                  />
                  <button
                    onClick={() => saveEdit(p.id)}
                    disabled={savingEdit}
                    className="text-success hover:opacity-80"
                    aria-label="Save"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="text-muted hover:text-text"
                    aria-label="Cancel"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <>
                  <span className="text-sm font-medium text-text">{p.name}</span>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => startEdit(p)}
                      className="text-muted hover:text-text"
                      aria-label={`Rename ${p.name}`}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleting(p)}
                      className="text-muted hover:text-critical"
                      aria-label={`Remove ${p.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </Card>
      )}

      {deleting && (
        <DeleteConfirmDialog
          open={!!deleting}
          onClose={() => setDeleting(null)}
          onDeleted={load}
          table="assigned_persons"
          id={deleting.id}
          itemLabel={deleting.name}
          warning="Any LGU currently assigned to them will show no assigned person instead."
          logLabel="Removed assigned person"
        />
      )}
    </div>
  );
}

export default function AssignedPersonsPage() {
  return (
    <AppShell title="Assigned Persons">
      <AdminGuard>
        <AssignedPersonsContent />
      </AdminGuard>
    </AppShell>
  );
}
