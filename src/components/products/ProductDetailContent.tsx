"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { useCart } from "@/components/cart/CartProvider";
import Price from "@/components/currency/Price";
import { CloseIcon, ExpandIcon, HeartIcon } from "@/components/icons";
import FormattedDescription from "@/components/products/FormattedDescription";
import FadeInImage from "@/components/ui/FadeInImage";
import PopOnChange from "@/components/ui/PopOnChange";
import { useWishlist } from "@/components/wishlist/WishlistProvider";
import { IMAGE_QUALITY } from "@/lib/images";
import {
  discountPercent,
  effectivePrice,
  pairImagesWithColors,
} from "@/lib/products";
import { cn } from "@/lib/utils";

/**
 * The full-screen zoom viewer only ever exists behind the Expand button, so it
 * is a separate chunk: it renders nothing until it is opened, and the gallery
 * on the page does not pay for it.
 */
const ProductImageViewer = dynamic(
  () => import("@/components/products/ProductImageViewer"),
  { ssr: false },
);

/**
 * From lg up the gallery is on the page at once: two across, each picture
 * either the full width of the screen or roughly half of the gallery column
 * (the gallery itself is 60% of the two-column layout), which is what these
 * breakpoints describe. 27vw is about the real cell width on a normal desktop
 * window, so the browser picks a candidate at or above the rendered size.
 */
const GALLERY_IMAGE_SIZES =
  "(max-width: 767px) 100vw, (max-width: 1023px) 45vw, (max-width: 1279px) 30vw, 27vw";

/** Below lg the same gallery is one swipeable slide at a time, not a grid. */
const SLIDER_IMAGE_SIZES = "(max-width: 767px) 100vw, 560px";

/** The grid only exists from lg up; below that the slider takes its place. */
const GALLERY_GRID = "hidden lg:grid lg:grid-cols-2 lg:gap-1.5";

/** One grid for the empty state, so it lines up with the real cells. */
const EMPTY_GALLERY_GRID = "grid grid-cols-1 gap-2 lg:grid-cols-2 lg:gap-1.5";

/** How tall the sticky details column is allowed to get before it scrolls. */
const DETAILS_MAX_HEIGHT = "lg:max-h-[calc(100dvh_-_2rem)]";

/**
 * Inside the modal the same column also has to clear the modal's own padding,
 * so it gets a slightly smaller ceiling than it does on the page.
 */
const DETAILS_MAX_HEIGHT_MODAL = "lg:max-h-[calc(100dvh_-_7rem)]";

/** How long the "Added to cart" confirmation stays up. */
const ADDED_FEEDBACK_MS = 2600;

/**
 * How a colour option and an image's colour tag are compared: trimmed,
 * case-insensitive, with runs of spaces collapsed, so " Ivory " and "ivory"
 * are the same colour.
 */
function normalizeColorTag(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export type ProductDetailData = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  discountPrice: number | null;
  sizes: string[];
  colors: string[];
  images: string[];
  /**
   * Optional per-image colour tag (migration 017), index-aligned with
   * `images`; "" means "no tag". Below lg, tapping a colour jumps the slider
   * to the first image whose tag matches.
   */
  imageColors: string[];
  createdAt: string;
  category: {
    slug: string;
    name: string;
  } | null;
  subCategory: {
    slug: string;
    name: string;
  } | null;
};

type ProductDetailContentProps = {
  product: ProductDetailData;
  onClose?: () => void;
  showCloseButton?: boolean;
  isModal?: boolean;
};

