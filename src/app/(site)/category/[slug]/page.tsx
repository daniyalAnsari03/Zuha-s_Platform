import type { Metadata } from "next";
import { notFound } from "next/navigation";

import ProductListing from "@/components/products/ProductListing";
import SubCategoryCarousel from "@/components/category/SubCategoryCarousel";
import { getAllCategorySlugs, getCategoryPageData } from "@/lib/category-data";

type PageProps = {
  params: Promise<{ slug: string }>;
};

/**
 * Static / ISR instead of dynamic: every active category is prerendered at
 * build time and refreshed every five minutes, which is the same window
 * `DEFAULT_PUBLIC_REVALIDATE` uses for the readers behind this page. The
 * segment config must be statically analyzable, so the literal is repeated
 * here rather than imported from `lib/cache-tags.ts`.
 *
 * `dynamicParams` stays at its default (`true`): a category added in the
 * dashboard afterwards renders on first visit and is cached from then on, and
 * an admin write still revalidates the whole template through
 * `revalidateStorefront()`.
 */
export const revalidate = 300;

/**
 * Returns `[]` if the catalogue cannot be read: `dynamicParams` renders those
 * paths on first visit, so a database hiccup must never fail the build here.
 */
export async function generateStaticParams() {
  try {
    const slugs = await getAllCategorySlugs();
    return slugs.map((slug) => ({ slug }));
  } catch (error) {
    console.error("[category] generateStaticParams could not read categories.", error);
    return [];
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await getCategoryPageData(slug);

  if (!data) return { title: "Category not found — ZUHA'S" };

  return {
    title: `${data.categoryName} — ZUHA'S`,
    description: `Shop ${data.categoryName} at ZUHA'S.`,
  };
}

export default async function CategoryPage({ params }: PageProps) {
  const { slug } = await params;
  const data = await getCategoryPageData(slug);

  if (!data) notFound();

  const hasSubCategories = data.subCategories.length > 0;

  // The navbar, the page spacing and the normal footer all come from the
  // shared `(site)` layout.
  //
  // Categories with sub-categories show the Phase 3 carousel; Bag's and
  // Jewellery skip it and go straight to the product listing grid.
  return hasSubCategories ? (
    <SubCategoryCarousel
      categoryName={data.categoryName}
      categorySlug={data.categorySlug}
      subCategories={data.subCategories}
    />
  ) : (
    <ProductListing categorySlug={data.categorySlug} />
  );
}