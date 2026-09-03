"use client";

import { useRef, useState } from "react";
import { Upload, Loader2 } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { AdminGuard } from "@/components/admin/admin-guard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { isSupabaseConfigured, getSupabaseClient } from "@/lib/supabase";
import { useSettings } from "@/lib/settings-context";
import { useToast } from "@/lib/toast-context";
import { logAction } from "@/lib/audit";

function SettingsContent() {
  const { settings, refresh } = useSettings();
  const { showToast } = useToast();
  const fileInput = useRef<HTMLInputElement>(null);

  const [orgName, setOrgName] = useState(settings.org_name);
  const [logoPreview, setLogoPreview] = useState<string | null>(settings.logo_url);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  function onPickLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  }

  async function handleSave() {
    if (!isSupabaseConfigured) {
      showToast("Connect Supabase to save branding settings.", "error");
      return;
    }
    setSaving(true);
    try {
      const supabase = getSupabaseClient();
      let logoUrl = settings.logo_url;

      if (logoFile) {
        const ext = logoFile.name.split(".").pop();
        const path = `logo-${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("branding")
          .upload(path, logoFile, { upsert: true });
        if (uploadError) throw uploadError;
        const { data: publicUrl } = supabase.storage.from("branding").getPublicUrl(path);
        logoUrl = publicUrl.publicUrl;
      }

      const { error } = await supabase
        .from("app_settings")
        .update({ org_name: orgName, logo_url: logoUrl, updated_at: new Date().toISOString() })
        .eq("id", 1);
      if (error) throw error;

      refresh();
      logAction("Updated branding settings", orgName);
      showToast("Branding updated.");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't save settings.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {!isSupabaseConfigured && (
        <p className="inline-block rounded-sm border border-warning/30 bg-warning/10 px-2 py-1 text-xs text-warning">
          Connect Supabase to persist branding changes, including uploading a logo.
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Branding</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text">Organization name</label>
            <p className="text-xs text-muted">Shown in the sidebar and browser tab.</p>
            <Input value={orgName} onChange={(e) => setOrgName(e.target.value)} className="max-w-sm" />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text">Logo</label>
            <p className="text-xs text-muted">Square image works best. Shown in the sidebar.</p>
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-md border border-border bg-bg">
                {logoPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoPreview} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-lg font-bold text-muted">{orgName.charAt(0)}</span>
                )}
              </div>
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                onChange={onPickLogo}
                className="hidden"
              />
              <Button size="sm" variant="secondary" onClick={() => fileInput.current?.click()}>
                <Upload className="h-3.5 w-3.5" /> Upload logo
              </Button>
            </div>
          </div>

          <div className="flex justify-end border-t border-border pt-4">
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? "Saving..." : "Save changes"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <AppShell title="Settings">
      <AdminGuard>
        <SettingsContent />
      </AdminGuard>
    </AppShell>
  );
}
