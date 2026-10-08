/**
 * Client-side catalog search.
 *
 * Products are queried on demand (one debounced request per settled keystroke)
 * and only the six columns a result row needs are selected. Categories are a
 * tiny table, so they are loaded once when the search popup opens and matched in
 * memory - that keeps a category hit as fast as a product hit.
 *
 * Both lookups read Supabase directly. A query that succeeds with an empty
 * catalog yields no hits, which the search popup renders as "No results". A
 * failing query is logged and rethrown so the error boundary shows — never a
 * silent empty list.
 */

import { createClient } from "@/lib/supabase/client";

export const SEARCH_RESULT_LIMIT = 6;

export type SearchProductHit = {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  price: number;
  discountPrice: number | null;
};

export type SearchCategoryHit = {
  id: string;
  name: string;
  href: string;
  kind: "category" | "sub-category";
};

type ProductRow = {
  id: string;
  name: string;
  slug: string;
  price: number;
  discount_price: number | null;
  images: string[] | null;
};

/**
 * Escapes the LIKE wildcards so a query such as "50%" or "S_" is matched
 * literally instead of turning into a pattern.
 */
function likePattern(term: string) {
  return `%${term.replace(/[\\%_]/g, (match) => `\\${match}`)}%`;
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}

/**
 * Every active category with its active sub-categories, as flat rows that each
 * already know where they link to. An empty catalog returns nothing (the search
 * popup shows "No results"); a failing query is logged and rethrown.
 */
export async function loadCategoryIndex(): Promise<SearchCategoryHit[]> {
  const supabase = createClient();

  const [categories, subCategories] = await Promise.all([
    supabase
      .from("categories")
      .select("id, name, slug")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("sub_categories")
      .select("id, category_id, name, slug")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
  ]);

  if (categories.error) {
    console.error("[search-data] categories query failed.", categories.error);
    throw categories.error;
  }

  if (subCategories.error) {
    console.error("[search-data] sub_categories query failed.", subCategories.error);
    throw subCategories.error;
  }

  if (!categories.data) return [];

  const categorySlugById = new Map(
    categories.data.map((category) => [category.id, category.slug]),
  );

  const index: SearchCategoryHit[] = categories.data.map((category) => ({
    id: category.id,
    name: category.name,
    href: `/category/${category.slug}`,
    kind: "category",
  }));

  for (const subCategory of subCategories.data ?? []) {
    const parentSlug = categorySlugById.get(subCategory.category_id);
    // A sub-category whose parent is inactive is unreachable, so it is not
    // offered as a result.
    if (!parentSlug) continue;

    index.push({
      id: subCategory.id,
      name: subCategory.name,
      href: `/category/${parentSlug}/${subCategory.slug}`,
      kind: "sub-category",
    });
  }

  return index;
}

/** Category rows whose name contains the query, in the admin's own order. */
export function matchCategories(
  term: string,
  index: SearchCategoryHit[],
): SearchCategoryHit[] {
  const needle = normalize(term);
  if (needle === "") return [];

  return index
    .filter((entry) => normalize(entry.name).includes(needle))
    .slice(0, SEARCH_RESULT_LIMIT);
}

/**
 * Products whose name contains the query, newest first. An empty catalog
 * returns nothing (the search popup shows "No results"); a failing query is
 * logged and rethrown.
 */
export async function searchProducts(term: string): Promise<SearchProductHit[]> {
  const needle = normalize(term);
  if (needle === "") return [];

  const supabase = createClient();
  const { data, error } = await supabase
    .from("products")
    .select("id, name, slug, price, discount_price, images")
    .ilike("name", likePattern(term))
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(SEARCH_RESULT_LIMIT);

  if (error) {
    console.error("[search-data] products search query failed.", error);
    throw error;
  }

  return (data ?? []).map((row: ProductRow) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    imageUrl: row.images?.[0] ?? null,
    price: Number(row.price),
    discountPrice:
      row.discount_price === null ? null : Number(row.discount_price),
  }));
}
