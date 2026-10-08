/* ============================================================================
 * SITE CONFIG — the one place the store's contact and social details live
 * ============================================================================
 * Phase 8, then Phase 9C. These are still the fallback values: the admin
 * dashboard's Settings screen writes the same details to the public
 * `store_details` row, and `src/lib/store-details.ts` prefers those values and
 * falls back to the constants below whenever a field is blank (or the table is
 * not there yet).
 *
 * Edit a value here to change the default for a store that has not filled that
 * field in — the footer, the homepage footer slide and the /contact page all
 * read the same merged result.
 *
 * They are deliberately NOT read from the `settings` table: that table is
 * admin-only readable, so an anonymous visitor (and the server component that
 * renders the footer) could not fetch it.
 *
 * An empty `href` in SITE_SOCIAL_LINKS renders that icon as a disabled
 * placeholder rather than a dead link.
 * ==========================================================================*/

export type SiteContact = {
  email: string;
  /** Shown as typed; `tel:` links strip the spaces. */
  phone: string;
  address: string;
};

export type SiteSocialLink = {
  /** Must match a key in the SOCIAL_ICONS map of the component rendering it. */
  label: string;
  href: string;
};

/**
 * The merged result every storefront surface renders: settings where they are
 * set, the constants below where they are not.
 *
 * The *type* lives here, next to the defaults, because the footer and the
 * homepage's client components only ever need the shape — the reader that
 * produces it (`src/lib/store-details.ts`) is server-only and must never be
 * imported from a Client Component.
 */
export type StoreDetails = {
  /** The name the site calls itself, never blank. */
  name: string;
  contact: SiteContact;
  /**
   * The social row, in display order: Instagram, Facebook, TikTok and
   * WhatsApp, with each `href` overridden by Settings where it is set. A
   * network with no link yet renders as a disabled placeholder icon.
   */
  socials: SiteSocialLink[];
};

/** The name the site calls itself when Settings has no store name yet. */
export const SITE_NAME = "ZUHA'S";

export const SITE_CONTACT: SiteContact = {
  email: "hello@zuhas.example",
  phone: "+92 300 0000000",
  address: "Studio 4, ZUHA'S, Lahore, Pakistan",
};

/** The footer's Follow row (and the contact page's), in display order. */
export const SITE_SOCIAL_LINKS: SiteSocialLink[] = [
  { label: "Instagram", href: "" },
  { label: "Facebook", href: "" },
  { label: "TikTok", href: "" },
  { label: "WhatsApp", href: "" },
];

/** `mailto:` target for a contact email, kept in one place. */
export const SITE_MAILTO = `mailto:${SITE_CONTACT.email}`;

/** `tel:` target: the same number without the spaces a human reads it with. */
export const SITE_TEL = `tel:${SITE_CONTACT.phone.replace(/\s/g, "")}`;

/**
 * The same two targets for whichever contact details are in effect — Settings
 * where they are set, the constants above where they are not. Defined here (and
 * not in the server-only reader) because the footer renders in the client tree.
 */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

export function mailtoHref(email: string): string {
  return `mailto:${email}`;
}