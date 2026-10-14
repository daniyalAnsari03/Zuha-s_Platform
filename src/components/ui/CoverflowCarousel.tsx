"use client";

import {
  motion,
  useReducedMotion,
  type PanInfo,
  type Transition,
} from "framer-motion";
import Link from "next/link";
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import FadeInImage from "@/components/ui/FadeInImage";
import { IMAGE_QUALITY, isVectorImage } from "@/lib/images";
import { EASE_ENTER, MOTION_DURATION } from "@/lib/motion";

/**
 * The 3D coverflow carousel shared by the sub-category page and the Team page.
 *
 * One shared component, so the two pages cannot drift apart. The active card
 * sits centred and faces straight; the neighbours step back, shrink, tilt away
 * in 3D and fade the farther they are. Nothing mechanical lives in a consumer -
 * this file owns the positioning, the arrows, the swipe/drag, the keyboard
 * support, the clamped 0..n-1 active index and the portrait image + name card.
 *
 * A consumer only supplies the item list and what the *centre* card does when
 * it is activated (`onActivate`, or `getHref` for a real link). Tapping a side
 * card just makes it the active card; it never navigates.
 *
 * Positioning is pure CSS percentages (a card's width is a % of the content
 * container, and Framer's `x` is a % of the card's own width), so it renders
 * identically on the server and needs no measurement. The breakpoint only picks
 * the transform *profile*: how far apart the cards sit, how much they shrink and
 * tilt, and how many are visible.
 *
 * Desktop (1024px+) renders *every* item: the cards stack continuously outwards
 * from the centre at a constant step (so there is no gap between the centre and
 * the arrows), keep the first neighbour's scale and tilt, and fade smoothly over
 * the last stretch of the stage instead of being hard-clipped. The geometry is
 * expressed in card widths, and a card's width is a fixed fraction of the stage
 * (`CARD_FRACTION`), so no measurement is needed. Tablet and mobile keep the
 * original compact profile.
 */

export type CoverflowItem = {
  id: string;
  name: string;
  imageUrl: string;
};

type CoverflowCarouselProps<Item extends CoverflowItem> = {
  items: Item[];
  /** Names the carousel for screen readers, e.g. "Women's sub-categories". */
  ariaLabel: string;
  /** Optional page heading rendered above the carousel. */
  heading?: ReactNode;
  /** Id of the element `heading` renders, so the section is labelled by it. */
  headingId?: string;
  /**
   * Runs when the centred card is activated (click / Enter / Space). Ignored for
   * a card that also has a `getHref`, because that card is a real link.
   */
  onActivate?: (item: Item, index: number) => void;
  /** When set, the centred card renders as a `next/link` to this URL. */
  getHref?: (item: Item) => string;
  /** Extra classes for the outer `<section>`. */
  className?: string;
};

/** How wide a card is, as a fraction of the content container, per breakpoint. */
const CARD_WIDTH_CLASS = "w-[70%] md:w-[30%] lg:w-[25%]";

/**
 * The same card widths as `CARD_WIDTH_CLASS`, as numbers. All positioning is
 * expressed in card widths, and a card's width is a known fraction of the stage
 * (`stage = 1 / cardFraction` cards wide), so the geometry scales with the
 * container without measuring anything.
 */
const CARD_FRACTION = {
  desktop: 0.25,
  tablet: 0.3,
  mobile: 0.7,
} as const;

/**
 * The compact coverflow profile, used by tablet and mobile only. Every array is
 * indexed by a card's distance from the centre and gives absolute values
 * relative to the centre card's own width W:
 *
 * - `xFactors` - how far the card's centre is displaced, as a fraction of W.
 * - `scales` / `tilts` / `opacities` - the card's size, 3D tilt (degrees) and
 *   opacity at that distance. The tilt sign is derived from the card's side, so
 *   a left card leans to face the centre and a right card mirrors it.
 *
 * These are applied as a percentage of the *card's own* width in Framer's `x`
 * (i.e. `x = offset * xFactors[d] * 100%`), which is what makes the geometry
 * independent of the viewport while still animating smoothly.
 *
 * - Tablet: 3 cards visible (1 each side), smaller and lighter tilt.
 * - Mobile: the centre card with a ~15% peek of one neighbour each side, scaled
 *   to 0.85 with no tilt and no blur.
 */