export default function ProductDetailContent({
  product,
  onClose,
  showCloseButton = false,
  isModal = false,
}: ProductDetailContentProps) {
  const router = useRouter();
  const { addItem } = useCart();
  const { isSaved, toggle } = useWishlist();
  const addedTimerRef = useRef<number | undefined>(undefined);

  const [quantity, setQuantity] = useState(1);
  // Null until the customer picks: a product with sizes (or colours) has no
  // sensible default, so "Add to Cart" asks for one instead of guessing.
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [sizeError, setSizeError] = useState(false);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [colorError, setColorError] = useState(false);
  const [added, setAdded] = useState(false);
  const [productId, setProductId] = useState(product.id);
  // Which slide the swipeable gallery is on, and whether it is blown up.
  const [slideIndex, setSlideIndex] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);
  const sliderRef = useRef<HTMLDivElement>(null);
  const expandButtonRef = useRef<HTMLButtonElement>(null);

  /*
   * One component serves both the quick view and the detail page, and either can
   * be handed a different product without unmounting. Resetting the selections
   * while rendering (React's documented "adjust state when a prop changes"
   * pattern) beats an effect here: the new product is rendered with its own
   * gallery, quantity 1 and no size, in the same paint.
   */
  if (productId !== product.id) {
    setProductId(product.id);
    setQuantity(1);
    setSelectedSize(null);
    setSizeError(false);
    setSelectedColor(null);
    setColorError(false);
    setAdded(false);
    setSlideIndex(0);
    setViewerOpen(false);
  }

  // Clear the transient "Added to cart" timer when this instance goes away.
  useEffect(() => {
    return () => {
      if (addedTimerRef.current !== undefined) {
        window.clearTimeout(addedTimerRef.current);
      }
    };
  }, []);

  // A new product starts on its first slide, wherever the last one left off.
  useEffect(() => {
    sliderRef.current?.scrollTo({ left: 0 });
  }, [product.id]);

  /**
   * The gallery as (image, colour tag) pairs — deduplicated in the original
   * order, each URL keeping its own tag so the two can never drift apart.
   * `images` below is the plain URL list the dashes, the viewer and the cart
   * already use.
   */
  const gallery = useMemo(() => {
    const seen = new Set<string>();

    return pairImagesWithColors(product.images, product.imageColors).filter(
      (item) => {
        if (seen.has(item.url)) return false;
        seen.add(item.url);
        return true;
      },
    );
  }, [product.images, product.imageColors]);

  const images = gallery.map((item) => item.url);

  const percent = discountPercent(product);
  const isDiscounted = percent !== null;
  const needsSize = product.sizes.length > 0;
  const needsColor = product.colors.length > 0;
  const saved = isSaved(product.id);

  /**
   * Every option the product offers has to be chosen before it can be bought.
   * Returns false and flags whichever of the two is missing, so the message
   * sits under the control the customer still has to use.
   */
  const selectionReady = () => {
    const missingSize = needsSize && selectedSize === null;
    const missingColor = needsColor && selectedColor === null;

    setSizeError(missingSize);
    setColorError(missingColor);

    return !missingSize && !missingColor;
  };

  const handleBuyNow = () => {
    // Checkout resolves the product from this slug on the server, so a product
    // the admin gave sizes or colours to has to arrive with one — same rule as
    // Add to Cart.
    if (!selectionReady()) return;

    const params = new URLSearchParams();
    params.set("product", product.slug);
    params.set("qty", quantity.toString());
    if (selectedSize) {
      params.set("size", selectedSize);
    }
    if (selectedColor) {
      params.set("color", selectedColor);
    }
    router.push(`/checkout?${params.toString()}`);
    onClose?.();
  };

  const handleAddToCart = () => {
    if (!selectionReady()) return;

    addItem({
      productId: product.id,
      name: product.name,
      image: images[0] ?? null,
      price: effectivePrice(product),
      size: selectedSize,
      color: selectedColor,
      quantity,
    });

    setAdded(true);
    if (addedTimerRef.current !== undefined) {
      window.clearTimeout(addedTimerRef.current);
    }
    addedTimerRef.current = window.setTimeout(() => {
      setAdded(false);
    }, ADDED_FEEDBACK_MS);
  };

  /**
   * Moves the gallery to a slide. The scroll container is the source of truth
   * while a finger is on it; this is for the dash indicators, the arrow keys
   * and the full-screen viewer, all of which land on the same slide.
   */
  const scrollToSlide = (target: number) => {
    const element = sliderRef.current;
    if (!element || element.clientWidth === 0) return;

    const clamped = Math.min(Math.max(target, 0), images.length - 1);
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    element.scrollTo({
      left: clamped * element.clientWidth,
      behavior: reduceMotion ? "auto" : "smooth",
    });
    setSlideIndex(clamped);
  };

  /**
   * Picking a colour also moves the gallery — but **only** below 1024px, where
   * the gallery is the swipe slider. It scrolls to the first image tagged with
   * that colour, using the same smooth scroll (and reduced-motion check) as the
   * dashes and the key handler. No image carries the colour: the slider stays
   * where it is and the colour is simply selected. From 1024px up the
   * two-column grid is on screen and the slider is `display: none`, so the
   * desktop layout never moves.
   */
  const selectColor = (color: string) => {
    setSelectedColor(color);
    setColorError(false);

    if (window.matchMedia("(min-width: 1024px)").matches) return;

    const wanted = normalizeColorTag(color);
    const target = gallery.findIndex(
      (item) => normalizeColorTag(item.color) === wanted,
    );

    if (target >= 0 && target !== slideIndex) scrollToSlide(target);
  };

  /** One swipe, one image: the index follows wherever the snap landed. */
  const handleSliderScroll = () => {
    const element = sliderRef.current;
    if (!element || element.clientWidth === 0) return;

    const next = Math.min(
      Math.max(Math.round(element.scrollLeft / element.clientWidth), 0),
      images.length - 1,
    );

    if (next !== slideIndex) setSlideIndex(next);
  };

  const handleSliderKeyDown = (
    event: React.KeyboardEvent<HTMLDivElement>,
  ) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      scrollToSlide(slideIndex + 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      scrollToSlide(slideIndex - 1);
    }
  };

  /** The viewer reports back; the slider has to end up on the same picture. */
  const handleViewerIndexChange = (nextIndex: number) => {
    setSlideIndex(nextIndex);

    const element = sliderRef.current;
    if (element) {
      element.scrollTo({ left: nextIndex * element.clientWidth });
    }
  };

  const closeViewer = () => {
    setViewerOpen(false);
    // The customer came from the expand button, so give it back their focus.
    expandButtonRef.current?.focus();
  };

  return (
    <div
      className={cn(
        // From lg up: gallery on the left (~60%), details on the right (~40%).
        // `items-start` keeps the details column from stretching to the
        // gallery's height, which is what lets it stick while the pictures
        // scroll past. Below lg the gallery becomes a slider and the details
        // simply sit underneath it.
        "flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-10",
        // In the quick view the modal is the scroll container, so the content
        // shrinks into it instead of making the page behind it scroll.
        isModal && "min-h-0 flex-1 overflow-y-auto",
      )}
    >
      {showCloseButton ? (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close quick view"
          className="absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center border border-black/10 bg-white/95 text-black transition-colors hover:text-plum focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum md:right-6 md:top-6"
        >
          <CloseIcon width={18} height={18} />
        </button>
      ) : null}

      {/*
       * Gallery. From lg up every image is on the page at once — two per row —
       * and the 3/4 box with `object-cover` only keeps the rows aligned;
       * nothing is stretched. Below lg the same pictures become a swipeable
       * slider instead.
       */}
      <div className="w-full min-w-0 lg:w-3/5">
        {images.length > 0 ? (
          <>
            <div className={GALLERY_GRID}>
              {images.map((imageUrl, index) => (
                <div
                  key={imageUrl}
                  className="relative aspect-[3/4] w-full overflow-hidden bg-black/5"
                >
                  <FadeInImage
                    src={imageUrl}
                    alt={
                      index === 0 ? product.name : `${product.name} ${index + 1}`
                    }
                    sizes={GALLERY_IMAGE_SIZES}
                    quality={IMAGE_QUALITY}
                    // Always lazy: only one of the two gallery variants is
                    // ever displayed (grid from lg, slider below it), and
                    // `loading="eager"` would download the hidden copy too -
                    // a second, differently-sized request for the same
                    // picture. An in-viewport lazy image still loads on the
                    // first layout; a display:none one never loads at all.
                    loading="lazy"
                    className="object-cover"
                  />

                  {isDiscounted && index === 0 ? (
                    <span className="pointer-events-none absolute left-0 top-0 bg-plum px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.06em] text-white">
                      {percent}% OFF
                    </span>
                  ) : null}
                </div>
              ))}
            </div>

            <div className="lg:hidden">
              <div className="relative mx-auto w-full md:max-w-[560px]">
                <div
                  ref={sliderRef}
                  onScroll={handleSliderScroll}
                  onKeyDown={handleSliderKeyDown}
                  tabIndex={images.length > 1 ? 0 : -1}
                  role="group"
                  aria-label={`${product.name} images`}
                  className="no-scrollbar flex w-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum"
                >
                  {images.map((imageUrl, index) => (
                    <div
                      key={imageUrl}
                      className="relative aspect-[3/4] w-full shrink-0 snap-start overflow-hidden bg-black/5 md:max-h-[75dvh]"
                    >
                      <FadeInImage
                        src={imageUrl}
                        alt={
                          index === 0
                            ? product.name
                            : `${product.name} ${index + 1}`
                        }
                        sizes={SLIDER_IMAGE_SIZES}
                        quality={IMAGE_QUALITY}
                        // Same rule as the grid above: one variant is hidden
                        // at any given width, so nothing may load eagerly.
                        loading="lazy"
                        className="object-cover"
                      />

                      {isDiscounted && index === 0 ? (
                        <span className="pointer-events-none absolute left-0 top-0 bg-plum px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.06em] text-white">
                          {percent}% OFF
                        </span>
                      ) : null}
                    </div>
                  ))}
                </div>

                {/* Dash strip over the picture: where you are, and a jump. */}
                {images.length > 1 ? (
                  <div className="absolute bottom-1 left-1 right-16 z-10 flex flex-wrap">
                    {images.map((_, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => scrollToSlide(index)}
                        aria-label={`Show image ${index + 1}`}
                        aria-current={index === slideIndex}
                        className="flex h-11 w-10 items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum"
                      >
                        <span
                          className={cn(
                            "h-[3px] w-6 rounded-full transition-colors",
                            index === slideIndex
                              ? "bg-black"
                              : "bg-black/25",
                          )}
                        />
                      </button>
                    ))}
                  </div>
                ) : null}

                <button
                  ref={expandButtonRef}
                  type="button"
                  onClick={() => setViewerOpen(true)}
                  aria-label="View images full screen"
                  className="absolute bottom-3 right-3 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-black transition-colors hover:text-plum focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum"
                >
                  <ExpandIcon width={20} height={20} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className={EMPTY_GALLERY_GRID}>
            <div className="flex aspect-[3/4] w-full items-center justify-center bg-black/5">
              <span className="text-xs uppercase tracking-[0.2em] text-black/30">
                No image
              </span>
            </div>
          </div>
        )}
      </div>

      <div
        className={cn(
          // Deliberately not stretched to the gallery's height: the options sit
          // one under the other with no dead air between Size and Quantity.
          // Below lg it is a plain block that follows the slider.
          "flex w-full min-w-0 flex-col gap-5 lg:w-2/5",
          // Stays under the top of the screen while the gallery scrolls, on the
          // detail page and inside the quick view alike.
          "lg:sticky lg:top-0 lg:self-start",
          isModal ? DETAILS_MAX_HEIGHT_MODAL : DETAILS_MAX_HEIGHT,
          // The ceiling above turns the column into its own scroll container,
          // so the small right padding keeps focus rings off its edge.
          "lg:overflow-y-auto lg:pr-1",
          // The close button floats over the modal's top-right corner, so the
          // details column starts below it on the two-column layout.
          showCloseButton && "lg:pt-12",
        )}
      >
        <div>
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-2xl leading-tight sm:text-3xl lg:text-4xl">
              {product.name}
            </h1>

            <button
              type="button"
              onClick={() => toggle(product.id)}
              aria-pressed={saved}
              aria-label={
                saved
                  ? `Remove ${product.name} from wishlist`
                  : `Add ${product.name} to wishlist`
              }
              className="flex h-11 w-11 shrink-0 items-center justify-center border border-black/10 text-black transition-colors hover:border-plum hover:text-plum focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum"
            >
              <PopOnChange trigger={saved} enabled={saved}>
                <HeartIcon
                  width={20}
                  height={20}
                  fill={saved ? "currentColor" : "none"}
                  className={saved ? "text-plum" : undefined}
                />
              </PopOnChange>
            </button>
          </div>

          <p className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
            {isDiscounted ? (
              <>
                <Price
                  amount={product.price}
                  className="text-base text-black/40 line-through sm:text-lg"
                />
                <Price
                  amount={product.discountPrice ?? product.price}
                  className="text-base font-medium text-plum sm:text-lg"
                />
                <span className="bg-plum px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.06em] text-white">
                  {percent}% OFF
                </span>
              </>
            ) : (
              <Price
                amount={product.price}
                className="text-base sm:text-lg"
              />
            )}
          </p>
        </div>

        {product.description ? (
          <FormattedDescription description={product.description} />
        ) : null}

        {needsSize ? (
          <div className="flex flex-col gap-2">
            <span className="text-xs uppercase tracking-[0.16em] text-black/60">
              Size
            </span>
            <div className="flex flex-wrap gap-2">
              {product.sizes.map((size) => (
                <button
                  key={size}
                  type="button"
                  aria-pressed={selectedSize === size}
                  onClick={() => {
                    setSelectedSize(size);
                    setSizeError(false);
                  }}
                  className={cn(
                    "min-h-11 px-3 py-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum",
                    selectedSize === size
                      ? "bg-black text-white"
                      : "border border-black/10 bg-white hover:border-black/40",
                  )}
                >
                  {size}
                </button>
              ))}
            </div>

            {sizeError ? (
              <p role="alert" className="text-xs text-plum">
                Please select a size first.
              </p>
            ) : null}
          </div>
        ) : null}

        {needsColor ? (
          <div className="flex flex-col gap-2">
            <span className="text-xs uppercase tracking-[0.16em] text-black/60">
              Color
            </span>
            <div className="flex flex-wrap gap-2">
              {product.colors.map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-pressed={selectedColor === color}
                  onClick={() => selectColor(color)}
                  className={cn(
                    "min-h-11 px-3 py-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum",
                    selectedColor === color
                      ? "bg-black text-white"
                      : "border border-black/10 bg-white hover:border-black/40",
                  )}
                >
                  {color}
                </button>
              ))}
            </div>

            {colorError ? (
              <p role="alert" className="text-xs text-plum">
                Please select a color first.
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-col gap-2">
          <span className="text-xs uppercase tracking-[0.16em] text-black/60">
            Quantity
          </span>
          <div className="flex w-fit items-center border border-black/10">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="flex h-11 w-11 items-center justify-center text-lg transition-colors hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum"
              aria-label="Decrease quantity"
            >
              -
            </button>
            <span className="flex h-11 min-w-[3rem] items-center justify-center px-2 text-sm">
              {quantity}
            </span>
            <button
              type="button"
              onClick={() => setQuantity((q) => q + 1)}
              className="flex h-11 w-11 items-center justify-center text-lg transition-colors hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum"
              aria-label="Increase quantity"
            >
              +
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:gap-4 md:flex-col md:gap-3 lg:flex-row lg:gap-4">
            <button
              type="button"
              onClick={handleAddToCart}
              className="min-h-11 flex-1 bg-plum px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-plum-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum"
            >
              Add to Cart
            </button>
            <button
              type="button"
              onClick={handleBuyNow}
              className={cn(
                "group relative min-h-11 flex-1 overflow-hidden border border-plum bg-white px-6 py-2.5 text-sm font-medium text-plum",
                "transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum",
              )}
            >
              <span className="relative z-10 transition-colors group-active:text-white [@media(hover:hover)_and_(pointer:fine)]:group-hover:text-white">
                Buy It Now
              </span>
              <span className="absolute inset-0 z-0 origin-bottom scale-y-0 bg-plum transition-transform duration-200 ease-[var(--motion-ease)] group-active:scale-y-100 [@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-y-100" />
            </button>
          </div>

          <p aria-live="polite" className="min-h-4 text-xs text-black/40">
            {added ? "Added to cart." : " "}
          </p>
        </div>


      </div>

      <ProductImageViewer
        images={images}
        productName={product.name}
        index={slideIndex}
        onIndexChange={handleViewerIndexChange}
        isOpen={viewerOpen}
        onClose={closeViewer}
      />
    </div>
  );
}
