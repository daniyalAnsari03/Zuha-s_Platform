"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import FadeInImage from "@/components/ui/FadeInImage";
import { IMAGE_QUALITY, isVectorImage } from "@/lib/images";
import { TRANSITION_SLOW } from "@/lib/motion";

/**
 * The circular-card carousel shared by the sub-category page and the Team page:
 * a horizontal side-scrolling row of circles with left/right arrows.
 *
 * Everything mechanical lives here so the two pages cannot drift apart - the
 * arrows, the scroll-snap track, the keyboard support, the card widths and the
 * circle + name card itself. A consumer only supplies the item list and what
 * each circle should do when tapped (a link, a button that opens a popup).
 *
 * Scroll mechanics are native (`overflow-x` + `scroll-snap`), so touch swipe,
 * trackpad horizontal scrolling and native momentum all work unchanged. The
 * arrows and the Left/Right keys scroll one page at a time.
 *
 * The row centers itself when every card fits (no scrolling, so no arrows), and
 * switches to left-aligned scrolling with arrows as soon as the cards overflow.
 * That is measured, never guessed, because how many cards fit differs between
 * mobile, tablet and desktop.
 */

export type CircleCarouselItem = {
  id: string;
  name: string;
  imageUrl: string;
};

type CircleCarouselProps<Item extends CircleCarouselItem> = {
  items: Item[];
  /** Names the track for screen readers, e.g. "Women's sub-categories". */
  ariaLabel: string;
  /** Stable id, used by the arrows' `aria-controls`. */
  trackId: string;
  /** Optional page heading rendered above the track. */
  heading?: ReactNode;
  /**
   * Id of the element `heading` renders, so the section is labelled by its
   * heading the way the sub-category page always was. Falls back to
   * `ariaLabel` when there is no heading.
   */
  headingId?: string;
  /**
   * Wraps one card's circle + name in whatever makes it interactive: a `Link`
   * for a page, a `button` for a popup. Receives the item, and must spread
   * `CIRCLE_CARD_ACTION_CLASS` onto the element and pass the matching `sizes`
   * to `CircleCard`.
   */
  renderAction: (item: Item, index: number) => ReactNode;
  /** Defaults to the sub-category page's responsive card widths. */
  cardWidthClassName?: string;
  /** Extra classes for the outer `<section>`. */
  className?: string;
};

/**
 * The wrapper classes both the sub-category links and the Team buttons share.
 *
 * `w-full` is load-bearing: a `<button>` sizes itself shrink-to-fit even at
 * `display: flex`, so without it the button collapses to the width of the name
 * label and `CircleCard`'s `w-full` circle shrinks with it, while the `<a>` on
 * the sub-category page fills its `li`. Forcing the full `li` width makes the
 * circle diameter identical on both pages. The rest keeps a button looking
 * exactly like that link: no UA padding, border or background, centred label,
 * pointer cursor, unchanged focus ring.
 */
export const CIRCLE_CARD_ACTION_CLASS =
  "group flex w-full cursor-pointer flex-col items-center gap-3 rounded-2xl border-0 bg-transparent p-0 text-center focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-plum sm:gap-4";

/** The wrapper sizes for the card's `sizes` attribute - mirrors DEFAULT_CARD_WIDTH. */
export const CIRCLE_CARD_IMAGE_SIZES =
  "(max-width: 639px) 74vw, (max-width: 767px) 46vw, (max-width: 1023px) 31vw, (max-width: 1279px) 18.5vw, 16vw";

const DEFAULT_CARD_WIDTH = "w-[74vw] sm:w-[46vw] md:w-[31vw] lg:w-[18.5vw] xl:w-[16vw]";

const ARROW_BASE =
  "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-black/15 bg-white text-black shadow-[0_1px_6px_rgba(0,0,0,0.08)] transition-[color,border-color,opacity] duration-200 hover:border-plum hover:text-plum focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum disabled:cursor-not-allowed disabled:border-black/10 disabled:text-black/25 disabled:opacity-50 disabled:shadow-none sm:h-12 sm:w-12";

/**
 * Measured before the browser paints, so the row never flashes in the wrong
 * alignment. There is no layout to measure on the server, so `useEffect` is the
 * SSR-safe stand-in there.
 */
const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

