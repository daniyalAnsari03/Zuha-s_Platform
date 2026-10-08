"use client";

import Link from "next/link";

import CircleCarousel, {
  CIRCLE_CARD_ACTION_CLASS,
  CIRCLE_CARD_IMAGE_SIZES,
  CircleCard,
} from "@/components/ui/CircleCarousel";
import type { SubCategorySlide } from "@/lib/category-data";
import { CONTENT_CONTAINER } from "@/lib/content-container";

type SubCategoryCarouselProps = {
  categoryName: string;
  categorySlug: string;
  subCategories: SubCategorySlide[];
};

/**
 * The sub-category page: a horizontal row of circular cards, one per
 * sub-category, opening that sub-category's product listing when tapped.
 *
 * The carousel mechanics and the circle + name card are shared with the Team
 * page (see `components/ui/CircleCarousel`); this file only decides what a card
 * does.
 */
export default function SubCategoryCarousel({
  categoryName,
  categorySlug,
  subCategories,
}: SubCategoryCarouselProps) {
  return (
    <CircleCarousel
      ariaLabel={`${categoryName} sub-categories`}
      trackId="sub-category-track"
      className={CONTENT_CONTAINER}
      headingId="sub-category-heading"
      heading={
        <h1
          id="sub-category-heading"
          className="mb-8 text-center font-serif text-2xl tracking-[0.1em] sm:mb-10 sm:text-3xl md:text-4xl"
        >
          {categoryName}
        </h1>
      }
      items={subCategories}
      renderAction={(subCategory) => (
        <Link
          href={`/category/${categorySlug}/${subCategory.slug}`}
          className={CIRCLE_CARD_ACTION_CLASS}
        >
          <CircleCard
            name={subCategory.name}
            imageUrl={subCategory.imageUrl}
            sizes={CIRCLE_CARD_IMAGE_SIZES}
          />
        </Link>
      )}
    />
  );
}