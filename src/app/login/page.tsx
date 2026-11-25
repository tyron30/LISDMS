"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LayoutDashboard, Loader2, Lock, Mail, ShieldAlert } from "lucide-react";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Button } from "@/components/ui/button";
import { isSupabaseConfigured, getSupabaseClient } from "@/lib/supabase";
import { logAction } from "@/lib/audit";
import { startSession } from "@/lib/session";
import { loadPreferences } from "@/lib/preferences";
import { useSettings } from "@/lib/settings-context";

const MAX_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 30;

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { settings } = useSettings();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);
  const REASONS: Record<string, string> = {
    timeout: "You were signed out after 30 minutes of inactivity. Please sign in again.",
    closed: "Your session ended when the app was closed. Please sign in again.",
    expired: "Your session reached its 12-hour limit. Please sign in again.",
  };
  const reasonMessage = REASONS[searchParams.get("reason") ?? ""];

  useEffect(() => {
    if (lockoutRemaining <= 0) return;
    const t = setInterval(() => setLockoutRemaining((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [lockoutRemaining]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (lockoutRemaining > 0) return;

    if (!isSupabaseConfigured) {
      setError(
        "Supabase isn't configured yet, so there's no login to check against. Fill in .env.local, then this form will work."
      );
      return;
    }

    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setError(signInError.message);
        // This is a client-side deterrent for casual retries, not the real
        // protection — Supabase Auth already rate-limits sign-in attempts
        // server-side regardless of what this UI does.
        const next = failedAttempts + 1;
        setFailedAttempts(next);
        if (next >= MAX_ATTEMPTS) {
          setLockoutRemaining(LOCKOUT_SECONDS);
          setFailedAttempts(0);
        }
        return;
      }
      const next = searchParams.get("next") || loadPreferences().startPage || "/dashboard";
      startSession();
      logAction("Signed in");
      router.push(next);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      {/* Background photo + darkening gradient so form text stays readable
          regardless of the image's own brightness. Ken Burns is a slow,
          subtle zoom — disabled automatically for prefers-reduced-motion
          via the global rule in globals.css. */}
      <div className="absolute inset-0 -z-10">
        {/* Plain <img>, not next/image — a full-bleed cover background
            doesn't need responsive srcset/optimization, and this avoids
            Next's image optimizer pipeline (which needs a working `sharp`
            install and can fail to read the file on some Windows setups). */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/login-bg.webp"
          alt=""
          className="h-full w-full animate-ken-burns object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/75 via-black/45 to-black/80" />
      </div>

      <div className="relative z-10 w-full max-w-sm animate-fade-in-up">
        <div className="mb-7 flex flex-col items-center gap-3 text-center">
          {settings.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={settings.logo_url}
              alt={settings.org_name}
              className="h-12 w-12 rounded-md object-cover shadow-lg ring-1 ring-white/20"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-md bg-brand text-brand-fg shadow-lg ring-1 ring-white/20">
              <LayoutDashboard className="h-6 w-6" />
            </div>
          )}
          <div>
            <h1 className="text-xl font-semibold text-white drop-shadow-sm">
              Sign in to {settings.org_name}
            </h1>
            <p className="mt-1 text-sm text-white/80 drop-shadow-sm">
              LGU IT Support &amp; Deployment Monitoring System
            </p>
          </div>
        </div>

        {reasonMessage && (
          <p className="mb-4 rounded-md border border-warning/40 bg-warning/15 px-3 py-2 text-center text-xs text-warning backdrop-blur-sm">
            {reasonMessage}
          </p>
        )}

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-lg border border-white/15 bg-surface/90 p-6 shadow-2xl backdrop-blur-xl transition-shadow duration-300 hover:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] dark:bg-surface/80"
        >
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-sm font-medium text-text">
              Email
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@lisdms.gov.ph"
                className="pl-9"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="text-sm font-medium text-text">
              Password
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted" />
              <PasswordInput
                id="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="pl-9"
              />
            </div>
          </div>

          {lockoutRemaining > 0 && (
            <p className="flex items-center gap-1.5 rounded-sm border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
              <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
              Too many attempts. Try again in {lockoutRemaining}s.
            </p>
          )}

          {error && lockoutRemaining === 0 && (
            <p className="rounded-sm border border-critical/30 bg-critical/10 px-3 py-2 text-xs text-critical">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={loading || lockoutRemaining > 0}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? "Signing in..." : lockoutRemaining > 0 ? `Try again in ${lockoutRemaining}s` : "Sign in"}
          </Button>

          {!isSupabaseConfigured && (
            <p className="text-center text-xs text-muted">
              Running without Supabase configured — the rest of the app is still browsable with
              sample data.
            </p>
          )}
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
