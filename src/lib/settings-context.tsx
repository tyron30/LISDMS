"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { isSupabaseConfigured, getSupabaseClient } from "./supabase";

interface AppSettings {
  org_name: string;
  logo_url: string | null;
}

const DEFAULT_SETTINGS: AppSettings = { org_name: "LISDMS", logo_url: null };

const SettingsContext = createContext<{
  settings: AppSettings;
  refresh: () => void;
} | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    try {
      const supabase = getSupabaseClient();
      const { data } = await supabase.from("app_settings").select("*").eq("id", 1).maybeSingle();
      if (data) setSettings({ org_name: data.org_name, logo_url: data.logo_url });
    } catch {
      // app_settings table may not exist yet if schema.sql hasn't been run; ignore.
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    document.title = settings.org_name;
  }, [settings.org_name]);

  return (
    <SettingsContext.Provider value={{ settings, refresh: load }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
