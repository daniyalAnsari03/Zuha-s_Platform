import { type NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * OAuth callback for "Continue with Google".
 *
 * Google browser sign-in comes back to this route with a one-time `?code=`.
 * Because `/account` is a server-guarded dynamic page that `redirect("/login")`
 * the moment it sees no session, a code-carrying request aimed straight at
 * `/account` could lose the code before the browser ever exchanged it. This
 * route exchanges the code for a session up front, writes the session cookies,
 * and only then sends the shopper on to their destination — so the page they land
 * on already sees a signed-in session.
 *
 * Must run on every request (never static): it reads the request URL and the
 * cookie jar, both of which change per request.
 */

export const dynamic = "force-dynamic";

/** Where the shopper lands when no `?next=` return path was supplied. */
const ACCOUNT_HREF = "/account";

/**
 * `?next=` is only ever a same-origin relative path that starts with a single
 * "/". Anything else — an empty value, URL-encoded control characters, `//evil`,
 * `https://evil.example`, `javascript:…` — is ignored in favour of `/account`,
 * so the callback can never become an open redirect.
 */
function validNext(raw: string | null): raw is string {
  if (!raw) return false;

  // Control characters survive no URL resolution; a parser drops ASCII tabs and
  // newlines, so `/%09/evil` would silently become `//evil`. Never redirect there.
  if (/[\u0000-\u001f\u007f]/.test(raw)) return false;

  return raw.startsWith("/") && !raw.startsWith("//");
}

/**
 * The callback's own origin, used for every redirect.
 *
 * Behind a proxy (Vercel) the forwarded headers carry the public host and
 * scheme; otherwise the request URL itself is the ground truth. Never a
 * hard-coded host and never localhost — in development `request.url` already
 * yields `http://localhost:3000` on its own.
 */
function originOf(request: NextRequest): string {
  const proto = request.headers.get("x-forwarded-proto");
  const host = request.headers.get("x-forwarded-host");

  if (proto && host) return `${proto}://${host}`;

  return new URL(request.url).origin;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const origin = originOf(request);

  const fail = new URL("/login?error=auth", origin);

  if (!code) return NextResponse.redirect(fail);

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("[auth/callback] code exchange failed.", error.message);
      return NextResponse.redirect(fail);
    }

    const rawNext = url.searchParams.get("next");
    const next = validNext(rawNext) ? rawNext : ACCOUNT_HREF;

    return NextResponse.redirect(new URL(next, origin));
  } catch (caught) {
    console.error("[auth/callback] unexpected error.", caught);
    return NextResponse.redirect(fail);
  }
}