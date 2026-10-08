/**
 * Slug generation for the dashboard.
 *
 * Slugs are never typed by hand and never trusted from the browser: the admin
 * types a name, the name becomes a slug here, and the data layer makes it unique
 * (`uniqueSlug` in `queries.ts`). That keeps the storefront URLs readable
 * ("/category/womens", "/product/lawn-shirt") and stops one category called
 * "Casual" from colliding with another's.
 *
 * No server imports, so it can be unit-reasoned about without Supabase.
 */

import { MAX_SLUG_LENGTH } from "@/lib/admin/validation";

/**
 * Turns a name into a URL-safe slug.
 *
 * Apostrophes are dropped rather than encoded, so "Women's" becomes `womens` and
 * "Kid's" becomes `kids`. Accents are folded to ASCII. Anything with no
 * alphanumeric characters left ("&") collapses to the caller's fallback, so a
 * slug is never empty.
 */
export function slugify(value: string, fallback: string): string {
  const slug = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['‘’`]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, "");

  return slug || fallback;
}
