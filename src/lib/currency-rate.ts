import "server-only";

import { unstable_cache } from "next/cache";

import { CACHE_TAGS, DEFAULT_PUBLIC_REVALIDATE } from "@/lib/cache-tags";
import { type CurrencyRates } from "@/lib/currency";
import { createPublicClient } from "@/lib/supabase/public";

/**
 * The storefront's conversion rates, read on the server and handed to the
 * `CurrencyProvider` as a prop so statically generated pages still work.
 *
 * The values live on the public `store_details` row (migration 015 for USD,
 * migration 016 for EUR/GBP/AED/CAD) and are cached behind the same
 * `store-details` tag the footer/contact details use, so the Settings screen's
 * existing `revalidateStorefront({})` call already expires them — nothing extra
 * has to be invalidated.
 *
 * A currency missing from the returned map (no rate, or a malformed value) is
 * hidden from the storefront switcher. A missing row or an un-run migration
 * fails closed to an empty map, i.e. PKR only.
 */

/** Columns on `store_details` that hold each foreign currency's rate. */
function readRate(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : undefined;
}

async function getCurrencyRatesInternal(): Promise<CurrencyRates> {
  try {
    const supabase = createPublicClient();

    const { data, error } = await supabase
      .from("store_details")
      .select("usd_rate, eur_rate, gbp_rate, aed_rate, cad_rate")
      .eq("id", 1)
      .maybeSingle();

    if (error || !data) return {};

    const rates: CurrencyRates = {};

    const usd = readRate(data.usd_rate);
    if (usd !== undefined) rates.USD = usd;

    const eur = readRate(data.eur_rate);
    if (eur !== undefined) rates.EUR = eur;

    const gbp = readRate(data.gbp_rate);
    if (gbp !== undefined) rates.GBP = gbp;

    const aed = readRate(data.aed_rate);
    if (aed !== undefined) rates.AED = aed;

    const cad = readRate(data.cad_rate);
    if (cad !== undefined) rates.CAD = cad;

    return rates;
  } catch {
    return {};
  }
}

export const getCurrencyRates = unstable_cache(
  getCurrencyRatesInternal,
  ["currency-rates"],
  {
    tags: [CACHE_TAGS.storeDetails],
    revalidate: DEFAULT_PUBLIC_REVALIDATE,
  },
);
