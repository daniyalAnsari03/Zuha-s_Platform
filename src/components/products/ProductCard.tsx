"use client";

import Link from "next/link";
import { useMemo } from "react";

import { useCart } from "@/components/cart/CartProvider";
import Price from "@/components/currency/Price";
import { EyeIcon, HeartIcon } from "@/components/icons";
import FadeInImage from "@/components/ui/FadeInImage";
import PopOnChange from "@/components/ui/PopOnChange";
import { type ProductDetailData } from "@/components/products/ProductDetailContent";
import { useQuickView } from "@/components/products/ProductQuickViewProvider";
import { useWishlist } from "@/components/wishlist/WishlistProvider";
import {
  discountPercent,
  effectivePrice,
  type ProductListItem,
} from "@/lib/products";
import { IMAGE_QUALITY } from "@/lib/images";
import { cn } from "@/lib/utils";

/**
 * Cards are portrait; this keeps the image box consistent at every breakpoint.
 *
 * One `sizes` per breakpoint, and each step matches the real grid: 2 columns
 * below md, 3 from md, 4 from lg. The old 22vw desktop step asked for a
 * smaller file than the card actually renders (25vw), which is how a listing
 * ends up serving a soft image on a normal desktop window.
 */
const IMAGE_SIZES =
  "(max-width: 767px) 50vw, (max-width: 1023px) 34vw, 25vw";

const HOVER_ICON_BUTTON =
  "flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-black transition-colors hover:text-plum focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum";

const REVEAL_ICON_BUTTON = "reveal:h-11 reveal:w-11 reveal:bg-transparent";
const REVEAL_ICON_CIRCLE =
  "contents h-[34px] w-[34px] items-center justify-center rounded-full bg-white/95 shadow-sm reveal:flex";

type ProductCardProps = {
  product: ProductListItem;
  /**
   * The first card of a listing is the page's LCP candidate, so the grid
   * marks it priority; every other card stays lazy.
   */
  priority?: boolean;
};

/**
 * Listing card: a tall 2:3 portrait image, then the name and the price.
 *
 * Square throughout - no rounded corners, borders or shadows anywhere on the
 * card, the image or the discount badge (the only exception is the round
 * reveal-mode icon buttons described below).
 *
 * On a 1024px+ window with a mouse the card reveals the wishlist (heart) and
 * quick-view (eye) buttons plus an "Add to Cart" bar on hover. Below lg, or on
 * any device that reports `hover: none`, there is no hover to wait for, so the
 * same controls are simply left on screen - circular icon buttons top-right,
 * edge-to-edge bar along the bottom. A product the admin gave sizes to has no
 * default size, so its "Add to Cart" opens the quick view to pick one;
 * everything else goes straight into the cart.
 *
 * Clicking the card opens the product detail page (Phase 5). The hover controls
 * sit above the card link so they never navigate.
 */
