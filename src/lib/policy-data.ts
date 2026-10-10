import "server-only";

import { unstable_cache } from "next/cache";
import { cache } from "react";

import { CACHE_TAGS, DEFAULT_PUBLIC_REVALIDATE } from "@/lib/cache-tags";
import { STORE_POLICY_SLUGS } from "@/lib/policy-types";
import { createPublicClient } from "@/lib/supabase/public";

export type StorePolicy = {
  slug: string;
  title: string;
  content: string;
};

async function loadStorePolicy(slug: string): Promise<StorePolicy | null> {
  try {
    const supabase = createPublicClient();

    const { data, error } = await supabase
      .from("store_policies")
      .select("slug, title, content")
      .eq("slug", slug)
      .maybeSingle();

    if (error) throw error;

    // A missing row is not a fault: the page shows its empty state, exactly as
    // it does for a row that exists but has no content yet.
    if (!data) return null;

    return { slug: data.slug, title: data.title, content: data.content };
  } catch (error) {
    // A failed *query* is a real fault, so it is logged and rethrown for the
    // error boundary rather than dressed up as a missing page.
    console.error(`[policy-data] query failed while resolving policy "${slug}".`, error);
    throw error;
  }
}

/**
 * One policy page, cached and de-duplicated per request.
 *
 * `cache()` keeps `generateMetadata` and the page on a single lookup within one
 * request; `unstable_cache` reuses the result across requests until the Settings
 * screen saves that policy and expires its tag (`CACHE_TAGS.policy(slug)` /
 * `CACHE_TAGS.policies`). Returns `null` for a slug with no row.
 */
export const getStorePolicy = cache((slug: string) =>
  unstable_cache(() => loadStorePolicy(slug), ["store-policy", slug], {
    tags: [CACHE_TAGS.policy(slug), CACHE_TAGS.policies],
    revalidate: DEFAULT_PUBLIC_REVALIDATE,
  })(),
);

/**
 * The four policy slugs for `generateStaticParams`. Not read from the database:
 * the routes are fixed, so the list is the same const the writer validates
 * against and can never drift from it.
 */
export function getStorePolicySlugs(): { slug: string }[] {
  return STORE_POLICY_SLUGS.map((slug) => ({ slug }));
}
