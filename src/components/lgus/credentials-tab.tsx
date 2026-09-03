"use client";

import { useState } from "react";
import { Eye, EyeOff, Copy } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { logAction } from "@/lib/audit";
import { useToast } from "@/lib/toast-context";

export function CredentialsTab({
  lguName,
  anydeskId,
  anydeskPassword,
}: {
  lguName: string;
  anydeskId: string | null;
  anydeskPassword: string | null;
}) {
  const [revealed, setRevealed] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { showToast } = useToast();

  function handleConfirmReveal() {
    setConfirmOpen(false);
    setRevealed(true);
    logAction("Revealed AnyDesk credential", lguName);
  }

  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      showToast(`${label} copied to clipboard.`);
    } catch {
      showToast("Couldn't copy to clipboard.", "error");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Remote Access Credentials</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <p className="text-xs text-muted">AnyDesk ID</p>
          <div className="mt-1 flex items-center gap-2">
            <p className="font-mono text-sm text-text">{anydeskId || "Not set"}</p>
            {anydeskId && (
              <button
                onClick={() => copy(anydeskId, "AnyDesk ID")}
                className="text-muted hover:text-text"
                aria-label="Copy AnyDesk ID"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        <div>
          <p className="text-xs text-muted">AnyDesk Password</p>
          <div className="mt-1 flex items-center gap-2">
            <p className="font-mono text-sm text-text">
              {anydeskPassword ? (revealed ? anydeskPassword : "••••••••") : "Not set"}
            </p>
            {anydeskPassword && !revealed && (
              <Button size="sm" variant="secondary" onClick={() => setConfirmOpen(true)}>
                <Eye className="h-3.5 w-3.5" /> Reveal
              </Button>
            )}
            {anydeskPassword && revealed && (
              <>
                <button
                  onClick={() => copy(anydeskPassword, "Password")}
                  className="text-muted hover:text-text"
                  aria-label="Copy password"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setRevealed(false)}
                  className="text-muted hover:text-text"
                  aria-label="Hide password"
                >
                  <EyeOff className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </div>
        </div>

        {anydeskPassword && (
          <p className="text-xs text-muted">Viewing this password is recorded in the audit log.</p>
        )}
      </CardContent>

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Reveal AnyDesk password?">
        <p className="text-sm text-muted">
          This action cannot be undone silently — viewing this credential will be recorded in the
          audit log.
        </p>
        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button size="sm" variant="secondary" onClick={() => setConfirmOpen(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleConfirmReveal}>
            Reveal
          </Button>
        </div>
      </Dialog>
    </Card>
  );
}
