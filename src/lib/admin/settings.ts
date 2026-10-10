"use server";

/**
 * Settings: the store's public contact details.
 *
 * One row in `public.store_details` (migration 010) — a separate, publicly
 * readable table, because `settings` is admin-only readable and the footer and
 * the /contact page have to render these values for an anonymous visitor.
 * `settings.admin_emails` never leaves `settings`.
 *
 * Same contract as every other admin action: `requireAdmin()` first and the
 * payload re-validated here rather than trusted. Every field may be empty —
 * the storefront treats a blank field as "not set yet" and falls back to
 * `src/lib/site-config.ts` — so empty is stored rather than refused, and only
 * a malformed value (a bad email, a non-http link) is rejected.
 */

import { getAdminDb } from "@/lib/admin/db";
import { requireAdmin } from "@/lib/admin/guard";
import { revalidateStorefront } from "@/lib/admin/revalidate";
import {
  actionFail,
  actionOk,
  readLine,
  readOptionalEmail,
  readOptionalLink,
  readOptionalUsdRate,
  type ActionResult,
} from "@/lib/admin/validation";

/** The Settings form's values, all of which may be an empty string. */
export type StoreDetailsInput = {
  storeName: string;
  contactEmail: string;
  phone: string;
  address: string;
  instagram: string;
  facebook: string;
  tiktok: string;
  whatsapp: string;
  /**
   * "1 USD = X PKR" as typed. Empty means no rate, which hides the storefront's
   * USD option. Kept as a string because the form field is text.
   */
  usdRate: string;
};

/** The single row's id. Seeded by migration 010. */
const STORE_DETAILS_ID = 1;

export async function saveStoreDetails(
  input: StoreDetailsInput,
): Promise<ActionResult> {
  await requireAdmin();

  const storeName = readLine(input?.storeName, "Store name");
  if (!storeName.ok) return storeName;

  const contactEmail = readOptionalEmail(input?.contactEmail, "Contact email");
  if (!contactEmail.ok) return contactEmail;

  const phone = readLine(input?.phone, "Phone");
  if (!phone.ok) return phone;

  const address = readLine(input?.address, "Address");
  if (!address.ok) return address;

  const instagram = readOptionalLink(input?.instagram, "Instagram link");
  if (!instagram.ok) return instagram;

  const facebook = readOptionalLink(input?.facebook, "Facebook link");
  if (!facebook.ok) return facebook;

  const tiktok = readOptionalLink(input?.tiktok, "TikTok link");
  if (!tiktok.ok) return tiktok;

  const whatsapp = readOptionalLink(input?.whatsapp, "WhatsApp link");
  if (!whatsapp.ok) return whatsapp;

  const usdRate = readOptionalUsdRate(input?.usdRate);
  if (!usdRate.ok) return usdRate;

  const db = getAdminDb();

  const values = {
    store_name: storeName.value,
    contact_email: contactEmail.value,
    phone: phone.value,
    address: address.value,
    instagram_url: instagram.value,
    facebook_url: facebook.value,
    tiktok_url: tiktok.value,
    whatsapp_url: whatsapp.value,
    usd_rate: usdRate.value,
  };

  const { error } = await db
    .from("store_details")
    .upsert({ id: STORE_DETAILS_ID, ...values }, { onConflict: "id" });

  if (error) {
    console.error("[admin] could not save the store details.", error.message);

    // The most likely cause by far: migration 010 has not been run yet.
    return actionFail(
      "Could not save the settings. Run supabase/migrations/010_store_details.sql first, then try again.",
    );
  }

  // The contact details and social links are read through `getStoreDetails()`
  // from the shared (site) layout — the footer on every storefront page — and
  // cached behind the `store-details` tag, so the whole storefront is refreshed
  // rather than only the two pages that show them most obviously.
  revalidateStorefront({});

  return actionOk("Store details saved.");
}
