import { notFound } from "next/navigation";

import Breadcrumb from "@/components/layout/Breadcrumb";
import ProductGrid from "@/components/products/ProductGrid";
import { getCategoryPageData } from "@/lib/category-data";
import { CONTENT_CONTAINER } from "@/lib/content-container";
import { getProductListing } from "@/lib/product-data";

type ProductListingProps = {
  categorySlug: string;
  /** Present for a sub-category listing, absent for a top-level one. */
  subCategorySlug?: string;
};

/**
 * Product listing for one route: breadcrumb, filter/sort toolbar and the grid.
 *
 * Server component so Supabase is queried on the server; only the filter and
 * sort interactions need to be client-side, which `ProductGrid` owns.
 *
 * Layout, top to bottom:
 *   1. Breadcrumb - HOME > CATEGORY > SUB-CATEGORY (the last crumb is plain
 *      text). Bag's / Jewellery stop after the category.
 *   2. The toolbar row, rendered by `ProductGrid`.
 *   3. The full-width product grid.
 *
 * There is no big page heading; the listing title is kept for screen readers
 * and for the route metadata.
 */
export default async function ProductListing({
  categorySlug,
  subCategorySlug,
}: ProductListingProps) {
  // The two reads are independent — one resolves the product rows, the other
  // the category names the breadcrumb needs — so they are issued together.
  const [listing, category] = await Promise.all([
    getProductListing({ categorySlug, subCategorySlug }),
    getCategoryPageData(categorySlug),
  ]);
  if (!listing) notFound();

  const [titleCategory, titleSubCategory] = splitListingTitle(listing.title);

  // The breadcrumb needs the two names separately. They come from the same
  // category/sub-category lookup the sub-category page already uses; the
  // listing title is the fallback when that lookup comes back empty.
  const categoryName = category?.categoryName ?? titleCategory;
  const subCategoryName = subCategorySlug
    ? (category?.subCategories.find((row) => row.slug === subCategorySlug)
        ?.name ??
      titleSubCategory ??
      subCategorySlug)
    : null;

  return (
    <section className={CONTENT_CONTAINER}>
      <h1 className="sr-only">{listing.title}</h1>

      <Breadcrumb
        items={[
          { label: "Home", href: "/" },
          { label: categoryName, href: `/category/${categorySlug}` },
          ...(subCategoryName ? [{ label: subCategoryName }] : []),
        ]}
      />

      <div className="mt-6 lg:mt-8">
        {listing.items.length === 0 ? (
          <p className="py-16 text-center text-sm text-black/50">
            No products in this category yet.
          </p>
        ) : (
          <ProductGrid products={listing.items} />
        )}
      </div>
    </section>
  );
}

/**
 * `title` is "Category — Sub-category" for a sub-category listing and just the
 * category name for a top-level one, so it splits cleanly on that separator.
 */
function splitListingTitle(title: string): [string, string?] {
  const separator = title.indexOf(" — ");

  if (separator === -1) return [title];

  return [title.slice(0, separator), title.slice(separator + 3)];
}