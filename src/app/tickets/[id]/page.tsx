"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Pencil, Trash2, Send, Loader2, Building2, User, Calendar } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { isSupabaseConfigured, getSupabaseClient } from "@/lib/supabase";
import { useAuth } from "@/lib/use-auth";
import { logAction } from "@/lib/audit";
import { useToast } from "@/lib/toast-context";
import { mockTickets, mockTicketComments, mockLgus } from "@/lib/mock-data";
import { Ticket, TicketComment } from "@/lib/types";
import { TicketDialog } from "@/components/forms/ticket-dialog";
import { InlineStatusSelect } from "@/components/forms/inline-status-select";
import { DeleteConfirmDialog } from "@/components/forms/delete-confirm-dialog";

const PRIORITY_CHIP: Record<Ticket["priority"], string> = {
  low: "bg-border/60 text-muted",
  medium: "bg-warning/10 text-warning",
  high: "bg-warning/10 text-warning",
  critical: "bg-critical/10 text-critical",
};

const STATUS_OPTIONS: { value: Ticket["status"]; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "resolved", label: "Resolved" },
];

export default function TicketDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { isAdmin, email } = useAuth();
  const { showToast } = useToast();

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [comments, setComments] = useState<TicketComment[]>([]);
  const [lguOptions, setLguOptions] = useState<{ id: string; name: string }[]>([]);
  const [newComment, setNewComment] = useState("");
  const [postingComment, setPostingComment] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  async function load() {
    if (!isSupabaseConfigured) {
      const mock = mockTickets.find((t) => t.id === params.id) ?? mockTickets[0];
      setTicket(mock);
      setComments(mockTicketComments.filter((c) => c.ticket_id === mock.id));
      setLguOptions(mockLgus.map((l) => ({ id: l.id, name: l.name })));
      return;
    }
    try {
      const supabase = getSupabaseClient();
      const [ticketRes, commentsRes, lgusRes] = await Promise.all([
        supabase.from("tickets").select("*, lgus(name), assigned_persons(name)").eq("id", params.id).maybeSingle(),
        supabase.from("ticket_comments").select("*").eq("ticket_id", params.id).order("created_at", { ascending: true }),
        supabase.from("lgus").select("id, name").order("name"),
      ]);
      const row = ticketRes.data as (Record<string, unknown> & {
        lgus?: { name?: string } | null;
        assigned_persons?: { name?: string } | null;
      }) | null;
      setTicket(
        row
          ? ({
              ...row,
              lgu_name: row.lgus?.name ?? "Unknown LGU",
              assigned_person_name: row.assigned_persons?.name ?? null,
            } as Ticket)
          : null
      );
      setComments((commentsRes.data as TicketComment[]) ?? []);
      setLguOptions((lgusRes.data as { id: string; name: string }[]) ?? []);
    } catch {
      const mock = mockTickets.find((t) => t.id === params.id) ?? mockTickets[0];
      setTicket(mock);
      setComments(mockTicketComments.filter((c) => c.ticket_id === mock.id));
      setLguOptions(mockLgus.map((l) => ({ id: l.id, name: l.name })));
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function handlePostComment() {
    if (!ticket || !newComment.trim()) return;
    if (!isSupabaseConfigured) {
      showToast("Connect Supabase to save real comments. This is sample data.", "error");
      return;
    }
    setPostingComment(true);
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.from("ticket_comments").insert({
        ticket_id: ticket.id,
        author_email: email,
        body: newComment.trim(),
      });
      if (error) throw error;
      setNewComment("");
      logAction("Added ticket comment", `#${ticket.ticket_number}`);
      load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't post comment.", "error");
    } finally {
      setPostingComment(false);
    }
  }

  if (!ticket) {
    return (
      <AppShell title="Ticket">
        <div className="mx-auto max-w-3xl space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-40 w-full" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title={`Ticket #${ticket.ticket_number}`}>
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-mono text-xs text-muted">#{ticket.ticket_number}</p>
            <h1 className="mt-1 text-xl font-semibold text-text">{ticket.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className={`rounded-sm px-2 py-0.5 text-xs font-medium capitalize ${PRIORITY_CHIP[ticket.priority]}`}>
                {ticket.priority} priority
              </span>
              <Badge>{ticket.category}</Badge>
              {isAdmin ? (
                <InlineStatusSelect
                  table="tickets"
                  id={ticket.id}
                  value={ticket.status}
                  options={STATUS_OPTIONS}
                  logLabel="Updated ticket status"
                  target={`#${ticket.ticket_number} ${ticket.title}`}
                  onUpdated={(newStatus) => setTicket((prev) => (prev ? { ...prev, status: newStatus } : prev))}
                  className="w-32"
                />
              ) : (
                <Badge className="capitalize">{ticket.status.replace("_", " ")}</Badge>
              )}
            </div>
          </div>
          {isAdmin && (
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => setEditOpen(true)}>
                <Pencil className="h-3.5 w-3.5" /> Edit
              </Button>
              <Button size="sm" variant="destructive" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </Button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="flex items-center gap-2 text-xs text-muted">
            <Building2 className="h-3.5 w-3.5 shrink-0" />
            <Link href={`/lgus/${ticket.lgu_id}`} className="truncate text-brand underline decoration-brand/30 underline-offset-2 hover:decoration-brand">
              {ticket.lgu_name}
            </Link>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted">
            <User className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate text-text">{ticket.assigned_person_name || "Unassigned"}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted">
            <Calendar className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate text-text">
              {new Date(ticket.created_at).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
            </span>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm text-text">
              {ticket.description || <span className="text-muted">No description provided.</span>}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Troubleshooting Log</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {comments.length === 0 && <p className="text-sm text-muted">No updates logged yet.</p>}
            <div className="space-y-3">
              {comments.map((c) => (
                <div key={c.id} className="rounded-md border border-border p-3">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs font-medium text-text">{c.author_email ?? "Unknown"}</span>
                    <span className="text-xs text-muted">
                      {new Date(c.created_at).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-text">{c.body}</p>
                </div>
              ))}
            </div>

            <div className="space-y-2 border-t border-border pt-4">
              <Textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                rows={3}
                placeholder="Log what you tried, found, or resolved..."
              />
              <div className="flex justify-end">
                <Button size="sm" onClick={handlePostComment} disabled={postingComment || !newComment.trim()}>
                  {postingComment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  {postingComment ? "Posting..." : "Add Update"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <TicketDialog open={editOpen} onClose={() => setEditOpen(false)} onCreated={load} lguOptions={lguOptions} ticket={ticket} />
      <DeleteConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onDeleted={() => router.push("/tickets")}
        table="tickets"
        id={ticket.id}
        itemLabel={`#${ticket.ticket_number} ${ticket.title}`}
        logLabel="Deleted ticket"
      />
    </AppShell>
  );
}
