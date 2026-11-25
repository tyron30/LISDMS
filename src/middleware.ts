import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login"];

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // If Supabase isn't configured yet, let everything through so the app
  // is still browsable with sample data during initial setup.
  if (!url || !anonKey) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value;
      },
      // Drop the library's 400-day lifetime so refreshed auth cookies stay
      // session cookies (cleared when the browser closes). Deletions keep maxAge 0.
      set(name: string, value: string, options: CookieOptions) {
        const { maxAge, expires, ...rest } = options;
        response.cookies.set({ name, value, ...rest, ...(maxAge === 0 ? { maxAge: 0 } : {}) });
      },
      remove(name: string, options: CookieOptions) {
        response.cookies.set({ name, value: "", ...options, maxAge: 0 });
      },
    },
  });

  let user = null;
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    user = data.user;
  } catch {
    // A stale/invalid refresh token cookie (e.g. left over from a previous
    // session on a different Supabase project, or after a manual DB reset)
    // makes getUser() throw on every request. Clear every sb-* auth cookie
    // so it stops erroring and the person just gets treated as signed out.
    request.cookies.getAll().forEach((cookie) => {
      if (cookie.name.startsWith("sb-")) {
        response.cookies.set({ name: cookie.name, value: "", maxAge: 0 });
      }
    });
    user = null;
  }

  const isPublicPath = PUBLIC_PATHS.some((p) => request.nextUrl.pathname.startsWith(p));

  if (!user && !isPublicPath) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (user && request.nextUrl.pathname.startsWith("/login")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    // Run on everything except static assets, common image/font file
    // extensions, and the auth callback API. Without the extension
    // exclusion, requests for files under /public (e.g. the login
    // background) get treated as protected routes and redirected to
    // /login instead of being served.
    "/((?!_next/static|_next/image|favicon.ico|api/auth|.*\\.(?:svg|png|jpg|jpeg|webp|gif|ico|css|js|woff|woff2|ttf)$).*)",
  ],
};
