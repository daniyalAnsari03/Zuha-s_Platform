import "server-only";

import { revalidatePath, revalidateTag } from "next/cache";

import { CACHE_TAGS } from "@/lib/cache-tags";

/**
 * Next 16 requires a second argument on every `revalidateTag` call, and the
 * profile that is passed decides how quickly the cache notices.
 *
 * `{ expire: 0 }` expires the tag's entries at once and marks the action's own
 * page as revalidated - which is exactly what the old single-argument call did,
 * and what "the admin edits, the storefront shows it" needs. The `"max"` profile
 * would only mark the entries stale and leave a background revalidation to catch
 * up, so a customer could keep seeing the previous catalogue for a while.
 *
 * Exported for the admin actions that invalidate a single area (Team, Settings)
 * instead of the whole storefront.
 */
export function expireCacheTag(tag: string): void {
  revalidateTag(tag, { expire: 0 });
}

/**
 * Clears every cached read and rendered path the storefront uses.
 *
 * Call it from an admin action after the database write has succeeded. The
 * `affected` lists add the per-slug paths and tags so a single product or
 * category can also be invalidated by name; the broad tags below are cleared
 * every time, because an admin write can change what a listing, the menu, the
 * homepage slider or the footer shows even when no slug moved.
 *
 * Template paths carry an explicit `"page"` type: without it `revalidatePath`
 * warns and matches no implicit tag, so nothing would actually be invalidated.
 */
export function revalidateStorefront(affected: {
  categorySlugs?: readonly string[];
  subCategories?: readonly { categorySlug: string; subSlug: string }[];
  productSlugs?: readonly string[];
}): void {
  revalidatePath("/");
  revalidatePath("/contact");
  revalidatePath("/category/[slug]", "page");
  revalidatePath("/category/[slug]/[subSlug]", "page");
  revalidatePath("/product/[slug]", "page");
  revalidatePath("/team");

  for (const slug of affected.categorySlugs ?? []) {
    revalidatePath(`/category/${slug}`);
    expireCacheTag(CACHE_TAGS.category(slug));
  }

  for (const { categorySlug, subSlug } of affected.subCategories ?? []) {
    revalidatePath(`/category/${categorySlug}/${subSlug}`);
    expireCacheTag(CACHE_TAGS.subCategory(categorySlug, subSlug));
  }

  for (const slug of affected.productSlugs ?? []) {
    revalidatePath(`/product/${slug}`);
    expireCacheTag(CACHE_TAGS.product(slug));
  }

  expireCacheTag(CACHE_TAGS.categories);
  expireCacheTag(CACHE_TAGS.subCategories);
  expireCacheTag(CACHE_TAGS.products);
  expireCacheTag(CACHE_TAGS.menu);
  expireCacheTag(CACHE_TAGS.home);
  expireCacheTag(CACHE_TAGS.announcements);
  expireCacheTag(CACHE_TAGS.team);
  expireCacheTag(CACHE_TAGS.storeDetails);
}
