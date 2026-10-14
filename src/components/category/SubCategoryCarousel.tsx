"use client";

import CoverflowCarousel from "@/components/ui/CoverflowCarousel";
import type { SubCategorySlide } from "@/lib/category-data";
import { CONTENT_CONTAINER } from "@/lib/content-container";

type SubCategoryCarouselProps = {
  categoryName: string;
  categorySlug: string;
  subCategories: SubCategorySlide[];
};

/**
 * The sub-category page: a 3D coverflow of portrait cards, one per
 * sub-category. Activating the centred card opens that sub-category's product
 * listing; tapping a side card just brings it to the centre.
 *
 * The coverflow mechanics and the image + name card are shared with the Team
 * page (see `components/ui/CoverflowCarousel`); this file only decides where a
 * card links to.
 */
export default function SubCategoryCarousel({
  categoryName,
  categorySlug,
  subCategories,
}: SubCategoryCarouselProps) {
  return (
    <CoverflowCarousel
      ariaLabel={`${categoryName} sub-categories`}
      headingId="sub-category-heading"
      className={CONTENT_CONTAINER}
      heading={
        <h1
          id="sub-category-heading"
          className="mb-8 text-center font-serif text-2xl tracking-[0.1em] sm:mb-10 sm:text-3xl md:text-4xl"
        >
          {categoryName}
        </h1>
      }
      items={subCategories}
      getHref={(subCategory) =>
        `/category/${categorySlug}/${subCategory.slug}`
      }
    />
  );
}