export default function CircleCarousel<Item extends CircleCarouselItem>({
  items,
  ariaLabel,
  trackId,
  heading,
  headingId,
  renderAction,
  cardWidthClassName = DEFAULT_CARD_WIDTH,
  className,
}: CircleCarouselProps<Item>) {
  const trackRef = useRef<HTMLUListElement>(null);
  const reduceMotion = useReducedMotion();
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const syncArrows = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;

    // 1px of slack absorbs sub-pixel rounding at the last card.
    const maxScrollLeft = track.scrollWidth - track.clientWidth;
    setIsOverflowing(maxScrollLeft > 1);
    setCanScrollLeft(track.scrollLeft > 1);
    setCanScrollRight(track.scrollLeft < maxScrollLeft - 1);
  }, []);

  useIsomorphicLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    syncArrows();
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(syncArrows);
    };
    track.addEventListener("scroll", onScroll, { passive: true });

    const observer = new ResizeObserver(syncArrows);
    observer.observe(track);

    return () => {
      track.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [syncArrows, items.length]);

  /** One press = one page of cards, which is one card on mobile. */
  const scrollByPage = useCallback(
    (direction: 1 | -1) => {
      const track = trackRef.current;
      if (!track) return;

      track.scrollBy({
        left: direction * track.clientWidth * 0.9,
        behavior: reduceMotion ? "auto" : "smooth",
      });
    },
    [reduceMotion],
  );

  const onKeyDown = (event: React.KeyboardEvent<HTMLUListElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;

    event.preventDefault();
    scrollByPage(event.key === "ArrowRight" ? 1 : -1);
  };

  return (
    <section
      aria-label={headingId ? undefined : ariaLabel}
      aria-labelledby={headingId}
      className={className}
    >
      {heading}

      <div className="relative">
        {/* Rendered only while it can actually scroll that way, so a disabled
            arrow never sits on top of the first/last circle. */}
        {isOverflowing && canScrollLeft ? (
          <button
            type="button"
            onClick={() => scrollByPage(-1)}
            aria-label={`Scroll ${ariaLabel.toLowerCase()} left`}
            aria-controls={trackId}
            className={`${ARROW_BASE} absolute top-1/2 left-0 z-20 -translate-y-1/2 sm:-left-2 md:-left-3`}
          >
            <ChevronIcon direction="left" />
          </button>
        ) : null}

        <ul
          id={trackId}
          ref={trackRef}
          tabIndex={0}
          onKeyDown={onKeyDown}
          aria-label={ariaLabel}
          className={`no-scrollbar flex snap-x snap-mandatory items-start ${
            isOverflowing ? "justify-start" : "justify-center"
          } gap-4 overflow-x-auto overscroll-x-contain px-1 pb-2 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-plum sm:gap-6 lg:gap-8`}
        >
          {items.map((item, index) => (
            <li
              key={item.id}
              className={`${cardWidthClassName} shrink-0 snap-center`}
            >
              <motion.div
                initial={reduceMotion ? false : { opacity: 0, scale: 0.96 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={TRANSITION_SLOW}
              >
                {renderAction(item, index)}
              </motion.div>
            </li>
          ))}
        </ul>

        {isOverflowing && canScrollRight ? (
          <button
            type="button"
            onClick={() => scrollByPage(1)}
            aria-label={`Scroll ${ariaLabel.toLowerCase()} right`}
            aria-controls={trackId}
            className={`${ARROW_BASE} absolute top-1/2 right-0 z-20 -translate-y-1/2 sm:-right-2 md:-right-3`}
          >
            <ChevronIcon direction="right" />
          </button>
        ) : null}
      </div>
    </section>
  );
}

type CircleCardProps = {
  name: string;
  imageUrl: string;
  sizes: string;
};

/**
 * The card itself: a circular image with the name underneath, nothing else.
 *
 * Meant to sit inside an element carrying {@link CIRCLE_CARD_ACTION_CLASS}, so
 * the hover zoom is driven by that wrapper's `group`.
 */
export function CircleCard({ name, imageUrl, sizes }: CircleCardProps) {
  const reduceMotion = useReducedMotion();

  return (
    <>
      <span className="relative block aspect-square w-full overflow-hidden rounded-full bg-black/5">
        <FadeInImage
          src={imageUrl}
          alt=""
          sizes={sizes}
          quality={IMAGE_QUALITY}
          unoptimized={isVectorImage(imageUrl)}
          wrapperClassName={
            // The zoom itself lives in globals.css inside the hover-capable
            // media query, so a tap can never leave the circle stuck zoomed.
            reduceMotion ? undefined : "circle-card-zoom"
          }
          className="object-cover"
        />
      </span>

      <span className="text-center text-sm tracking-[0.06em] sm:text-base">
        {name}
      </span>
    </>
  );
}

type ChevronIconProps = {
  direction: "left" | "right";
};

export function ChevronIcon({ direction }: ChevronIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden="true"
    >
      {direction === "left" ? (
        <path d="M15 5 8 12l7 7" />
      ) : (
        <path d="m9 5 7 7-7 7" />
      )}
    </svg>
  );
}