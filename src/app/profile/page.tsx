"use client";

import { useRef, useState } from "react";
import { Upload, Loader2, KeyRound } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/use-auth";
import { isSupabaseConfigured, getSupabaseClient } from "@/lib/supabase";
import { useToast } from "@/lib/toast-context";
import { logAction } from "@/lib/audit";

function ProfileContent() {
  const { profile, email, isAdmin, refresh } = useAuth();
  const { showToast } = useToast();
  const fileInput = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(profile?.avatar_url ?? null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  function onPickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  }

  async function handleSaveProfile() {
    if (!isSupabaseConfigured || !profile) {
      showToast("Connect Supabase to save your profile.", "error");
      return;
    }
    setSavingProfile(true);
    try {
      const supabase = getSupabaseClient();
      let avatarUrl = profile.avatar_url;

      if (avatarFile) {
        const ext = avatarFile.name.split(".").pop();
        const path = `${profile.id}/avatar.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(path, avatarFile, { upsert: true });
        if (uploadError) throw uploadError;
        const { data: publicUrl } = supabase.storage.from("avatars").getPublicUrl(path);
        avatarUrl = `${publicUrl.publicUrl}?t=${Date.now()}`;
      }

      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName, avatar_url: avatarUrl })
        .eq("id", profile.id);
      if (error) throw error;

      refresh();
      showToast("Profile updated.");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't save profile.", "error");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword() {
    if (!isSupabaseConfigured) {
      showToast("Connect Supabase to change your password.", "error");
      return;
    }
    if (newPassword.length < 8) {
      showToast("Password must be at least 8 characters.", "error");
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast("Passwords don't match.", "error");
      return;
    }
    setSavingPassword(true);
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setNewPassword("");
      setConfirmPassword("");
      logAction("Changed their own password");
      showToast("Password changed.");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't change password.", "error");
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {!isSupabaseConfigured && (
        <p className="inline-block rounded-sm border border-warning/30 bg-warning/10 px-2 py-1 text-xs text-warning">
          Connect Supabase to manage a real profile, avatar, and password.
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Your profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-border bg-bg">
              {avatarPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarPreview} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-lg font-semibold text-muted">
                  {(email ?? "?").slice(0, 2).toUpperCase()}
                </span>
              )}
            </div>
            <div>
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                onChange={onPickAvatar}
                className="hidden"
              />
              <Button size="sm" variant="secondary" onClick={() => fileInput.current?.click()}>
                <Upload className="h-3.5 w-3.5" /> Change photo
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text">Email</label>
            <p className="text-sm text-muted">{email ?? "Sample data mode"}</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text">Full name</label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text">Role</label>
            <p className="text-sm capitalize text-muted">{isAdmin ? "Admin" : "Viewer"}</p>
          </div>

          <div className="flex justify-end border-t border-border pt-4">
            <Button onClick={handleSaveProfile} disabled={savingProfile}>
              {savingProfile && <Loader2 className="h-4 w-4 animate-spin" />}
              {savingProfile ? "Saving..." : "Save changes"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Change password</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text">New password</label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 8 characters"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text">Confirm new password</label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
          <div className="flex justify-end border-t border-border pt-4">
            <Button onClick={handleChangePassword} disabled={savingPassword} variant="secondary">
              {savingPassword ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <KeyRound className="h-4 w-4" />
              )}
              {savingPassword ? "Updating..." : "Update password"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <AppShell title="Profile">
      <ProfileContent />
    </AppShell>
  );
}
