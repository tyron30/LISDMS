"use client";

import { useEffect, useRef, useState } from "react";
import { Upload, FileText, Download, Trash2, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { isSupabaseConfigured, getSupabaseClient } from "@/lib/supabase";
import { useToast } from "@/lib/toast-context";
import { logAction } from "@/lib/audit";
import { useAuth } from "@/lib/use-auth";
import { mockDocuments } from "@/lib/mock-data";
import { LguDocument } from "@/lib/types";
import { DeleteConfirmDialog } from "@/components/forms/delete-confirm-dialog";

const BUCKET = "lgu-documents";
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

function formatSize(bytes: number | null) {
  if (bytes == null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Storage object names shouldn't contain spaces or odd characters.
function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export function DocumentsTab({
  lguId,
  isAdmin,
  reloadKey,
}: {
  lguId: string;
  isAdmin: boolean;
  reloadKey: number;
}) {
  const [docs, setDocs] = useState<LguDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<LguDocument | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();
  const { email } = useAuth();

  async function load() {
    if (!isSupabaseConfigured) {
      setDocs(mockDocuments.filter((d) => d.lgu_id === lguId));
      setLoading(false);
      return;
    }
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .eq("lgu_id", lguId)
        .order("uploaded_at", { ascending: false });
      if (error) throw error;
      setDocs((data as LguDocument[]) ?? []);
    } catch {
      setDocs([]);
      showToast("Couldn't load documents. Has migration 009 been run?", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lguId, reloadKey]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file later
    if (!file) return;

    if (!isSupabaseConfigured) {
      showToast("Connect Supabase to upload real documents. This is sample data.", "error");
      return;
    }
    if (file.size > MAX_BYTES) {
      showToast(`That file is ${formatSize(file.size)} — the limit is ${formatSize(MAX_BYTES)}.`, "error");
      return;
    }

    setUploading(true);
    const path = `${lguId}/${Date.now()}-${safeName(file.name)}`;
    const supabase = getSupabaseClient();
    try {
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false });
      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase.from("documents").insert({
        lgu_id: lguId,
        file_name: file.name,
        file_path: path,
        file_size: file.size,
        uploaded_by: email,
      });
      if (insertError) {
        // Don't leave an orphaned file in storage if the record failed.
        await supabase.storage.from(BUCKET).remove([path]);
        throw insertError;
      }

      logAction("Uploaded document", file.name);
      showToast("Document uploaded.");
      load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Upload failed.", "error");
    } finally {
      setUploading(false);
    }
  }

  async function handleDownload(doc: LguDocument) {
    if (!isSupabaseConfigured) {
      showToast("Connect Supabase to download documents. This is sample data.", "error");
      return;
    }
    try {
      // Bucket is private, so links are short-lived signed URLs generated on demand.
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(doc.file_path, 60);
      if (error || !data) throw error ?? new Error("Couldn't create a download link.");
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't open the document.", "error");
    }
  }

  async function removeStorageObject(doc: LguDocument) {
    if (!isSupabaseConfigured) return;
    try {
      const supabase = getSupabaseClient();
      await supabase.storage.from(BUCKET).remove([doc.file_path]);
    } catch {
      // Row is already gone; a leftover file is harmless and non-fatal.
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">
          {loading ? "Loading…" : `${docs.length} document${docs.length === 1 ? "" : "s"}`}
        </p>
        {isAdmin && (
          <>
            <input ref={fileInput} type="file" className="hidden" onChange={handleUpload} />
            <Button size="sm" onClick={() => fileInput.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {uploading ? "Uploading..." : "Upload Document"}
            </Button>
          </>
        )}
      </div>

      {loading ? (
        <Skeleton className="h-28 w-full" />
      ) : docs.length === 0 ? (
        <EmptyState
          title="No documents yet"
          description="MOAs, endorsement letters, site surveys and other files for this LGU will show up here."
          actionLabel={isAdmin ? "Upload Document" : undefined}
          onAction={() => fileInput.current?.click()}
        />
      ) : (
        <Card>
          <CardContent className="divide-y divide-border p-0">
            {docs.map((d) => (
              <div key={d.id} className="flex items-center gap-3 px-4 py-3">
                <FileText className="h-4 w-4 shrink-0 text-muted" aria-hidden />
                <div className="min-w-0 flex-1">
                  <button
                    onClick={() => handleDownload(d)}
                    className="block max-w-full truncate text-left text-sm font-medium text-brand underline decoration-brand/30 underline-offset-2 hover:decoration-brand"
                  >
                    {d.file_name}
                  </button>
                  <p className="truncate text-xs text-muted">
                    {[
                      formatSize(d.file_size),
                      d.uploaded_by ? `by ${d.uploaded_by}` : null,
                      new Date(d.uploaded_at).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <button onClick={() => handleDownload(d)} className="text-muted hover:text-text" aria-label={`Download ${d.file_name}`}>
                    <Download className="h-4 w-4" />
                  </button>
                  {isAdmin && (
                    <button onClick={() => setDeleting(d)} className="text-muted hover:text-critical" aria-label={`Delete ${d.file_name}`}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted">Files up to {formatSize(MAX_BYTES)}. Stored privately; downloads use short-lived secure links.</p>

      {deleting && (
        <DeleteConfirmDialog
          open={!!deleting}
          onClose={() => setDeleting(null)}
          onDeleted={async () => {
            await removeStorageObject(deleting);
            load();
          }}
          table="documents"
          id={deleting.id}
          itemLabel={deleting.file_name}
          logLabel="Deleted document"
        />
      )}
    </div>
  );
}
