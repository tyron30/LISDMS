import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { isSupabaseConfigured } from "./supabase";

// Server-side client for Server Components / Route Handlers.
// Reads/writes the auth cookie set by middleware.ts.
export function getSupabaseServerClient() {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured.");
  }
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set() {
          // Server Components can't set cookies; middleware handles refresh.
        },
        remove() {
          // Same as above.
        },
      },
    }
  );
}
