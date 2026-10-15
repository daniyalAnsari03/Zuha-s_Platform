import "server-only";

import { unstable_cache } from "next/cache";
import { cache } from "react";

import { CACHE_TAGS, DEFAULT_PUBLIC_REVALIDATE } from "@/lib/cache-tags";
import { getCategoryPageData } from "@/lib/category-data";
import { createPublicClient } from "@/lib/supabase/public";
import {
  pairImagesWithColors,
  parseOptionList,
  type ProductListingData,
  type ProductListItem,
} from "@/lib/products";

type SupabaseClient = ReturnType<typeof createPublicClient>;

/**
 * The shape of the errors this module has to report. Supabase hands back a
 * `PostgrestError`, but a thrown error or a failed client creation can be
 * anything at all, so every field is optional.
 */
type QueryError = {
  name?: string;
  message?: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
};

/**
 * Reports a failed Supabase query in full.
 *
 * Each field is printed on its own labelled line instead of one `JSON.stringify`
 * blob: a PostgREST error that carries none of the four fields used to collapse
 * to a bare `{}`, which hid the actual cause of a broken query. `hint` is the
 * field Postgres fills with the exact `GRANT ...` statement needed, so it is
 * always printed.
 *
 * The callers then rethrow. These loaders run while `next build` prerenders
 * every param `generateStaticParams` returns, and they used to swallow Next's
 * own `DYNAMIC_SERVER_USAGE` signal and answer `null` - which bakes a 404 (or
 * an empty listing) into a page that really exists. A path now either builds
 * with real content or fails loudly; when it fails, `dynamicParams` still
 * renders it on first visit at runtime.
 */
function logQueryFailure(label: string, error: unknown): void {
  const err = (error ?? {}) as QueryError;
  const keys =
    error && typeof error === "object" ? Object.keys(error).join(", ") : "";
  const name = err.name ? `${err.name}: ` : "";

  console.error(
    `[product-data] ${label} | message: ${name}${err.message ?? "(none)"}` +
      ` | code: ${err.code ?? "(none)"}` +
      ` | details: ${err.details ?? "(none)"}` +
      ` | hint: ${err.hint ?? "(none)"}` +
      ` | keys: ${keys || "(none)"}`,
  );
}

function fromDatabaseRow(row: {
  id: string;
  name: string;
  slug: string;
  price: number;
  discount_price: number | null;
  sizes: string | null;
  color: string | null;
  images: string[] | null;
  created_at: string;
}): ProductListItem {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    imageUrl: row.images?.[0] ?? null,
    secondImageUrl: row.images?.[1] ?? null,
    price: Number(row.price),
    discountPrice:
      row.discount_price === null ? null : Number(row.discount_price),
    sizes: parseOptionList(row.sizes),
    colors: parseOptionList(row.color),
    createdAt: row.created_at,
  };
}

type ListingScope = {
  categorySlug: string;
  /** Present for a sub-category listing, absent for a top-level one. */
  subCategorySlug?: string;
};

export type ProductDetail = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  discountPrice: number | null;
  sizes: string[];
  colors: string[];
  images: string[];
  /**
   * Optional colour tag per image (migration 017), index-aligned with
   * `images`; "" means "no tag". Always the same length as `images`, so the
   * slider can match an image to a colour without guessing.
   */
  imageColors: string[];
  createdAt: string;
  category: {
    slug: string;
    name: string;
  } | null;
  subCategory: {
    slug: string;
    name: string;
  } | null;
};

type ProductRow = {
  id: string;
  name: string;
  slug: string;
  price: number;
  discount_price: number | null;
  sizes: string | null;
  color: string | null;
  images: string[] | null;
  created_at: string;
};

/**
 * `color` was added by migration 004, so the listing asks for it but stays
 * usable before that migration is applied. Both are `const` string literals,
 * which is what keeps the generated Supabase row types intact.
 */
const PRODUCT_COLUMNS =
  "id, name, slug, price, discount_price, sizes, color, images, created_at";

const PRODUCT_COLUMNS_WITHOUT_COLOR =
  "id, name, slug, price, discount_price, sizes, images, created_at";

