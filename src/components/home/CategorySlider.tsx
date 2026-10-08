"use client";

import { motion, useReducedMotion } from "framer-motion";
import Image, { getImageProps } from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import SiteFooter from "@/components/layout/SiteFooter";
import type { HomeCategorySlide } from "@/lib/home-data";
import { IMAGE_QUALITY, isVectorImage } from "@/lib/images";
import { SLIDER_DURATION, SLIDER_EASE } from "@/lib/motion";
import type { StoreDetails } from "@/lib/site-config";

type CategorySliderProps = {
  categories: HomeCategorySlide[];
  /** Store details for the footer slide, read once on the server. */
  details: StoreDetails;
  onFooterActiveChange: (active: boolean) => void;
  /**
   * Reports the image the active slide is actually displaying for this
   * viewport (mobile art direction included), or `null` on the footer slide.
   * The homepage measures it for the adaptive header tone.
   */
  onActiveImageUrlChange: (imageUrl: string | null) => void;
};

const TRANSITION_SECONDS = SLIDER_DURATION;
/** Must stay >= TRANSITION_SECONDS so the lock is released after the landing. */
const TRANSITION_MS = TRANSITION_SECONDS * 1000;
/** One wheel gesture = one burst of events, separated by a quiet gap. */
const GESTURE_IDLE_MS = 240;
/** After a slide lands, ignore follow-up bursts (trackpad inertia). */
const WHEEL_COOLDOWN_MS = 650;
const SWIPE_THRESHOLD_PX = 45;
/** Movement beyond this is a drag, not a tap. */
const TAP_TOLERANCE_PX = 10;
/** How long a finished drag keeps suppressing the click that follows it. */
const CLICK_SUPPRESS_MS = 400;
/**
 * Mobile art direction: anything narrower than Tailwind's `md` (tablet) step
 * takes the optional Mobile image, tablet and desktop always take the Desktop
 * one. `<picture>` picks a candidate before first paint, so there is no second
 * image request and nothing to hydrate.
 */
const MOBILE_MEDIA = "(max-width: 47.999rem)";
/** Slides fetched eagerly on load; the rest stay lazy. */
const EAGER_SLIDES = 2;

/** Elements marked with this attribute scroll on their own (e.g. the footer). */
const SCROLLABLE_SELECTOR = "[data-scrollable]";

/**
 * The footer slide's own scroll box (SiteFooter renders it with this id).
 *
 * It is the only scroll box that hands a gesture back to the slider: when it
 * has no room left in the direction of the gesture, the slider takes over, so
 * an upward gesture on the last slide moves back to the previous one. The open
 * menu / search / cart panels keep every gesture for themselves.
 */
const FOOTER_SELECTOR = "#site-footer";

/** The footer scroll box the gesture started in, or `null` for anything else. */
function footerScroller(target: EventTarget | null): HTMLElement | null {
  const element = target as HTMLElement | null;
  if (!element || typeof element.closest !== "function") return null;
  return element.closest<HTMLElement>(FOOTER_SELECTOR);
}

/** True when the footer box has no scroll left in `direction` (-1 up, 1 down). */
function isFooterEdge(footer: HTMLElement, direction: 1 | -1): boolean {
  return direction < 0
    ? footer.scrollTop <= 0
    : footer.scrollTop + footer.clientHeight >= footer.scrollHeight - 1;
}

/** Optimized candidates for a `<source>`; vectors are served as-is. */
function slideSrcSet(src: string) {
  if (isVectorImage(src)) return src;

  // The quality has to be passed here too: `<source>` cannot carry one, so it
  // only exists inside each candidate URL. Without it the art-directed mobile
  // picture would silently stay at the default quality while the desktop
  // <Image> below rendered at IMAGE_QUALITY.
  return (
    getImageProps({
      alt: "",
      src,
      fill: true,
      sizes: "100vw",
      quality: IMAGE_QUALITY,
    }).props.srcSet ?? src
  );
}

