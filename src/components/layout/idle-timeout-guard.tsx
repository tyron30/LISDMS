"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { isSupabaseConfigured, getSupabaseClient } from "@/lib/supabase";
import { useToast } from "@/lib/toast-context";

const TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const WARNING_BEFORE_MS = 5 * 60 * 1000; // warn 5 minutes before signing out

// Mounted once inside AppShell, so it only runs on authenticated pages
// (never on /login). Any mouse/keyboard/touch/scroll activity resets the
// clock. This is a UX safety net, not the whole security story — the real
// enforcement is that Supabase invalidates the session server-side once
// signed out, and middleware.ts redirects any subsequent request without a
// valid session back to /login regardless of this timer running.
export function IdleTimeoutGuard() {
  const router = useRouter();
  const { showToast } = useToast();
  const logoutTimer = useRef<ReturnType<typeof setTimeout>>();
  const warningTimer = useRef<ReturnType<typeof setTimeout>>();
  const warnedRef = useRef(false);

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    async function handleTimeout() {
      const supabase = getSupabaseClient();
      await supabase.auth.signOut();
      router.push("/login?reason=timeout");
      router.refresh();
    }

    function resetTimers() {
      warnedRef.current = false;
      if (logoutTimer.current) clearTimeout(logoutTimer.current);
      if (warningTimer.current) clearTimeout(warningTimer.current);

      warningTimer.current = setTimeout(() => {
        warnedRef.current = true;
        showToast("You'll be signed out in 5 minutes due to inactivity.", "error");
      }, TIMEOUT_MS - WARNING_BEFORE_MS);

      logoutTimer.current = setTimeout(handleTimeout, TIMEOUT_MS);
    }

    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"];
    events.forEach((e) => window.addEventListener(e, resetTimers));
    resetTimers();

    return () => {
      events.forEach((e) => window.removeEventListener(e, resetTimers));
      if (logoutTimer.current) clearTimeout(logoutTimer.current);
      if (warningTimer.current) clearTimeout(warningTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  return null;
}
