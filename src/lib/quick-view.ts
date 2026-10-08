"use server";

import type { ProductDetailData } from "@/components/products/ProductDetailContent";
import { getProductDetailData } from "@/lib/product-detail";

/**
 * Full product for the quick view modal.
 *
 * The listing card passes only the first image and no description, so the modal
 * re-fetches the complete product from the same server data function the detail
 * page uses - one query, reused, never duplicated. The anon key reads through
 * the public RLS policy, exactly like every other storefront query.
 */
export async function getQuickViewProduct(
  slug: string,
): Promise<ProductDetailData | null> {
  return getProductDetailData(slug);
}