export default function ProductCard({ product, priority = false }: ProductCardProps) {
  const { openQuickView } = useQuickView();
  const { isSaved, toggle } = useWishlist();
  const { addItem } = useCart();
  const percent = discountPercent(product);
  const isDiscounted = percent !== null;
  const saved = isSaved(product.id);

  const detailData = useMemo<ProductDetailData>(
    () => ({
      id: product.id,
      name: product.name,
      slug: product.slug,
      description: null,
      price: product.price,
      discountPrice: product.discountPrice,
      sizes: product.sizes,
      colors: product.colors,
      images: product.imageUrl ? [product.imageUrl] : [],
      imageColors: [],
      createdAt: product.createdAt,
      category: null,
      subCategory: null,
    }),
    [product],
  );

  return (
    <article className="group/card relative flex flex-col">
      <div className="relative bg-black/5">
        <div className="relative aspect-[2/3] w-full overflow-hidden">
          {product.imageUrl ? (
            <FadeInImage
              src={product.imageUrl}
              alt={product.name}
              sizes={IMAGE_SIZES}
              quality={IMAGE_QUALITY}
              priority={priority}
              wrapperClassName="card-first"
              className="object-cover"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-xs tracking-[0.2em] text-black/30 uppercase">
              No image
            </span>
          )}

          {/*
           * Second gallery image, stacked over the first. CSS (see globals.css)
           * only shows it on a device that truly hovers with a fine pointer, so
           * on touch it is removed and only the first image exists. It is lazy,
           * so the browser fetches it as the card approaches the viewport and
           * the first hover is instant.
           */}
          {product.secondImageUrl ? (
            <FadeInImage
              src={product.secondImageUrl}
              alt=""
              sizes={IMAGE_SIZES}
              quality={IMAGE_QUALITY}
              loading="lazy"
              wrapperClassName="card-hover-second"
              className="object-cover"
            />
          ) : null}
        </div>

        {isDiscounted ? (
          <span className="pointer-events-none absolute top-0 left-0 z-20 bg-plum px-2.5 py-1 text-[11px] font-medium tracking-[0.06em] text-white uppercase">
            {percent}% OFF
          </span>
        ) : null}

        {/*
         * Hover row: on a 1024px+ window with a mouse it is still revealed by
         * hover alone (each icon fades in with a short slide, staggered - see
         * `.card-icon-reveal` in globals.css). Everywhere else - anything below
         * lg, or any device that reports hover: none - it is simply left on
         * screen. The container only manages layout and pointer-events; each
         * button carries its own reveal state.
         */}
        <div
          className={cn(
            "absolute top-2.5 right-2.5 z-20 hidden flex-col gap-2.5 md:flex reveal:flex reveal:top-2 reveal:right-2 reveal:gap-2",
            "pointer-events-none",
            "group-hover/card:pointer-events-auto",
            "group-focus-within/card:pointer-events-auto",
            "reveal:pointer-events-auto",
          )}
        >
          <button
            type="button"
            aria-label={
              saved
                ? `Remove ${product.name} from wishlist`
                : `Add ${product.name} to wishlist`
            }
            aria-pressed={saved}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              toggle(product.id);
            }}
            className={cn(HOVER_ICON_BUTTON, REVEAL_ICON_BUTTON, "card-icon-reveal")}
          >
            <span className={REVEAL_ICON_CIRCLE}>
              <PopOnChange trigger={saved} enabled={saved} from={0.7}>
                <HeartIcon
                  fill={saved ? "currentColor" : "none"}
                  className={cn(
                    "h-[18px] w-[18px] lg:h-[22px] lg:w-[22px]",
                    saved && "text-plum",
                  )}
                />
              </PopOnChange>
            </span>
          </button>

          <button
            type="button"
            aria-label={`Quick view ${product.name}`}
            className={cn(HOVER_ICON_BUTTON, REVEAL_ICON_BUTTON, "card-icon-reveal")}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              openQuickView(detailData);
            }}
          >
            <span className={REVEAL_ICON_CIRCLE}>
              <EyeIcon className="h-[18px] w-[18px] lg:h-[22px] lg:w-[22px]" />
            </span>
          </button>
        </div>

        {/*
         * "Add to Cart" bar: on a 1024px+ window with a mouse it slides up
         * from below the image on hover (see `.card-add-to-cart-reveal` in
         * globals.css). Below lg, or on any hover: none device, it simply stays
         * put, running edge to edge.
         */}
        <div
          className={cn(
            "absolute inset-x-0 bottom-0 z-20 hidden translate-y-full opacity-0 md:block reveal:block",
            "card-add-to-cart-reveal",
            "pointer-events-none",
            "group-hover/card:translate-y-0 group-hover/card:opacity-100",
            "group-focus-within/card:translate-y-0 group-focus-within/card:opacity-100",
            "group-hover/card:pointer-events-auto",
            "group-focus-within/card:pointer-events-auto",
            "reveal:translate-y-0 reveal:opacity-100 reveal:pointer-events-auto",
          )}
        >
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();

              // Sizes and colours are free text with no sensible default, so a
              // product that has either is added through the quick view instead.
              if (product.sizes.length > 0 || product.colors.length > 0) {
                openQuickView(detailData);
                return;
              }

              addItem({
                productId: product.id,
                name: product.name,
                image: product.imageUrl,
                price: effectivePrice(product),
                size: null,
                color: null,
              });
            }}
            className={cn(
              "min-h-10 w-full bg-plum px-4 py-2.5 text-sm font-medium text-white",
              "reveal:min-h-11 reveal:py-2.5",
              "transition-colors hover:bg-plum-dark",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum",
            )}
          >
            Add to Cart
          </button>
        </div>

        {/* Stretched link: makes the whole image clickable, sits under the controls. */}
        <Link
          href={`/product/${product.slug}`}
          className="absolute inset-0 z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum"
        >
          <span className="sr-only">{product.name}</span>
        </Link>
      </div>

      <div className="mt-3 sm:mt-4">
        <h3 className="text-sm leading-snug sm:text-base">{product.name}</h3>

        <p className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          {isDiscounted ? (
            <>
              <Price
                amount={product.price}
                className="text-sm text-black/40 line-through sm:text-base"
              />
              <Price
                amount={product.discountPrice ?? product.price}
                className="text-sm font-medium text-plum sm:text-base"
              />
            </>
          ) : (
            <Price
              amount={product.price}
              className="text-sm sm:text-base"
            />
          )}
        </p>
      </div>
    </article>
  );
}