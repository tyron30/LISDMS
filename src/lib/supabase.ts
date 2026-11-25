import { createBrowserClient, type CookieOptions } from "@supabase/ssr";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// isConfigured lets pages fall back to sample data during initial setup,
// instead of crashing when .env.local hasn't been filled in yet.
export const isSupabaseConfigured = Boolean(url && anonKey);

// @supabase/ssr hard-codes the auth cookie to live 400 days (its cookieOptions
// can't change that), which is why closing the app and reopening it dropped
// you straight back into the dashboard. These handlers write the same cookies
// without an expiry, so they last only until the browser is closed.
const sessionCookies = {
  getAll() {
    return document.cookie
      .split("; ")
      .filter(Boolean)
      .map((c) => {
        const i = c.indexOf("=");
        let value = c.slice(i + 1);
        try {
          value = decodeURIComponent(value);
        } catch {
          // leave undecodable values as-is
        }
        return { name: c.slice(0, i), value };
      });
  },
  setAll(cookies: { name: string; value: string; options: CookieOptions }[]) {
    cookies.forEach(({ name, value, options }) => {
      let cookie = `${name}=${encodeURIComponent(value)}; Path=${options?.path ?? "/"}; SameSite=Lax`;
      if (location.protocol === "https:") cookie += "; Secure";
      if (options?.maxAge === 0) cookie += "; Max-Age=0"; // deletion; anything else stays a session cookie
      document.cookie = cookie;
    });
  },
};

export function getSupabaseClient() {
  if (!isSupabaseConfigured) {
    throw new Error(
      "Supabase is not configured. Fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local"
    );
  }
  return createBrowserClient(url as string, anonKey as string, { cookies: sessionCookies });
}
