"use client";

import { useCallback, useEffect, useState } from "react";
import { isSupabaseConfigured, getSupabaseClient } from "./supabase";

export type Role = "admin" | "user";

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  role: Role;
}

export function useAuth() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) {
      // No backend configured yet: treat as admin so the whole UI stays
      // reviewable with sample data, matching the rest of the app's fallback.
      setProfile(null);
      setLoading(false);
      return;
    }
    const supabase = getSupabaseClient();
    let user = null;
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      user = data.user;
    } catch {
      // No usable session (never signed in, just signed out, or a stale token
      // the library has already discarded): report "signed out" and stop.
      // Don't call signOut() here — it emits SIGNED_OUT, which re-runs this
      // loader, which would sign out again: an endless loop that froze the
      // tab when clicking Logout.
      setProfile(null);
      setLoading(false);
      return;
    }

    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
    setProfile(
      (data as Profile) ?? {
        id: user.id,
        email: user.email ?? null,
        full_name: null,
        avatar_url: null,
        role: "user",
      }
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    if (!isSupabaseConfigured) return;
    const supabase = getSupabaseClient();
    const { data: sub } = supabase.auth.onAuthStateChange(() => load());
    return () => sub.subscription.unsubscribe();
  }, [load]);

  const isAdmin = !isSupabaseConfigured || profile?.role === "admin";

  return {
    email: profile?.email ?? null,
    profile,
    isAdmin,
    loading,
    isSupabaseConfigured,
    refresh: load,
  };
}
