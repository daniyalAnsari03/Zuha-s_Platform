/**
 * Supabase public env resolution.
 *
 * Supabase renamed the browser-safe key from "anon key" to "publishable key",
 * and projects in the wild use either name, so both are accepted here. The
 * canonical name used across the app is NEXT_PUBLIC_SUPABASE_ANON_KEY.
 */
export function getSupabasePublicEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  return { url, anonKey };
}

export function hasSupabasePublicEnv() {
  const { url, anonKey } = getSupabasePublicEnv();
  return Boolean(url) && Boolean(anonKey);
}
export function getSupabaseServiceRole() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return { url, serviceRole };
}
