import type { Metadata } from "next";

import ProductListing from "@/components/products/ProductListing";
import { getAllSubCategoryParams } from "@/lib/category-data";
import { getProductListing } from "@/lib/product-data";

type PageProps = {
  params: Promise<{ slug: string; subSlug: string }>;
};

/**
 * Static / ISR instead of dynamic: every active (category, sub-category) pair
 * is prerendered at build and refreshed every five minutes, matching the
 * `DEFAULT_PUBLIC_REVALIDATE` window of the readers behind this page. Segment
 * config must be statically analyzable, so the value is the literal.
 *
 * `dynamicParams` stays at its default (`true`), so a sub-category added later
 * renders on first visit and is cached from then on.
 */
export const revalidate = 300;

/**
 * Returns `[]` if the catalogue cannot be read: `dynamicParams` renders those
 * paths on first visit, so a database hiccup must never fail the build here.
 */
export async function generateStaticParams() {
  try {
    return await getAllSubCategoryParams();
  } catch (error) {
    console.error(
      "[sub-category] generateStaticParams could not read sub-categories.",
      error,
    );
    return [];
  }
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug, subSlug } = await params;
  const listing = await getProductListing({ categorySlug: slug, subCategorySlug: subSlug });

  if (!listing) return { title: "Not found — ZUHA'S" };

  return {
    title: `${listing.title} — ZUHA'S`,
    description: `Shop ${listing.title} at ZUHA'S.`,
  };
}

export default async function SubCategoryPage({ params }: PageProps) {
  const { slug, subSlug } = await params;

  // `ProductListing` 404s when the sub-category does not exist.
  return <ProductListing categorySlug={slug} subCategorySlug={subSlug} />;
}