export default function CategorySlider({
  categories,
  details,
  onFooterActiveChange,
  onActiveImageUrlChange,
}: CategorySliderProps) {
  const reduceMotion = useReducedMotion();
  const total = categories.length + 1; // category slides + the footer slide
  const totalRef = useRef(total);
  const indexRef = useRef(0);
  const lockedRef = useRef(false);
  const lastMoveAtRef = useRef(0);

  const [index, setIndex] = useState(0);

  const suppressClickRef = useRef(false);

  useEffect(() => {
    totalRef.current = total;
  }, [total]);

  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  useEffect(() => {
    onFooterActiveChange(index === total - 1);
  }, [index, total, onFooterActiveChange]);

  /*
   * Which image is really on screen: the `<picture>` below takes the mobile
   * image below `md` and falls back to the desktop one, so the header tone is
   * measured against exactly the same candidate (and re-measured when the
   * viewport crosses that breakpoint).
   */
  useEffect(() => {
    const category = categories[index];

    if (!category) {
      onActiveImageUrlChange(null);
      return;
    }

    const media = window.matchMedia(MOBILE_MEDIA);
    const report = () => {
      onActiveImageUrlChange(
        media.matches && category.mobileImageUrl
          ? category.mobileImageUrl
          : category.imageUrl,
      );
    };

    report();
    media.addEventListener("change", report);

    return () => media.removeEventListener("change", report);
  }, [index, categories, onActiveImageUrlChange]);

  const goTo = useCallback((next: number) => {
    if (lockedRef.current) return;

    const clamped = Math.max(0, Math.min(totalRef.current - 1, next));
    if (clamped === indexRef.current) return;

    lockedRef.current = true;
    lastMoveAtRef.current = Date.now();
    setIndex(clamped);
  }, []);

  // Release the input lock once the slide has landed, so a deliberate scroll
  // always advances exactly one slide and never leaves a half-way state.
  useEffect(() => {
    if (!lockedRef.current) return;

    const timer = window.setTimeout(() => {
      lockedRef.current = false;
    }, TRANSITION_MS + 80);

    return () => window.clearTimeout(timer);
  }, [index]);

  // Wheel (mouse + trackpad): one burst of wheel events = one slide.
  useEffect(() => {
    let pendingDirection: 1 | -1 | null = null;
    let idleTimer: number | undefined;

    const flush = () => {
      idleTimer = undefined;
      const direction = pendingDirection;
      pendingDirection = null;

      if (direction === null || lockedRef.current) return;
      if (Date.now() - lastMoveAtRef.current < WHEEL_COOLDOWN_MS) return;

      goTo(indexRef.current + direction);
    };

    const clearIdleTimer = () => {
      if (idleTimer !== undefined) {
        window.clearTimeout(idleTimer);
        idleTimer = undefined;
      }
    };

    const onWheel = (event: WheelEvent) => {
      const target = event.target as HTMLElement | null;
      const footer = footerScroller(target);

      if (footer) {
        // The footer slide scrolls its own content while it still has room.
        // An upward gesture that has reached its very top comes back out to
        // the slider — that is what leaves the last slide again. Everything
        // else (scrolling the footer down, or down at its bottom) stays put.
        if (!(event.deltaY < 0 && isFooterEdge(footer, -1))) return;
      } else if (target?.closest(SCROLLABLE_SELECTOR)) {
        // The open menu / search / cart panel keeps its own gestures.
        return;
      }

      // The homepage is a fixed stack: never let the document scroll.
      event.preventDefault();

      if (lockedRef.current || Math.abs(event.deltaY) < 2) {
        pendingDirection = null;
        clearIdleTimer();
        return;
      }

      pendingDirection = event.deltaY > 0 ? 1 : -1;
      clearIdleTimer();
      idleTimer = window.setTimeout(flush, GESTURE_IDLE_MS);
    };

    window.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      window.removeEventListener("wheel", onWheel);
      clearIdleTimer();
    };
  }, [goTo]);

  // Keyboard.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      // An open drawer/popup/dialog owns the keys: never advance the slide
      // behind it, and never steal Space from its buttons.
      if (document.querySelector('[role="dialog"]')) return;

      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.isContentEditable ||
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT")
      ) {
        return;
      }

      // Space activates the focused control (dot rail, links) instead.
      if (event.key === " " && target?.tagName === "BUTTON") return;

      // Keys pressed while focus is inside the footer slide: the footer's own
      // scroll wins until it has none left in that direction, so a footer
      // taller than the viewport scrolls normally first and only then hands
      // the gesture back to the slider. When the footer fits the viewport
      // (the usual case) this never triggers, so every vertical key moves a
      // slide exactly as before.
      const footer = footerScroller(target);
      if (footer) {
        const direction =
          event.key === "ArrowUp" || event.key === "PageUp"
            ? -1
            : event.key === "ArrowDown" || event.key === "PageDown"
              ? 1
              : null;

        if (direction !== null && !isFooterEdge(footer, direction)) return;
      }

      switch (event.key) {
        case "ArrowDown":
        case "PageDown":
        case " ":
          event.preventDefault();
          goTo(indexRef.current + 1);
          break;
        case "ArrowUp":
        case "PageUp":
          event.preventDefault();
          goTo(indexRef.current - 1);
          break;
        case "Home":
          event.preventDefault();
          goTo(0);
          break;
        case "End":
          event.preventDefault();
          goTo(totalRef.current - 1);
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goTo]);

  // Touch swipe (one swipe = one slide).
  useEffect(() => {
    let startX = 0;
    let startY = 0;
    let tracking = false;
    /** The footer scroll box this gesture began in, if any. */
    let footer: HTMLElement | null = null;

    const onClick = (event: MouseEvent) => {
      if (!suppressClickRef.current) return;
      suppressClickRef.current = false;
      event.preventDefault();
      event.stopPropagation();
    };

    const onTouchStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch) return;

      const target = event.target as HTMLElement | null;

      // A swipe that begins inside a scrollable box (the open menu / search /
      // cart panel) belongs to that box, not to the slider. The footer slide
      // is the one exception: it is tracked here and hands the gesture back
      // in onTouchEnd once it has no scroll left in that direction.
      const footerStart = footerScroller(target);
      if (!footerStart && target?.closest(SCROLLABLE_SELECTOR)) {
        tracking = false;
        return;
      }

      startX = touch.clientX;
      startY = touch.clientY;
      footer = footerStart;
      tracking = true;
    };

    const onTouchEnd = (event: TouchEvent) => {
      if (!tracking) return;
      tracking = false;

      const footerScroll = footer;
      footer = null;

      const touch = event.changedTouches[0];
      if (!touch) return;

      const deltaY = startY - touch.clientY;
      const deltaX = startX - touch.clientX;

      // Any tracked drag — even one too small to change slides — must
      // not also land as a click on the full-screen category Link.
      // A real tap (barely any movement) still navigates.
      const dragged =
        Math.abs(deltaX) > TAP_TOLERANCE_PX ||
        Math.abs(deltaY) > TAP_TOLERANCE_PX;

      if (dragged) {
        suppressClickRef.current = true;
        window.setTimeout(() => {
          suppressClickRef.current = false;
        }, CLICK_SUPPRESS_MS);
      }

      const isSwipe =
        Math.abs(deltaY) >= SWIPE_THRESHOLD_PX &&
        Math.abs(deltaY) > Math.abs(deltaX);

      if (!isSwipe) return;

      const direction = deltaY > 0 ? 1 : -1;

      // The footer has already scrolled natively under this gesture, so it
      // always wins first: only a downward swipe it could not scroll itself
      // (finger dragging down = previous slide) leaves the footer. Any other
      // gesture stays inside it — including a downward swipe that the footer
      // is still scrolling, and every forward gesture on the last slide.
      if (
        footerScroll &&
        !(direction === -1 && isFooterEdge(footerScroll, -1))
      ) {
        return;
      }

      // Swallow the synthetic click that would otherwise follow the swipe.
      if (event.cancelable) event.preventDefault();
      goTo(indexRef.current + direction);
    };

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: false });
    window.addEventListener("click", onClick, { capture: true });

    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("click", onClick, { capture: true });
    };
  }, [goTo]);

  const duration = reduceMotion ? 0.01 : SLIDER_DURATION;
  const ease = SLIDER_EASE;
  const transition = { duration, ease };

  return (
    <div
      className="absolute inset-0 h-[100dvh] overflow-hidden overscroll-none"
      aria-roledescription="carousel"
      aria-label="Shop by category"
    >
      {categories.map((category, slideIndex) => {
        const isActive = slideIndex === index;
        const isPast = slideIndex < index;

        return (
          <motion.section
            key={category.id}
            className="absolute inset-0 h-[100dvh]"
            initial={false}
            animate={{ y: isPast ? "-100%" : isActive ? "0%" : "100%" }}
            transition={transition}
            style={{ zIndex: isActive ? 1 : 0, willChange: "transform" }}
            aria-hidden={!isActive}
            inert={!isActive}
          >
            <motion.div
              className="absolute inset-0"
              initial={false}
              animate={{ scale: isActive ? 1 : 1.06 }}
              transition={transition}
              style={{ willChange: "transform" }}
            >
              <picture className="absolute inset-0 block">
                {category.mobileImageUrl ? (
                  <source
                    media={MOBILE_MEDIA}
                    sizes="100vw"
                    srcSet={slideSrcSet(category.mobileImageUrl)}
                  />
                ) : null}
                {/*
                  Only the first slide gets `priority`. That marks it as the
                  LCP image (killing the "add loading='eager'" warning) and
                  emits a preload for the desktop candidate. On mobile the
                  <source> above can still win: the preload is a small extra
                  fetch, but slide 0 is the landing view, so prioritising it is
                  the right trade. Everything after slide 1 stays lazy.
                */}
                <Image
                  src={category.imageUrl}
                  alt=""
                  fill
                  priority={slideIndex === 0}
                  loading={slideIndex < EAGER_SLIDES ? "eager" : "lazy"}
                  fetchPriority={slideIndex < EAGER_SLIDES ? "high" : undefined}
                  unoptimized={isVectorImage(category.imageUrl)}
                  quality={IMAGE_QUALITY}
                  sizes="100vw"
                  className="object-cover"
                />
              </picture>
            </motion.div>

            <Link
              href={`/category/${category.slug}`}
              className="absolute inset-0 block"
              tabIndex={isActive ? 0 : -1}
            >
              <span className="sr-only">{category.name}</span>
            </Link>
          </motion.section>
        );
      })}

      <motion.section
        className="absolute inset-0 h-[100dvh]"
        initial={false}
        animate={{ y: index >= total - 1 ? "0%" : "100%" }}
        transition={transition}
        style={{
          zIndex: index === total - 1 ? 1 : 0,
          willChange: "transform",
        }}
        aria-hidden={index !== total - 1}
        inert={index !== total - 1}
        aria-label="Footer"
      >
        <SiteFooter
          categories={categories.map(({ name, slug }) => ({ name, slug }))}
          details={details}
        />
      </motion.section>

      {/*
        The rail's static white/black dots sit on the category images. The
        footer slide is white, so there the inactive dots switch to a hollow
        light-gray ring (the active dot stays solid black) — same rail, same
        mount, only the border colour fades, so nothing flickers when moving
        between the last category slide and the footer.
      */}
      <DotRail
        total={total}
        index={index}
        footerActive={index === total - 1}
        onSelect={goTo}
        labels={[...categories.map((category) => category.name), "Footer"]}
      />
    </div>
  );
}