type ResolvedScope =
  | {
      kind: "category";
      categoryId: string;
      title: string;
    }
  | {
      kind: "sub-category";
      categoryId: string;
      subCategoryId: string;
      title: string;
    };

/**
 * Turns the route slugs into the ids the `products` table is filtered by.
 *
 * The category is read through `getCategoryPageData` - the very lookup the
 * listing's breadcrumb and the category page use - so one render never queries
 * `categories` twice for the same slug. That read and the sub-category lookup
 * are independent, so they are issued together and the pair is checked
 * afterwards.
 *
 * Returns null when the category or sub-category is not in the database, so the
 * caller 404s instead of inventing a scope.
 */
async function resolveScope(
  supabase: SupabaseClient,
  categorySlug: string,
  subCategorySlug?: string,
): Promise<ResolvedScope | null> {
  const categoryLookup = getCategoryPageData(categorySlug);

  const subCategoryLookup = subCategorySlug
    ? supabase
        .from("sub_categories")
        .select("id, category_id, name")
        .eq("slug", subCategorySlug)
        .eq("is_active", true)
        .maybeSingle()
    : Promise.resolve(null);

  const [categoryPage, subCategoryResponse] = await Promise.all([
    categoryLookup,
    subCategoryLookup,
  ]);

  const category = categoryPage?.category;
  if (!category) return null;

  if (!subCategorySlug) {
    return {
      kind: "category",
      categoryId: category.id,
      title: category.name,
    };
  }

  if (subCategoryResponse?.error) {
    logQueryFailure(
      `sub_categories query failed for "${categorySlug}/${subCategorySlug}".`,
      subCategoryResponse.error,
    );
    throw subCategoryResponse.error;
  }

  const subCategory = subCategoryResponse?.data;
  if (!subCategory) return null;

  // A slug from another parent is a different (non-existent) route, not a
  // sub-category of this category.
  if (subCategory.category_id !== category.id) return null;

  return {
    kind: "sub-category",
    categoryId: category.id,
    subCategoryId: subCategory.id,
    title: `${category.name} — ${subCategory.name}`,
  };
}

/**
 * Product rows for a resolved scope.
 *
 * A failing query is never swallowed: the missing-`color` case (the 004
 * migration has not been applied yet) is retried without that column, and any
 * other failure is logged and rethrown so the error boundary shows. A query
 * that succeeds with zero rows returns an empty array.
 */
async function selectProductRows(
  supabase: SupabaseClient,
  scope: ResolvedScope,
): Promise<ProductRow[]> {
  // A sub-category listing is scoped by sub_category_id; a top-level one
  // (Bag's / Jewellery) by category_id.
  const baseQuery = () => supabase.from("products").select(PRODUCT_COLUMNS);

  const withColor = await (scope.kind === "sub-category"
    ? baseQuery().eq("sub_category_id", scope.subCategoryId)
    : baseQuery().eq("category_id", scope.categoryId)
  )
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (!withColor.error) return withColor.data ?? [];

  if (!isMissingColorColumnError(withColor.error)) {
    logQueryFailure(
      `products query failed for ${scope.title}.`,
      withColor.error,
    );
    throw withColor.error;
  }

  const baseQueryWithoutColor = () =>
    supabase.from("products").select(PRODUCT_COLUMNS_WITHOUT_COLOR);

  const withoutColor = await (scope.kind === "sub-category"
    ? baseQueryWithoutColor().eq("sub_category_id", scope.subCategoryId)
    : baseQueryWithoutColor().eq("category_id", scope.categoryId)
  )
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (withoutColor.error) {
    logQueryFailure(
      "the products query without the color column failed too; apply supabase/migrations/004_add_product_color.sql.",
      withoutColor.error,
    );
    throw withoutColor.error;
  }

  console.warn(
    "[product-data] products.color is missing; apply supabase/migrations/004_add_product_color.sql to enable colour filters.",
  );

  return (withoutColor.data ?? []).map((row) => ({ ...row, color: null }));
}

/**
 * PostgREST reports an unknown column as `42703` (SQLSTATE undefined_column) or
 * `PGRST204` when the column is missing from its schema cache.
 *
 * Both optional product colour columns — `color` (004) and `image_colors`
 * (017) — contain "color", so the same check covers either one, and the loader
 * below simply drops them one at a time.
 */
