import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { getSupabasePublicEnv } from "@/lib/supabase/env";
import type { Database } from "@/types/database";

/**
 * Keeps the Supabase session fresh.
 *
 * Supabase Auth hands out short-lived access tokens. The browser refreshes its own
 * copy, but a Server Component reading `cookies()` cannot: without this, an
 * hour after signing in the `/account` and `/checkout` pages would stop seeing the
 * shopper and quietly treat them as a guest.
 *
 * So every request revalidates the JWT against Supabase Auth. When a refresh is
 * due, the new cookies are written back onto the response, which is why the
 * response object is rebuilt inside `setAll` rather than captured once.
 *
 * Nothing here authorises anything — it only keeps the cookie current. The
 * browser uses the anon key, exactly as the Server Components do.
 */
export async function proxy(request: NextRequest) {
  // No Supabase session cookie, nothing to refresh: return immediately
  // without building the server client or calling `getClaims()`. This is the
  // common case - a guest visitor, and every static page render - and it keeps
  // Supabase off the request path entirely. A chunked cookie
  // (`sb-<ref>-auth-token.0`) still matches, because the name only has to
  // start with `sb-` and contain `-auth-token`.
  const hasSessionCookie = request.cookies
    .getAll()
    .some(
      (cookie) =>
        cookie.name.startsWith("sb-") && cookie.name.includes("-auth-token"),
    );

  if (!hasSessionCookie) return NextResponse.next({ request });

  let response = NextResponse.next({ request });

  const { url, anonKey } = getSupabasePublicEnv();

  // Nothing to keep fresh until the public env is filled in.
  if (!url || !anonKey) return response;

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }

        response = NextResponse.next({ request });

        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Reading the claims is enough to trigger a refresh when one is due. The result
  // is deliberately ignored: whatever this route does with the session, the
  // pages behind it decide for themselves.
  await supabase.auth.getClaims();

  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except Next's own assets and the image files in `public/`, which
     * the homepage slider and the product gallery serve directly.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff2?)$).*)",
  ],
};