type DotRailProps = {
  total: number;
  index: number;
  /** The white footer slide is the active one. */
  footerActive: boolean;
  onSelect: (next: number) => void;
  labels: string[];
};

/**
 * One transition for every dot state: the same 300ms colour fade the header
 * tone uses, now also covering the border so the hollow footer ring appears
 * and disappears smoothly.
 */
const DOT_TRANSITION =
  "transition-[background-color,border-color,width,height] duration-300";

function DotRail({
  total,
  index,
  footerActive,
  onSelect,
  labels,
}: DotRailProps) {
  return (
    <div className="absolute top-1/2 right-1 z-20 -translate-y-1/2 sm:right-3 md:right-5">
      <ul className="flex flex-col items-center">
        {Array.from({ length: total }, (_, dotIndex) => {
          const isActive = dotIndex === index;

          return (
            <li key={dotIndex}>
              <button
                type="button"
                onClick={() => onSelect(dotIndex)}
                aria-label={`Go to ${labels[dotIndex]}`}
                aria-current={isActive ? "true" : undefined}
                className="flex h-11 w-11 items-center justify-center focus-visible:outline-2 focus-visible:outline-plum focus-visible:outline-offset-2"
              >
                <span
                  className={
                    // Static Sana-style rail: white dots, black active dot. It
                    // deliberately does NOT follow the adaptive header tone.
                    isActive
                      ? `block h-2.5 w-2.5 rounded-full bg-black ${DOT_TRANSITION} md:h-3 md:w-3`
                      : footerActive
                        ? // White footer: a transparent fill alone would vanish,
                          // so the inactive dots become hollow rings.
                          `block h-1.5 w-1.5 rounded-full border border-black/25 bg-white ${DOT_TRANSITION} hover:border-black/40 md:h-2 md:w-2`
                        : // Image slides, unchanged: the border is transparent,
                          // so the white dot looks exactly as it always did.
                          `block h-1.5 w-1.5 rounded-full border border-transparent bg-white ${DOT_TRANSITION} hover:bg-white/70 md:h-2 md:w-2`
                  }
                />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}