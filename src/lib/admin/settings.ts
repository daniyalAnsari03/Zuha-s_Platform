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
import { deleteStoredImages } from "@/lib/admin/storage";
import {
  actionFail,
  actionOk,
  readDeliveryCharge,
  readLine,
  readOptionalCurrencyRate,
  readOptionalEmail,
  readImageUrl,
  readOptionalLink,
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
  /** "1 EUR = X PKR" as typed. Empty hides EUR on the storefront. */
  eurRate: string;
  /** "1 GBP = X PKR" as typed. Empty hides GBP on the storefront. */
  gbpRate: string;
  /** "1 AED = X PKR" as typed. Empty hides AED on the storefront. */
  aedRate: string;
  /** "1 CAD = X PKR" as typed. Empty hides CAD on the storefront. */
  cadRate: string;
  deliveryCharge: string;
  showDelivery: boolean;
  saleImageUrl: string | null;
  saleMobileImageUrl: string | null;
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

  const usdRate = readOptionalCurrencyRate(input?.usdRate, "USD rate");
  if (!usdRate.ok) return usdRate;

  const eurRate = readOptionalCurrencyRate(input?.eurRate, "EUR rate");
  if (!eurRate.ok) return eurRate;

  const gbpRate = readOptionalCurrencyRate(input?.gbpRate, "GBP rate");
  if (!gbpRate.ok) return gbpRate;

  const aedRate = readOptionalCurrencyRate(input?.aedRate, "AED rate");
  if (!aedRate.ok) return aedRate;

  const cadRate = readOptionalCurrencyRate(input?.cadRate, "CAD rate");
  if (!cadRate.ok) return cadRate;

  const deliveryCharge = readDeliveryCharge(input?.deliveryCharge);
  if (!deliveryCharge.ok) return deliveryCharge;

  if (typeof input?.showDelivery !== "boolean") {
    return actionFail("Show delivery must be enabled or disabled.");
  }

  const saleImageUrl = readImageUrl(input?.saleImageUrl);
  if (!saleImageUrl.ok) return saleImageUrl;

  const saleMobileImageUrl = readImageUrl(input?.saleMobileImageUrl);
  if (!saleMobileImageUrl.ok) return saleMobileImageUrl;

  const db = getAdminDb();

  const { data: previousImages, error: previousImagesError } = await db
    .from("store_details")
    .select("sale_image_url, sale_mobile_image_url")
    .eq("id", STORE_DETAILS_ID)
    .maybeSingle();

  if (previousImagesError) {
    console.error("[admin] could not read the previous Sale slide images.", previousImagesError.message);
    return actionFail(
      "Could not save the Sale slide. Run supabase/migrations/018_sale_slide.sql first, then try again.",
    );
  }

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
    eur_rate: eurRate.value,
    gbp_rate: gbpRate.value,
    aed_rate: aedRate.value,
    cad_rate: cadRate.value,
    delivery_charge: deliveryCharge.value,
    show_delivery: input.showDelivery,
    sale_image_url: saleImageUrl.value,
    sale_mobile_image_url: saleMobileImageUrl.value,
  };

  const { error } = await db
    .from("store_details")
    .upsert({ id: STORE_DETAILS_ID, ...values }, { onConflict: "id" });

  if (error) {
    console.error("[admin] could not save the store details.", error.message);

    return actionFail(
      "Could not save the settings. Run supabase/migrations/021_delivery_charge.sql first, then try again.",
    );
  }

  await deleteStoredImages(db, [
    previousImages?.sale_image_url === saleImageUrl.value
      ? null
      : previousImages?.sale_image_url,
    previousImages?.sale_mobile_image_url === saleMobileImageUrl.value
      ? null
      : previousImages?.sale_mobile_image_url,
  ]);

  // The contact details and social links are read through `getStoreDetails()`
  // from the shared (site) layout — the footer on every storefront page — and
  // cached behind the `store-details` tag, so the whole storefront is refreshed
  // rather than only the two pages that show them most obviously.
  revalidateStorefront({});

  return actionOk("Store details saved.");
}
