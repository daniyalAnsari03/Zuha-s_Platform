"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { EASE_ENTER, MOTION_DURATION } from "@/lib/motion";

/**
 * The flat horizontal card row shared by the sub-category page and the Team
 * page: a native side-scrolling track of equal-size cards with left/right
 * arrows that only appear when the cards actually overflow.
 *
 * Everything mechanical lives here so the two pages cannot drift apart - the
 * scroll-snap track, the measured arrows, the keyboard support, the smooth
 * arrow scrolling and the one-time entrance animation. A consumer only
 * supplies the item list and each card's interactive wrapper via
 * `renderAction` (a `Link` for the sub-category page, a `button` that opens a
 * popup for the Team page).
 *
 * Scroll mechanics are native (`overflow-x` + `scroll-snap`), so touch swipe,
 * trackpad horizontal scrolling and momentum all work unchanged. The arrows
 * and the Left/Right keys scroll one page at a time, smoothly (instantly under
 * `prefers-reduced-motion`).
 *
 * The row centers itself when every card fits (no scrolling, so no arrows),
 * and switches to left-aligned scrolling with arrows as soon as the cards
 * overflow. That is measured, never guessed.
 *
 * On open, the cards fade up into place with a small left-to-right stagger
 * (transform + opacity only, via the shared motion tokens). It plays once,
 * never on arrow clicks, and is skipped entirely under reduced motion.
 */

export type CardRowItem = {
  id: string;
  name: string;
  imageUrl: string;
};

type CardRowCarouselProps<Item extends CardRowItem> = {
  items: Item[];
  /** Names the track for screen readers, e.g. "Women's sub-categories". */
  ariaLabel: string;
  /** Stable id, used by the arrows' `aria-controls`. */
  trackId: string;
  /** Optional page heading rendered above the track. */
  heading?: ReactNode;
  /**
   * Id of the element `heading` renders, so the section is labelled by its
   * heading. Falls back to `ariaLabel` when there is no heading.
   */
  headingId?: string;
  /**
   * Wraps one card in whatever makes it interactive: a `Link` for a page, a
   * `button` for a popup. Receives the item and index, and must spread
   * `CARD_ROW_ACTION_CLASS` onto the element and pass the matching `sizes` to
   * the card component.
   */
  renderAction: (item: Item, index: number) => ReactNode;
  /** Defaults to the sub-category page's responsive card widths. */
  cardWidthClassName?: string;
  /** Extra classes for the outer `<section>`. */
  className?: string;
};

/**
 * The wrapper class both the sub-category links and the Team buttons share.
 *
 * `w-full` is load-bearing: a `<button>` sizes itself shrink-to-fit even at
 * `display: flex`, so without it the button collapses to the width of the name
 * label and the card's `w-full` image shrinks with it, while the `<a>` on the
 * sub-category page fills its `li`. Forcing the full `li` width makes the
 * cards identical on both pages.
 */
export const CARD_ROW_ACTION_CLASS =
  "group flex w-full cursor-pointer flex-col items-center rounded-2xl border-0 bg-transparent p-0 text-center focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-plum";

/** Sub-category card widths - identical to the product-listing step, kept from the original row. */
export const SUB_CATEGORY_CARD_WIDTH =
  "w-[70%] md:w-[30%] lg:w-[25%]";
export const SUB_CATEGORY_IMAGE_SIZES =
  "(max-width: 767px) 70vw, (max-width: 1023px) 30vw, 25vw";

/** The Team page's circle widths - the original circle carousel sizes. */
export const TEAM_CARD_WIDTH =
  "w-[74vw] sm:w-[46vw] md:w-[31vw] lg:w-[18.5vw] xl:w-[16vw]";
export const TEAM_IMAGE_SIZES =
  "(max-width: 639px) 74vw, (max-width: 767px) 46vw, (max-width: 1023px) 31vw, (max-width: 1279px) 18.5vw, 16vw";

const ARROW_BASE =
  "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-black/15 bg-white text-black shadow-[0_1px_6px_rgba(0,0,0,0.08)] transition-[color,border-color,opacity] duration-200 hover:border-plum hover:text-plum focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum disabled:cursor-not-allowed disabled:border-black/10 disabled:text-black/25 disabled:opacity-50 disabled:shadow-none sm:h-12 sm:w-12";

/** Entrance: soft fade + a slight upward slide, shared easing. */
const cardVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 16,
    transition: { duration: MOTION_DURATION.fast, ease: EASE_ENTER },
  },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: MOTION_DURATION.slow, ease: EASE_ENTER },
  },
};

/** Small left-to-right stagger between the cards. */
const rowVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};

/**
 * Measured before the browser paints, so the row never flashes in the wrong
 * alignment. There is no layout to measure on the server, so `useEffect` is the
 * SSR-safe stand-in there.
 */
const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

export default function CardRowCarousel<Item extends CardRowItem>({
  items,
  ariaLabel,
  trackId,
  heading,
  headingId,
  renderAction,
  cardWidthClassName = SUB_CATEGORY_CARD_WIDTH,
  className,
}: CardRowCarouselProps<Item>) {
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
            arrow never sits on top of the first/last card. */}
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

        <motion.ul
          id={trackId}
          ref={trackRef}
          tabIndex={0}
          onKeyDown={onKeyDown}
          aria-label={ariaLabel}
          // The entrance animation runs once on mount (not `whileInView`), so
          // arrow scrolling never re-triggers it. Framer Motion adds
          // `will-change` only while the cards are actually animating.
          initial={reduceMotion ? false : "hidden"}
          animate="show"
          variants={rowVariants}
          className={`no-scrollbar flex snap-x snap-mandatory items-start ${
            isOverflowing ? "justify-start" : "justify-center"
          } gap-4 overflow-x-auto overscroll-x-contain px-1 pb-2 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-plum sm:gap-6 lg:gap-8`}
        >
          {items.map((item, index) => (
            <li
              key={item.id}
              className={`${cardWidthClassName} shrink-0 snap-center`}
            >
              <motion.div variants={cardVariants}>
                {renderAction(item, index)}
              </motion.div>
            </li>
          ))}
        </motion.ul>

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

type CardNameProps = {
  name: string;
};

/** The flat card's name line, matching the product-listing card typography. */
export function CardRowName({ name }: CardNameProps) {
  return (
    <span className="mt-3 text-center text-sm leading-snug tracking-[0.02em] sm:mt-4 sm:text-base">
      {name}
    </span>
  );
}

type ChevronIconProps = {
  direction: "left" | "right";
};

function ChevronIcon({ direction }: ChevronIconProps) {
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