const PROFILE = {
  tablet: {
    xFactors: [0, 0.75],
    scales: [1, 0.85],
    tilts: [0, 25],
    opacities: [1, 0.85],
    maxVisibleOffset: 1,
  },
  mobile: {
    xFactors: [0, 0.28],
    scales: [1, 0.85],
    tilts: [0, 0],
    opacities: [1, 1],
    maxVisibleOffset: 1,
  },
} as const;

/**
 * The desktop profile (1024px+). Unlike tablet/mobile this renders *every* item:
 * the cards stack continuously outwards from the centre, each one a constant
 * step behind the one in front, so there is no empty gap between the centre and
 * the arrows. The first neighbour keeps its original size, tilt and opacity
 * (0.85 / 35deg / 0.9) and every card beyond it uses the same scale and a
 * constant step; z-index falls with distance (see `CoverflowCard`). The outer
 * stretch of the stage fades the last cards out smoothly instead of clipping
 * them.
 */
const DESKTOP = {
  /** Distance between consecutive card centres, in card widths (constant). */
  step: 0.7,
  /** Every card except the centre uses the first neighbour's scale. */
  sideScale: 0.85,
  /** Tilt (deg) by distance: centre upright, then the ±1 tilt, then a constant. */
  tilts: [0, 35, 45],
  /** Base opacity before the edge fade: centre 1, first neighbour 0.9. */
  baseOpacity: [1, 0.9],
  /** Fraction of the full stage width that fades out at each end. */
  fadeFraction: 0.11,
  /** Cards this close to the centre (and still visible) stay interactive. */
  maxInteractiveOffset: 2,
} as const;

type CompactBreakpoint = keyof typeof PROFILE;
type Breakpoint = CompactBreakpoint | "desktop";

const TABLET_QUERY = "(min-width: 768px)";
const DESKTOP_QUERY = "(min-width: 1024px)";

/** One swipe = one card. */
const SWIPE_OFFSET_PX = 55;
const SWIPE_VELOCITY = 420;

/** How long the row animates, so `will-change` can be dropped afterwards. */
const ANIMATION_MS = MOTION_DURATION.slow * 1000 + 60;

/** Per-card perspective, so the 3D tilt survives the drag wrapper's flattening. */
const STAGE_PERSPECTIVE = 1200;

const CARD_ACTION_CLASS =
  "group flex w-full cursor-pointer flex-col items-center rounded-2xl border-0 bg-transparent p-0 text-center focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-plum";

const CARD_IMAGE_CLASS =
  "relative block aspect-[3/4] w-full overflow-hidden rounded-2xl bg-black/5 shadow-[0_18px_45px_-18px_rgba(0,0,0,0.35)]";

const CARD_NAME_CLASS =
  "mt-3 block min-h-10 text-center text-sm tracking-[0.06em] sm:min-h-11 sm:text-base";

const CARD_SIZES = "(max-width: 767px) 70vw, (max-width: 1023px) 30vw, 25vw";

const ARROW_BASE =
  "pointer-events-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-black/15 bg-white text-black shadow-[0_1px_6px_rgba(0,0,0,0.08)] transition-[color,border-color,opacity] duration-200 hover:border-plum hover:text-plum focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum disabled:cursor-not-allowed disabled:border-black/10 disabled:text-black/25 disabled:opacity-40 disabled:shadow-none sm:h-12 sm:w-12";

