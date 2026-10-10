/**
 * The four store policy pages, shared by the storefront, the footer, the
 * checkout line and the dashboard's Settings screen.
 *
 * Deliberately free of any server-only import (no Supabase, no `next/cache`),
 * exactly like `order-types.ts` and `contact-types.ts`, so a Client Component
 * can import the slugs and titles as well as the server can.
 */

export const STORE_POLICY_SLUGS = [
  "privacy-policy",
  "refund-policy",
  "terms-of-service",
  "shipping-policy",
] as const;

export type StorePolicySlug = (typeof STORE_POLICY_SLUGS)[number];

/** The fallback title for each slug, matching the migration 014 seed rows. */
export const STORE_POLICY_TITLES: Record<StorePolicySlug, string> = {
  "privacy-policy": "Privacy Policy",
  "refund-policy": "Refund Policy",
  "terms-of-service": "Terms of Service",
  "shipping-policy": "Shipping Policy",
};

/** A link to one policy, as the footer and the checkout line render it. */
export type StorePolicyLink = {
  slug: StorePolicySlug;
  label: string;
};

/** The policy links in display order, for the footer and the checkout line. */
export const STORE_POLICY_LINKS: StorePolicyLink[] = STORE_POLICY_SLUGS.map(
  (slug) => ({ slug, label: STORE_POLICY_TITLES[slug] }),
);

export function isStorePolicySlug(value: string): value is StorePolicySlug {
  return (STORE_POLICY_SLUGS as readonly string[]).includes(value);
}
