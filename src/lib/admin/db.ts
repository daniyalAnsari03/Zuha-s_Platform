import "server-only";

/**
 * The database handle admin reads and writes run on.
 *
 * `SUPABASE_SERVICE_ROLE_KEY` lives in `.env.local` without a `NEXT_PUBLIC_`
 * prefix, so it never enters a client bundle, and both this file and
 * `lib/supabase/admin.ts` import `"server-only"`: if a Client Component ever
 * reaches for it, the build fails instead of shipping the service-role key.
 *
 * The key bypasses RLS, which is the point (an admin reads rows no shopper may
 * see) and also the danger. Every function that uses this handle must call
 * `requireAdmin()` from `@/lib/admin/guard` first — the key authorises nothing by
 * itself, it only decides *which* rows the already-authorised admin may touch.
 */

import { createAdminClient } from "@/lib/supabase/admin";

export type AdminDb = ReturnType<typeof createAdminClient>;

/**
 * Service-role Supabase client for admin reads and writes.
 *
 * Throws when `SUPABASE_SERVICE_ROLE_KEY` or `NEXT_PUBLIC_SUPABASE_URL` is
 * missing, rather than quietly falling back to the anon key and hitting RLS with
 * an admin page full of empty tables.
 */
export function getAdminDb(): AdminDb {
  return createAdminClient();
}