function subscribeBreakpoint(onStoreChange: () => void): () => void {
  const tablet = window.matchMedia(TABLET_QUERY);
  const desktop = window.matchMedia(DESKTOP_QUERY);

  tablet.addEventListener("change", onStoreChange);
  desktop.addEventListener("change", onStoreChange);

  return () => {
    tablet.removeEventListener("change", onStoreChange);
    desktop.removeEventListener("change", onStoreChange);
  };
}

function getBreakpointSnapshot(): Breakpoint {
  if (window.matchMedia(DESKTOP_QUERY).matches) return "desktop";
  if (window.matchMedia(TABLET_QUERY).matches) return "tablet";
  return "mobile";
}

/**
 * The server (and hydration) always use the desktop profile. React serves this
 * snapshot during hydration and only then swaps in the real one, so there is
 * never a hydration mismatch; the swap snaps instead of animating (see
 * `mounted`).
 */
function getBreakpointServerSnapshot(): Breakpoint {
  return "desktop";
}

/** A card's resolved transform/opacity for its current distance from the centre. */
type CardGeometry = {
  x: string;
  scale: number;
  rotateY: number;
  opacity: number;
  interactive: boolean;
};

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

/**
 * Desktop geometry. Every card is placed at `offset * step` card widths from the
 * centre - a constant step, so each card sits right behind the previous one with
 * the same visible slice as the first neighbour. Scale stays at the ±1 value and
 * only the opacity fades, over the last `fadeFraction` of the stage, so the
 * outermost cards dissolve near the arrows rather than being clipped.
 */
function desktopGeometry(offset: number): CardGeometry {
  const distance = Math.abs(offset);
  const scale = distance === 0 ? 1 : DESKTOP.sideScale;
  const tilt = DESKTOP.tilts[Math.min(distance, DESKTOP.tilts.length - 1)];

  // Base opacity before the edge fade: 1 at the centre, 0.9 for ±1, then a very
  // slight falloff so the stack reads as depth without hiding any card.
  const base =
    distance < DESKTOP.baseOpacity.length
      ? DESKTOP.baseOpacity[distance]
      : Math.max(0.7, 0.9 - 0.05 * (distance - 1));

  // The stage is (1 / CARD_FRACTION) cards wide; fade the outer slice of it.
  const stageHalfInCards = 0.5 / CARD_FRACTION.desktop;
  const fadeWidthInCards = DESKTOP.fadeFraction / CARD_FRACTION.desktop;
  const outerEdge = distance * DESKTOP.step + scale * 0.5;
  const progress = clamp01(
    (stageHalfInCards - outerEdge) / fadeWidthInCards,
  );
  // Smoothstep, so the fade eases in and out instead of ramping linearly.
  const eased = progress * progress * (3 - 2 * progress);
  const opacity = base * eased;

  return {
    x: `${offset * DESKTOP.step * 100}%`,
    scale,
    rotateY: -Math.sign(offset) * tilt,
    opacity,
    interactive:
      distance === 0 ||
      (distance <= DESKTOP.maxInteractiveOffset && opacity > 0.15),
  };
}

/** Tablet / mobile geometry: unchanged - only the listed distances are shown. */
function compactGeometry(
  offset: number,
  breakpoint: CompactBreakpoint,
): CardGeometry {
  const profile = PROFILE[breakpoint];
  const distance = Math.abs(offset);
  const withinRange = distance <= profile.maxVisibleOffset;
  const clamped = Math.min(distance, profile.xFactors.length - 1);

  return {
    x: `${offset * profile.xFactors[clamped] * 100}%`,
    scale: profile.scales[Math.min(distance, profile.scales.length - 1)],
    rotateY: -Math.sign(offset) * profile.tilts[clamped],
    opacity: withinRange
      ? profile.opacities[Math.min(distance, profile.opacities.length - 1)]
      : 0,
    interactive: withinRange,
  };
}

