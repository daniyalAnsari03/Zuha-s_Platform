"use client";

import Link from "next/link";

import CardRowCarousel, {
  CARD_ROW_ACTION_CLASS,
  CardRowName,
  SUB_CATEGORY_CARD_WIDTH,
  SUB_CATEGORY_IMAGE_SIZES,
} from "@/components/ui/CardRowCarousel";
import FadeInImage from "@/components/ui/FadeInImage";
import { IMAGE_QUALITY, isVectorImage } from "@/lib/images";
import type { SubCategorySlide } from "@/lib/category-data";
import { CONTENT_CONTAINER } from "@/lib/content-container";

type SubCategoryCarouselProps = {
  categoryName: string;
  categorySlug: string;
  subCategories: SubCategorySlide[];
};

/**
 * The sub-category page: a flat horizontal row of product-style cards - a
 * portrait image with square corners and the sub-category name underneath,
 * nothing else. Every card is the same size; there is no 3D tilt, no fading
 * and no enlarged middle card.
 *
 * Tapping a card opens that sub-category's product listing. The row mechanics
 * and the entrance animation are shared with the Team page (see
 * `components/ui/CardRowCarousel`); this file only decides the card look and
 * where a card links to.
 */
export default function SubCategoryCarousel({
  categoryName,
  categorySlug,
  subCategories,
}: SubCategoryCarouselProps) {
  return (
    <CardRowCarousel
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
      cardWidthClassName={SUB_CATEGORY_CARD_WIDTH}
      renderAction={(subCategory) => (
        <Link
          href={`/category/${categorySlug}/${subCategory.slug}`}
          className={CARD_ROW_ACTION_CLASS}
        >
          <span className="relative block aspect-[3/4] w-full overflow-hidden bg-black/5">
            <FadeInImage
              src={subCategory.imageUrl}
              alt=""
              sizes={SUB_CATEGORY_IMAGE_SIZES}
              quality={IMAGE_QUALITY}
              unoptimized={isVectorImage(subCategory.imageUrl)}
              className="object-cover"
            />
          </span>
          <CardRowName name={subCategory.name} />
        </Link>
      )}
    />
  );
}