function isMissingColorColumnError(error: { code?: string; message?: string }) {
  if (error.code === "42703" || error.code === "PGRST204") return true;

  const message = error.message ?? "";
  return /color/i.test(message) && /(column|does not exist|not found)/i.test(message);
}

async function loadProductListing(
  scope: ListingScope,
): Promise<ProductListingData | null> {
  try {
    const supabase = createPublicClient();

    const resolvedScope = await resolveScope(
      supabase,
      scope.categorySlug,
      scope.subCategorySlug,
    );
    if (!resolvedScope) return null;

    const rows = await selectProductRows(supabase, resolvedScope);

    return {
      title: resolvedScope.title,
      items: rows.map(fromDatabaseRow),
    };
  } catch (error) {
    logQueryFailure(
      `listing query failed for ${scope.categorySlug}${
        scope.subCategorySlug ? `/${scope.subCategorySlug}` : ""
      }.`,
      error,
    );
    throw error;
  }
}

type ProductDetailRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  discount_price: number | null;
  sizes: string | null;
  /** Absent when migration 004 has not been applied yet. */
  color?: string | null;
  images: string[] | null;
  /** Absent when migration 017 has not been applied yet. */
  image_colors?: string[] | null;
  created_at: string;
  category: unknown;
  sub_category: unknown;
};

/**
 * The embedded `categories` / `sub_categories` rows are typed `unknown` on
 * purpose: without generated Supabase types the client infers an embedded
 * relation it cannot describe (a branded string) even though PostgREST resolves
 * it fine from the foreign keys. {@link toCategoryLink} therefore validates the
 * embedded row at runtime.
 */
function toCategoryLink(value: unknown): { slug: string; name: string } | null {
  if (!value || typeof value !== "object") return null;

  const row = value as { slug?: unknown; name?: unknown };
  if (typeof row.slug !== "string" || typeof row.name !== "string") return null;

  return { slug: row.slug, name: row.name };
}

function fromDatabaseDetailRow(row: ProductDetailRow): ProductDetail {
  // URLs and their colour tags are paired in one pass, so the tags can never
  // shift onto a neighbouring image — a NULL or short `image_colors` simply
  // reads as "" for the entries it does not cover.
  const gallery = pairImagesWithColors(row.images, row.image_colors);

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description ?? null,
    price: Number(row.price),
    discountPrice: row.discount_price === null ? null : Number(row.discount_price),
    sizes: parseOptionList(row.sizes),
    colors: parseOptionList(row.color),
    images: gallery.map((entry) => entry.url),
    imageColors: gallery.map((entry) => entry.color),
    createdAt: row.created_at,
    category: toCategoryLink(row.category),
    subCategory: toCategoryLink(row.sub_category),
  };
}

