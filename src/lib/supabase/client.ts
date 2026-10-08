import { createBrowserClient } from "@supabase/ssr";

import { getSupabasePublicEnv } from "@/lib/supabase/env";
import type { Database } from "@/types/database";

type CookieOptions = {
  domain?: string;
  path?: string;
  maxAge?: number;
  sameSite?: boolean | "lax" | "strict" | "none";
  secure?: boolean;
  httpOnly?: boolean;
};

/**
 * A client component is rendered on the server as well as in the browser, and
 * `createBrowserClient` reads its cookie jar as soon as it is constructed — so
 * both halves of the cookie adapter have to survive a missing `document`.
 */
function inBrowser() {
  return typeof document !== "undefined";
}

function serializeCookie(name: string, value: string, options: CookieOptions) {
  let cookie = `${name}=${encodeURIComponent(value)}`;

  if (options.maxAge !== undefined) cookie += `; Max-Age=${options.maxAge}`;
  if (options.domain) cookie += `; Domain=${options.domain}`;
  if (options.path) cookie += `; Path=${options.path}`;
  if (options.sameSite === true) cookie += "; SameSite=Strict";
  else if (options.sameSite === false) cookie += "; SameSite=Lax";
  else if (options.sameSite) cookie += `; SameSite=${options.sameSite}`;
  if (options.secure) cookie += "; Secure";
  if (options.httpOnly) cookie += "; HttpOnly";

  return cookie;
}

export function createClient() {
  const { url, anonKey } = getSupabasePublicEnv();

  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Add them to .env.local.",
    );
  }

  return createBrowserClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        // Server render: an empty jar is the honest answer. The session cookie is
        // read by `lib/supabase/server.ts` in that pass, and nothing in a render
        // can authenticate anything anyway.
        if (!inBrowser()) return [];

        return document.cookie
          .split("; ")
          .filter((entry) => entry.length > 0)
          .map((entry) => {
            const [name, ...rest] = entry.split("=");
            return { name, value: rest.join("=") };
          });
      },
      setAll(cookiesToSet) {
        if (!inBrowser()) return;

        try {
          for (const { name, value, options } of cookiesToSet) {
            document.cookie = serializeCookie(name, value, options);
          }
        } catch {
          // Called from a context without cookie write access; safe to ignore.
        }
      },
    },
  });
}
