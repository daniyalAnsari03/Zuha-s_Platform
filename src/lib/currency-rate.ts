import "server-only";

import { unstable_cache } from "next/cache";

import { CACHE_TAGS, DEFAULT_PUBLIC_REVALIDATE } from "@/lib/cache-tags";
import { createPublicClient } from "@/lib/supabase/public";

/**
 * The storefront conversion rate, read on the server and handed to the
 * `CurrencyProvider` as a prop so statically generated pages still work.
 *
 * The value lives on the public `store_details` row (migration 015) and is
 * cached behind the same `store-details` tag the footer/contact details use, so
 * the Settings screen's existing `revalidateStorefront({})` call already
 * expires it — nothing extra has to be invalidated.
 *
 * `null` means "no rate set yet": the storefront hides the USD option and shows
 * PKR only. A malformed or missing row fails closed to `null`.
 */
async function getUsdRateInternal(): Promise<number | null> {
  try {
    const supabase = createPublicClient();

    const { data, error } = await supabase
      .from("store_details")
      .select("usd_rate")
      .eq("id", 1)
      .maybeSingle();

    if (error || !data) return null;

    const rate = data.usd_rate;
    return typeof rate === "number" && Number.isFinite(rate) && rate > 0
      ? rate
      : null;
  } catch {
    return null;
  }
}

export const getUsdRate = unstable_cache(
  getUsdRateInternal,
  ["usd-rate"],
  {
    tags: [CACHE_TAGS.storeDetails],
    revalidate: DEFAULT_PUBLIC_REVALIDATE,
  },
);