async function loadProductBySlug(slug: string): Promise<ProductDetail | null> {
  try {
    const supabase = createPublicClient();

    // Three column shapes, because both colour columns are optional: `color`
    // (migration 004) and `image_colors` (migration 017) may each not exist
    // yet. Only an unknown-column failure falls through to the next shape;
    // any other failure is logged and rethrown, so a real error is never
    // hidden behind a fallback.
    const withBoth = await supabase
      .from("products")
      .select(
        "id, name, slug, description, price, discount_price, sizes, color, images, image_colors, created_at, category:categories(id, slug, name), sub_category:sub_categories(id, slug, name)",
      )
      .eq("slug", slug)
      .eq("is_active", true)
      .maybeSingle();

    if (!withBoth.error) {
      return withBoth.data ? fromDatabaseDetailRow(withBoth.data) : null;
    }

    if (!isMissingColorColumnError(withBoth.error)) {
      logQueryFailure(`product detail query failed for "${slug}".`, withBoth.error);
      throw withBoth.error;
    }

    const withColor = await supabase
      .from("products")
      .select(
        "id, name, slug, description, price, discount_price, sizes, color, images, created_at, category:categories(id, slug, name), sub_category:sub_categories(id, slug, name)",
      )
      .eq("slug", slug)
      .eq("is_active", true)
      .maybeSingle();

    if (!withColor.error) {
      console.warn(
        "[product-data] products.image_colors is missing; apply supabase/migrations/017_product_image_color.sql to enable colour-to-image jumps.",
      );
      return withColor.data ? fromDatabaseDetailRow(withColor.data) : null;
    }

    if (!isMissingColorColumnError(withColor.error)) {
      logQueryFailure(`product detail query failed for "${slug}".`, withColor.error);
      throw withColor.error;
    }

    const withoutColor = await supabase
      .from("products")
      .select(
        "id, name, slug, description, price, discount_price, sizes, images, created_at, category:categories(id, slug, name), sub_category:sub_categories(id, slug, name)",
      )
      .eq("slug", slug)
      .eq("is_active", true)
      .maybeSingle();

    if (withoutColor.error) {
      logQueryFailure(
        `product detail query failed for "${slug}"; apply supabase/migrations/004_add_product_color.sql and 017_product_image_color.sql.`,
        withoutColor.error,
      );
      throw withoutColor.error;
    }

    console.warn(
      "[product-data] products.color and products.image_colors are missing; apply supabase/migrations/004_add_product_color.sql and 017_product_image_color.sql.",
    );

    return withoutColor.data ? fromDatabaseDetailRow(withoutColor.data) : null;
  } catch (error) {
    logQueryFailure(`product detail fetch threw for "${slug}".`, error);
    throw error;
  }
}

/**
 * Products for one listing route, cached and de-duplicated per request.
 *
 * A sub-category slug lists only that sub-category; without one the whole
 * top-level category is listed, which is what Bag's and Jewellery use since
 * they skip the sub-category page.
 *
 * Two layers, both deliberate:
 *  - `cache()` from React so `generateMetadata` and the page share one lookup
 *    within a single request instead of each paying for it;
 *  - `unstable_cache` so the result is reused across requests until an admin
 *    write invalidates it through `CACHE_TAGS.products` / `CACHE_TAGS.category`
 *    / `CACHE_TAGS.subCategory` (see `lib/admin/revalidate.ts`).
 */
const getProductListingCached = cache(
  (categorySlug: string, subCategorySlug: string) =>
    unstable_cache(
      () =>
        loadProductListing({
          categorySlug,
          subCategorySlug: subCategorySlug || undefined,
        }),
      ["product-listing", categorySlug, subCategorySlug],
      {
        tags: [
          CACHE_TAGS.products,
          CACHE_TAGS.category(categorySlug),
          ...(subCategorySlug
            ? [CACHE_TAGS.subCategory(categorySlug, subCategorySlug)]
            : []),
        ],
        revalidate: DEFAULT_PUBLIC_REVALIDATE,
      },
    )(),
);

export function getProductListing(
  scope: ListingScope,
): Promise<ProductListingData | null> {
  return getProductListingCached(scope.categorySlug, scope.subCategorySlug ?? "");
}

/**
 * One product for the detail page / quick view / checkout, cached the same way.
 * Returns `null` for a missing slug, so the route 404s instead of showing
 * fabricated data. A failing query is logged and rethrown so the error boundary
 * shows.
 */
const getProductBySlugCached = cache((slug: string) =>
  unstable_cache(() => loadProductBySlug(slug), ["product-by-slug", slug], {
    tags: [CACHE_TAGS.products, CACHE_TAGS.product(slug)],
    revalidate: DEFAULT_PUBLIC_REVALIDATE,
  })(),
);

export function getProductBySlug(slug: string): Promise<ProductDetail | null> {
  return getProductBySlugCached(slug);
}

/**
 * Every active product slug, for `generateStaticParams`.
 *
 * Read straight from the database - not through `unstable_cache` - because it
 * only runs while the build resolves the route's params, and it must see the
 * catalogue as it is right now. Throws on purpose: the caller wraps it in a
 * try/catch so a database hiccup can never fail the build on its own.
 */
export async function getAllProductSlugs(): Promise<string[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("products")
    .select("slug")
    .eq("is_active", true)
    .order("slug", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) => row.slug);
}

export type { ProductListingData, ProductListItem } from "@/lib/products";
