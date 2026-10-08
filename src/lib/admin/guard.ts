import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

/**
 * Admin access control (Phase 9A).
 *
 * The allowlist check is wrapped in React.cache() so that within a single
 * request, the layout, pages, and actions all share the same result — the
 * Supabase query runs only once instead of repeatedly.
 *
 * ADMIN ACCESS = a signed-in Supabase Auth user (Google or email/password) whose
 * email is on the allowlist in `settings.admin_emails`. That allowlist is a jsonb
 * array of lowercase emails, and `public.is_admin()` (migration 001) is what
 * every RLS policy calls, so this file asks the same question through the same
 * data rather than inventing a second source of truth.
 *
 * Two exports, deliberately different:
 *
 *  - {@link getAdminAccess} reports what is true without acting on it, so a layout
 *    can choose between "send them to sign in" and "this account is not an admin".
 *  - {@link requireAdmin} is the hard gate. Every admin server action and every
 *    admin data function calls it itself: a layout check protects the pages it
 *    wraps, but it is a single place to forget, and a layout does not protect a
 *    server action at all.
 *
 * The allowlist is read through the *shopper's own* session, not the service-role
 * key, so RLS decides: a non-admin's select on `settings` returns no rows (the
 * "admins can read settings" policy calls `is_admin()`), and the explicit list
 * comparison below is a second, independent check. Both have to pass. A missing
 * env var, a Supabase error or an unexpected shape all fail closed.
 */

/** Wrap the allowlist check so the Supabase queries run at most once per request. */
export const getAdminAccess = cache(
  async (): Promise<AdminAccess> => {
    // `getUser()` reads the JWT and validates it against Supabase Auth, so a stale
    // or forged cookie does not pass as a session. The allowlist read goes through
    // the same session (RLS decides whether a row comes back) but does not depend
    // on the user object, so the two network round-trips run together.
    const supabase = await createClient();

    const [authResult, { allowlist, error: allowlistError }] = await Promise.all([
      supabase.auth.getUser(),
      readAdminAllowlist(supabase),
    ]);

    const { user } = authResult.data;
    const error = authResult.error;

    if (error || !user?.email) {
      return { status: "signed-out" };
    }

    const email = user.email.trim().toLowerCase();

    // A read error fails closed too: an unreachable allowlist denies rather than
    // allows (the allowlist will be empty below).
    if (allowlistError) {
      console.error(
        "[admin] could not read the admin allowlist.",
        allowlistError.message,
      );
      return { status: "denied", email };
    }

    if (!isEmailOnAllowlist(allowlist, email)) {
      return { status: "denied", email };
    }

    return { status: "admin", user: { id: user.id, email } };
  },
);

/**
 * The gate every admin server action and admin data function calls first.
 *
 * Sends a signed-out caller to `/login?next=…` and throws
 * {@link AdminAccessDeniedError} for a signed-in non-admin, so no admin code can
 * run for either one.
 */
export async function requireAdmin(
  next: string = ADMIN_HOME_PATH,
): Promise<AdminUser> {
  const access = await getAdminAccess();

  if (access.status === "signed-out") {
    redirect(adminLoginHref(next));
  }

  if (access.status === "denied") {
    throw new AdminAccessDeniedError();
  }

  return access.user;
}

/**
 * Thrown by {@link requireAdmin} when someone is signed in but not an admin.
 *
 * Deliberately an error rather than a redirect: a server action must fail loudly
 * instead of quietly sending an anonymous visitor somewhere harmless, and the
 * message carries no detail about what the allowlist contains.
 */
export class AdminAccessDeniedError extends Error {
  constructor() {
    super("This action requires an admin account.");
    this.name = "AdminAccessDeniedError";
  }
}

/** The `settings` key holding the allowlist. Read by `public.is_admin()`. */
export const ADMIN_EMAILS_SETTING_KEY = "admin_emails";

/** Where the admin area starts, and the default sign-in return path. */
export const ADMIN_HOME_PATH = "/admin";

/** Builds the sign-in URL, carrying where the visitor was heading. */
export function adminLoginHref(next: string = ADMIN_HOME_PATH) {
  return `/login?next=${encodeURIComponent(next)}`;
}

/**
 * The `settings` row holding the allowlist, fetched through the signed-in
 * session so the `settings` RLS policy decides whether a row comes back at all.
 * Runs in parallel with `auth.getUser()` — it does not depend on the user
 * object, only on the session the client already carries.
 */
async function readAdminAllowlist(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<{ allowlist: unknown; error: { message: string } | null }> {
  const { data, error } = await supabase
    .from("settings")
    .select("value")
    .eq("key", ADMIN_EMAILS_SETTING_KEY)
    .maybeSingle();

  if (error) return { allowlist: undefined, error };

  return { allowlist: data?.value, error: null };
}

/**
 * True only when the allowlist actually contains this email.
 *
 * The RLS policy already decided whether a row came back; this compares the
 * real list against the email, so a policy that were ever loosened would still
 * not grant access to an email that is not on it.
 */
function isEmailOnAllowlist(allowlist: unknown, email: string): boolean {
  if (!Array.isArray(allowlist)) return false;

  return allowlist.some(
    (entry) => typeof entry === "string" && entry.trim().toLowerCase() === email,
  );
}

export type AdminAccess =
  | { status: "signed-out" }
  | { status: "denied"; email: string }
  | { status: "admin"; user: AdminUser };

export type AdminUser = {
  id: string;
  email: string;
};