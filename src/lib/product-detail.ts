import { cache } from "react";

import type { ProductDetailData } from "@/components/products/ProductDetailContent";
import { getProductBySlug, type ProductDetail } from "@/lib/product-data";

export function mapProductDetailToData(product: ProductDetail): ProductDetailData {
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    price: product.price,
    discountPrice: product.discountPrice,
    sizes: product.sizes,
    colors: product.colors,
    images: product.images.length > 0 ? product.images : [],
    createdAt: product.createdAt,
    category: product.category
      ? {
          slug: product.category.slug,
          name: product.category.name,
        }
      : null,
    subCategory: product.subCategory
      ? {
          slug: product.subCategory.slug,
          name: product.subCategory.name,
        }
      : null,
  };
}

/**
 * Deliberately request-scoped: `generateMetadata` and the page both resolve the
 * same slug, so React dedupes the second call instead of mapping the row twice.
 */
export const getProductDetailData = cache(async (slug: string) => {
  const product = await getProductBySlug(slug);
  if (!product) return null;
  return mapProductDetailToData(product);
});
