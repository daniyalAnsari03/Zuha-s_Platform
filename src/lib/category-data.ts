import "server-only";

import { unstable_cache } from "next/cache";
import { cache } from "react";

import { CACHE_TAGS, DEFAULT_PUBLIC_REVALIDATE } from "@/lib/cache-tags";
import { createPublicClient } from "@/lib/supabase/public";
import type { Category } from "@/types/database";

export type SubCategorySlide = {
  id: string;
  categoryId: string;
  name: string;
  slug: string;
  imageUrl: string;
};

export type CategoryPageData = {
  category: Category;
  categorySlug: string;
  categoryName: string;
  subCategories: SubCategorySlide[];
};

/**
 * One row of the `sub_categories` embed below. The generated Supabase types
 * carry `Relationships: []`, so the embedded shape is described here and the
 * row is cast once, exactly like `product-data.ts` does for its embeds.
 */
type EmbeddedSubCategoryRow = {
  id: string;
  category_id: string;
  name: string;
  slug: string;
  image_url: string | null;
  is_active: boolean;
  sort_order: number;
};

async function getCategoryPageDataInternal(slug: string): Promise<CategoryPageData | null> {
  if (slug === "") return null;

  try {
    const supabase = createPublicClient();

    // One round trip: the category and its sub-categories arrive together,
    // which is what keeps this route cheap now that it is prerendered. The
    // unqualified filters apply to `categories`; the embed is filtered and
    // sorted below.
    const { data, error } = await supabase
      .from("categories")
      .select(
        "*, sub_categories(id, category_id, name, slug, image_url, is_active, sort_order)",
      )
      .eq("slug", slug)
      .eq("is_active", true)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    const category = data as unknown as Category & {
      sub_categories?: EmbeddedSubCategoryRow[] | null;
    };

    // A missing embed means the query did not do what this page needs. Say so
    // loudly rather than rendering the category without its sub-categories.
    if (!Array.isArray(category.sub_categories)) {
      throw new Error(
        `[category-data] no sub_categories embed returned for category "${slug}".`,
      );
    }

    const activeSubCategories = category.sub_categories
      .filter((row) => row.is_active)
      .sort((a, b) => a.sort_order - b.sort_order);

    const subCategories: SubCategorySlide[] = [];
    for (const row of activeSubCategories) {
      if (!row.image_url) continue;

      subCategories.push({
        id: row.id,
        categoryId: row.category_id,
        name: row.name,
        slug: row.slug,
        imageUrl: row.image_url,
      });
    }

    return {
      category,
      categorySlug: category.slug,
      categoryName: category.name,
      subCategories,
    };
  } catch (error) {
    // Never turn a failure into `null`: the route would bake a 404 for a
    // category that exists. Every error - a failed query and Next's own
    // `DYNAMIC_SERVER_USAGE` signal alike - is rethrown so the build fails
    // loudly for this path instead of prerendering a wrong page.
    console.error(
      `[category-data] query failed while resolving category "${slug}".`,
      error,
    );
    throw error;
  }
}

/**
 * One category's page data, cached and de-duplicated per request.
 *
 * `cache()` keeps `generateMetadata`, the page itself and the listing's
 * breadcrumb on a single lookup within one request; `unstable_cache` reuses the
 * result across requests until an admin write invalidates it through
 * `CACHE_TAGS.categories` / `CACHE_TAGS.subCategories` (and the per-category
 * tag, which `revalidateStorefront()` clears when that category changes).
 */
export const getCategoryPageData = cache((slug: string) =>
  unstable_cache(() => getCategoryPageDataInternal(slug), ["category-page", slug], {
    tags: [
      CACHE_TAGS.category(slug),
      CACHE_TAGS.categories,
      CACHE_TAGS.subCategories,
    ],
    revalidate: DEFAULT_PUBLIC_REVALIDATE,
  })(),
);

/**
 * Every active category slug, for `generateStaticParams`.
 *
 * Read straight from the database - not through `unstable_cache` - because it
 * only runs while the build resolves the route's params, and it must see the
 * catalogue as it is right now. Throws on purpose: the caller wraps it in a
 * try/catch so a database hiccup can never fail the build on its own.
 */
export async function getAllCategorySlugs(): Promise<string[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("categories")
    .select("slug")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) => row.slug);
}

/**
 * Every active (category slug, sub-category slug) pair, for
 * `generateStaticParams`. The parent must be active too: a sub-category of a
 * hidden category has no page worth prerendering.
 */
export async function getAllSubCategoryParams(): Promise<
  { slug: string; subSlug: string }[]
> {
  const supabase = createPublicClient();

  const [categoriesResponse, subCategoriesResponse] = await Promise.all([
    supabase.from("categories").select("id, slug").eq("is_active", true),
    supabase.from("sub_categories").select("id, category_id, slug").eq("is_active", true),
  ]);

  if (categoriesResponse.error) throw categoriesResponse.error;
  if (subCategoriesResponse.error) throw subCategoriesResponse.error;

  const slugByCategoryId = new Map(
    (categoriesResponse.data ?? []).map((row) => [row.id, row.slug]),
  );

  const params: { slug: string; subSlug: string }[] = [];
  for (const row of subCategoriesResponse.data ?? []) {
    const slug = slugByCategoryId.get(row.category_id);
    if (!slug) continue;

    params.push({ slug, subSlug: row.slug });
  }

  return params;
}
