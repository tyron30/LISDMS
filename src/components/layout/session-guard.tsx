"use client";

import { useEffect, useRef, useState } from "react";
import { isSupabaseConfigured, getSupabaseClient } from "@/lib/supabase";
import { useToast } from "@/lib/toast-context";
import { checkSession, heartbeat, leaveTab, endSession } from "@/lib/session";

const IDLE_MS = 30 * 60 * 1000; // sign out after 30 minutes without activity
const WARN_BEFORE_MS = 5 * 60 * 1000;
const BEAT_MS = 30 * 1000;

// Once a page load has passed the check, later in-app navigations (each page
// mounts its own AppShell) shouldn't flash a blank screen re-running it.
let verifiedThisLoad = false;

// Mounted by AppShell, so it only runs on signed-in pages. Enforces:
//  - closing and reopening the app means signing in again (see lib/session.ts)
//  - a 12-hour maximum session
//  - sign-out after 30 minutes idle, with a warning 5 minutes before
// Returns `ready`: false until the session check passes, so protected content
// never flashes for someone who is about to be sent to the login page.
export function useSessionGuard() {
  const { showToast } = useToast();
  const [ready, setReady] = useState(!isSupabaseConfigured || verifiedThisLoad);
  const logoutTimer = useRef<ReturnType<typeof setTimeout>>();
  const warnTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    async function signOutAnd(reason: string) {
      verifiedThisLoad = false;
      endSession();
      await getSupabaseClient().auth.signOut({ scope: "local" }).catch(() => {});
      window.location.replace(`/login?reason=${reason}`);
    }

    const verdict = checkSession();
    if (verdict !== "ok") {
      signOutAnd(verdict);
      return;
    }
    verifiedThisLoad = true;
    setReady(true);

    function resetIdle() {
      clearTimeout(logoutTimer.current);
      clearTimeout(warnTimer.current);
      warnTimer.current = setTimeout(
        () => showToast("You'll be signed out in 5 minutes due to inactivity.", "error"),
        IDLE_MS - WARN_BEFORE_MS
      );
      logoutTimer.current = setTimeout(() => signOutAnd("timeout"), IDLE_MS);
    }

    const activity = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"];
    activity.forEach((e) => window.addEventListener(e, resetIdle));
    resetIdle();

    const beat = setInterval(heartbeat, BEAT_MS);
    const onVisible = () => document.visibilityState === "visible" && heartbeat();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", heartbeat);
    window.addEventListener("pagehide", leaveTab);

    return () => {
      activity.forEach((e) => window.removeEventListener(e, resetIdle));
      clearTimeout(logoutTimer.current);
      clearTimeout(warnTimer.current);
      clearInterval(beat);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", heartbeat);
      window.removeEventListener("pagehide", leaveTab);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return ready;
}