export default function CoverflowCarousel<Item extends CoverflowItem>({
  items,
  ariaLabel,
  heading,
  headingId,
  onActivate,
  getHref,
  className,
}: CoverflowCarouselProps<Item>) {
  const reduceMotion = useReducedMotion();
  const breakpoint = useSyncExternalStore(
    subscribeBreakpoint,
    getBreakpointSnapshot,
    getBreakpointServerSnapshot,
  );

  const [active, setActive] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [animating, setAnimating] = useState(false);

  const activeRef = useRef(0);
  const lastIndex = items.length - 1;

  // The first client render matches the server (no animation); the correction
  // to the real breakpoint then snaps into place instead of gliding.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(() => true);
  }, []);

  // Keep the active card inside the list when the admin adds or removes items.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActive((current) => Math.min(current, Math.max(0, items.length - 1)));
  }, [items.length]);

  // Drop `will-change` again once the row has settled.
  useEffect(() => {
    if (!animating) return;
    const timer = window.setTimeout(() => {
      setAnimating(() => false);
    }, ANIMATION_MS);
    return () => window.clearTimeout(timer);
  }, [animating]);

  const select = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(items.length - 1, next));
      if (clamped === activeRef.current) return;
      activeRef.current = clamped;
      setAnimating(true);
      setActive(clamped);
    },
    [items.length],
  );

  const goBy = useCallback(
    (direction: 1 | -1) => select(activeRef.current + direction),
    [select],
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      goBy(event.key === "ArrowRight" ? 1 : -1);
    },
    [goBy],
  );

  const onDragEnd = useCallback(
    (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      const offset = info.offset.x;
      const velocity = info.velocity.x;

      if (offset < -SWIPE_OFFSET_PX || velocity < -SWIPE_VELOCITY) {
        goBy(1);
      } else if (offset > SWIPE_OFFSET_PX || velocity > SWIPE_VELOCITY) {
        goBy(-1);
      }
    },
    [goBy],
  );

  const transition = useMemo<Transition>(
    () =>
      mounted
        ? {
            duration: reduceMotion ? 0.01 : MOTION_DURATION.slow,
            ease: EASE_ENTER,
          }
        : { duration: 0 },
    [mounted, reduceMotion],
  );

  const showArrows = items.length > 1;

  return (
    <section
      aria-roledescription="carousel"
      aria-label={headingId ? undefined : ariaLabel}
      aria-labelledby={headingId}
      // The row is clipped only here, at the outer section edge (which is the
      // page edge when the viewport is narrower than the 1600px max), so the
      // fanned cards never cause a sideways scroll and are never cut with a
      // visible edge - they fade out before they reach it.
      className={`${className ?? ""} relative overflow-x-clip`}
      onKeyDown={onKeyDown}
    >
      {heading}

      <div className="relative">
        <div className="relative px-1 pt-4 pb-2">
          <motion.div
            className="relative"
            style={{ touchAction: "pan-y" }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.16}
            dragSnapToOrigin
            onDragEnd={onDragEnd}
            // Stop the browser's native image drag from stealing the gesture.
            onDragStart={(event) => event.preventDefault()}
          >
            {/* In-flow sizer: the absolutely positioned cards cannot give the
                row its height, so this invisible copy does, at every width. */}
            <div
              aria-hidden
              className={`${CARD_WIDTH_CLASS} invisible mx-auto`}
            >
              <div className="aspect-[3/4] w-full" />
              <div className={CARD_NAME_CLASS}>&nbsp;</div>
            </div>

            {items.map((item, index) => {
              const offset = index - active;
              const distance = Math.abs(offset);
              const isActive = offset === 0;

              const geometry =
                breakpoint === "desktop"
                  ? desktopGeometry(offset)
                  : compactGeometry(offset, breakpoint);

              const href = getHref ? getHref(item) : undefined;

              return (
                <CoverflowCard
                  key={item.id}
                  item={item}
                  isActive={isActive}
                  x={geometry.x}
                  scale={geometry.scale}
                  rotateY={geometry.rotateY}
                  opacity={geometry.opacity}
                  interactive={geometry.interactive}
                  // Higher for cards nearer the centre, so each card sits behind
                  // the one in front. Never negative, however many items there are.
                  zIndex={items.length - distance}
                  animating={animating}
                  transition={transition}
                  widthClass={CARD_WIDTH_CLASS}
                  href={href}
                  onCentreClick={() =>
                    isActive && onActivate
                      ? onActivate(item, index)
                      : select(index)
                  }
                  onSideClick={() => select(index)}
                  onLinkClick={(event) => {
                    if (isActive) return;
                    event.preventDefault();
                    select(index);
                  }}
                />
              );
            })}
          </motion.div>
        </div>

        {showArrows ? (
          <div className="mt-6 flex items-center justify-center gap-6 md:pointer-events-none md:absolute md:inset-y-0 md:right-0 md:left-0 md:mt-0 md:items-center md:justify-between">
            <button
              type="button"
              onClick={() => goBy(-1)}
              disabled={active === 0}
              aria-label={`Show previous ${ariaLabel.toLowerCase()}`}
              className={ARROW_BASE}
            >
              <ChevronIcon direction="left" />
            </button>
            <button
              type="button"
              onClick={() => goBy(1)}
              disabled={active === lastIndex}
              aria-label={`Show next ${ariaLabel.toLowerCase()}`}
              className={ARROW_BASE}
            >
              <ChevronIcon direction="right" />
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

type CoverflowCardProps = {
  item: CoverflowItem;
  isActive: boolean;
  x: string;
  scale: number;
  rotateY: number;
  opacity: number;
  interactive: boolean;
  zIndex: number;
  animating: boolean;
  transition: Transition;
  widthClass: string;
  href?: string;
  onCentreClick: () => void;
  onSideClick: () => void;
  onLinkClick: (event: React.MouseEvent) => void;
};

/**
 * One card. Memoised so a change re-renders only the cards it actually moves -
 * the whole visible row shifts by one on every step, but untouched off-screen
 * cards are skipped.
 */
const CoverflowCard = memo(function CoverflowCard({
  item,
  isActive,
  x,
  scale,
  rotateY,
  opacity,
  interactive,
  zIndex,
  animating,
  transition,
  widthClass,
  href,
  onCentreClick,
  onSideClick,
  onLinkClick,
}: CoverflowCardProps) {
  return (
    <motion.div
      className={`absolute top-0 right-0 left-0 mx-auto ${widthClass}`}
      initial={false}
      animate={{ x, scale, rotateY, opacity }}
      transition={transition}
      style={{
        zIndex,
        willChange: animating ? "transform" : "auto",
        pointerEvents: interactive ? "auto" : "none",
        transformPerspective: STAGE_PERSPECTIVE,
      }}
      aria-hidden={!interactive}
    >
      {href ? (
        <Link
          href={href}
          onClick={onLinkClick}
          tabIndex={interactive ? 0 : -1}
          className={CARD_ACTION_CLASS}
        >
          <CardContent item={item} isActive={isActive} />
        </Link>
      ) : (
        <button
          type="button"
          onClick={isActive ? onCentreClick : onSideClick}
          tabIndex={interactive ? 0 : -1}
          className={CARD_ACTION_CLASS}
        >
          <CardContent item={item} isActive={isActive} />
        </button>
      )}
    </motion.div>
  );
});

function CardContent({
  item,
  isActive,
}: {
  item: CoverflowItem;
  isActive: boolean;
}) {
  return (
    <>
      <span className={CARD_IMAGE_CLASS}>
        <FadeInImage
          src={item.imageUrl}
          alt=""
          sizes={CARD_SIZES}
          quality={IMAGE_QUALITY}
          unoptimized={isVectorImage(item.imageUrl)}
          className="object-cover"
        />
      </span>
      <span
        className={`${CARD_NAME_CLASS} ${isActive ? "" : "text-sm text-black/55 sm:text-sm"}`}
      >
        {item.name}
      </span>
    </>
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