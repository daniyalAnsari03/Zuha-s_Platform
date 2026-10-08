import "server-only";

import { unstable_cache } from "next/cache";

import { CACHE_TAGS, DEFAULT_PUBLIC_REVALIDATE } from "@/lib/cache-tags";
import { createPublicClient } from "@/lib/supabase/public";

/**
 * During `next build` a dynamic route shell that reads cookies throws a
 * `DynamicServerError` while its loaders are prerendered; those loaders re-run
 * on demand at request time, so that expected error is not one to log loudly.
 */
function isExpectedStaticThrownError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    (error as { digest?: unknown }).digest === "DYNAMIC_SERVER_USAGE"
  );
}

export type MenuSubCategory = {
  id: string;
  name: string;
  slug: string;
};

export type MenuCategory = {
  id: string;
  name: string;
  slug: string;
  /** Active sub-categories, empty for Bag's / Jewellery style categories. */
  subCategories: MenuSubCategory[];
};

async function getMenuCategoriesInternal(): Promise<MenuCategory[]> {
  try {
    const supabase = createPublicClient();

    const [categoryRowsResult, subCategoryRowsResult] = await Promise.all([
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

    const categoryError = categoryRowsResult.error;
    const subCategoryError = subCategoryRowsResult.error;

    if (categoryError) throw categoryError;
    if (subCategoryError) throw subCategoryError;

    const categoryRows = categoryRowsResult.data ?? [];
    const subCategoryRows = subCategoryRowsResult.data ?? [];

    const grouped = new Map<string, MenuSubCategory[]>();
    for (const row of subCategoryRows) {
      const existing = grouped.get(row.category_id);
      const entry: MenuSubCategory = {
        id: row.id,
        name: row.name,
        slug: row.slug,
      };

      if (existing) {
        existing.push(entry);
      } else {
        grouped.set(row.category_id, [entry]);
      }
    }

    return categoryRows.map((category) => ({
      id: category.id,
      name: category.name,
      slug: category.slug,
      subCategories: grouped.get(category.id) ?? [],
    }));
  } catch (error) {
    if (isExpectedStaticThrownError(error)) return [];
    console.error("[menu-data] categories query failed.", error);
    throw error;
  }
}

export const getMenuCategories = unstable_cache(
  getMenuCategoriesInternal,
  ["menu-categories"],
  {
    tags: [CACHE_TAGS.menu, CACHE_TAGS.categories, CACHE_TAGS.subCategories],
    revalidate: DEFAULT_PUBLIC_REVALIDATE,
  },
);
