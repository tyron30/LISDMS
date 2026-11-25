"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isSupabaseConfigured, getSupabaseClient } from "./supabase";
import { useToast } from "./toast-context";

// Supabase errors are plain objects ({ message, code, ... }), not Error
// instances, so `err instanceof Error` silently hid the real reason (a
// permission problem, a missing column) behind a generic message.
export function errorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message: unknown }).message;
    if (typeof m === "string" && m) return m;
  }
  return fallback;
}

// Name of a joined relation, e.g. joinedName(row, "lgus") for `lgus(name)`.
export function joinedName(row: Record<string, unknown>, key: string): string | null {
  return (row[key] as { name?: string } | null | undefined)?.name ?? null;
}

// One place for the "load from Supabase" pattern every page used to repeat.
// - Supabase not configured  -> shows the sample (mock) data, flagged usingMock.
// - Supabase configured but the request fails -> surfaces `error` so the page
//   can show a Retry state. It NEVER swaps in sample data: a failed query that
//   quietly displays fake LGUs looks exactly like real data.
export function useSupabaseData<T>(
  fetcher: (sb: SupabaseClient) => Promise<T>,
  fixtures: { mock: T; empty: T },
  deps: unknown[] = []
) {
  const [data, setData] = useState<T>(() => (isSupabaseConfigured ? fixtures.empty : fixtures.mock));
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState<string | null>(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const reload = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    try {
      setError(null);
      setData(await fetcherRef.current(getSupabaseClient()));
    } catch (err) {
      setError(errorMessage(err, "Couldn't load data."));
    } finally {
      setLoading(false);
    }
  }, deps);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, setData, loading, error, usingMock: !isSupabaseConfigured, reload };
}

// Wraps a save/delete/upload: refuses politely when there's no database,
// tracks `busy`, and reports the real error message on failure.
export function useAction() {
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);

  const run = useCallback(
    async (fn: () => Promise<void>, failMessage = "Something went wrong."): Promise<boolean> => {
      if (!isSupabaseConfigured) {
        showToast("Connect Supabase to save changes — this is sample data.", "error");
        return false;
      }
      setBusy(true);
      try {
        await fn();
        return true;
      } catch (err) {
        showToast(errorMessage(err, failMessage), "error");
        return false;
      } finally {
        setBusy(false);
      }
    },
    [showToast]
  );

  return { busy, run };
}

// ---- Helpers for the joined-name queries every list page repeats ----
export type LguOption = { id: string; name: string };

export const toLguOptions = (lgus: { id: string; name: string }[]): LguOption[] =>
  lgus.map(({ id, name }) => ({ id, name }));

export async function fetchLguOptions(sb: SupabaseClient): Promise<LguOption[]> {
  const { data, error } = await sb.from("lgus").select("id, name").order("name");
  if (error) throw error;
  return data ?? [];
}

// Rows from `select("*, lgus(name)")` -> rows with a flat `lgu_name`.
export function withLguName<T>(rows: Record<string, unknown>[] | null): T[] {
  return (rows ?? []).map((r) => ({ ...r, lgu_name: joinedName(r, "lgus") ?? "Unknown LGU" })) as T[];
}
