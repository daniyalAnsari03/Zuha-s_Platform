"use client";

import { motion, useReducedMotion } from "framer-motion";
import Image, { getImageProps } from "next/image";
import Link from "next/link";
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import SiteFooter from "@/components/layout/SiteFooter";
import type { HomeCategorySlide } from "@/lib/home-data";
import { scheduleIdle } from "@/lib/idle";
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

/** Snap with no animation: an in-between slide on a multi-step jump. */
const INSTANT_TRANSITION = { duration: 0 };

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

/**
 * True on touch-first devices. The full-screen image zoom (the subtle 1.06
 * depth on the slide being covered) is a transform on a viewport-sized layer,
 * which is the most expensive thing the cover animation can do on a phone GPU.
 * On touch it is skipped entirely; a fine pointer keeps it exactly as before.
 *
 * Starts `false` so server and first client render agree; the media query is
 * only read after mount (and re-read on change), so there is never a hydration
 * mismatch.
 */
function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(hover: none), (pointer: coarse)");
    const update = () => setCoarse(query.matches);

    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return coarse;
}

/**
 * Every slide's rest position is `y: 0` for the active slide and every slide
 * before it, and `y: 100%` for the slides still waiting below. That is what
 * turns the stack into a *cover*: the next slide rises from the bottom over the
 * one that is showing (which stays put), and going back up the top slide slides
 * back down to reveal the one already in place beneath it.
 *
 * `fromIndex` is the slide a transition started on (`null` once it has landed).
 * A single gesture or a dot jump of any distance is one cover animation: the
 * target is the only slide that moves. On a multi-step jump the slides strictly
 * between the two ends are `skip`ped — they snap straight to their rest
 * position (behind the base, so never seen) instead of animating through.
 */
type SlideMotion = {
  y: string;
  zIndex: number;
  /** Snap with no animation: an in-between slide on a multi-step jump. */
  skip: boolean;
};

function CategorySlider({
  categories,
  details,
  onFooterActiveChange,
  onActiveImageUrlChange,
}: CategorySliderProps) {
  const reduceMotion = useReducedMotion();
  const zoomEnabled = !useCoarsePointer();
  const total = categories.length + 1; // category slides + the footer slide
  const totalRef = useRef(total);
  const indexRef = useRef(0);
  const lockedRef = useRef(false);
  const lastMoveAtRef = useRef(0);

  const [index, setIndex] = useState(0);
  /** The slide the current cover animation started from; `null` once landed. */
  const [fromIndex, setFromIndex] = useState<number | null>(null);

  const suppressClickRef = useRef(false);

  /**
   * The mounted slide elements, by slide index. Used only to walk the DOM once
   * per landed slide and decode the neighbours' images ahead of time.
   */
  const slideRefs = useRef<Array<HTMLElement | null>>([]);

  const registerSlide = useCallback((slide: number, element: HTMLElement | null) => {
    slideRefs.current[slide] = element;
  }, []);

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
   * Decode the current slide and its immediate neighbours once the current one
   * has landed. Decoded bitmaps are what the compositor needs during the cover;
   * doing it here (current + idle for the neighbours) means the transition
   * itself never triggers a full-size image decode on the main thread.
   */
  const decodeSlide = useCallback((slide: number) => {
    const target = slideRefs.current[slide];
    const image = target?.querySelector("img");
    if (image && typeof image.decode === "function" && image.currentSrc) {
      void image.decode().catch(() => {});
    }
  }, []);

  useEffect(() => {
    decodeSlide(index);

    let cancelled = false;
    scheduleIdle(() => {
      if (cancelled) return;
      decodeSlide(index + 1);
      decodeSlide(index - 1);
    });

    return () => {
      cancelled = true;
    };
  }, [index, decodeSlide]);

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
    // Report the target straight away so the dot rail, the adaptive header tone
    // and the footer/navbar visibility all switch in sync with the animation.
    setFromIndex(indexRef.current);
    indexRef.current = clamped;
    setIndex(clamped);
  }, []);

  // Release the input lock once the slide has landed, so a deliberate scroll
  // always advances exactly one slide and never leaves a half-way state.
  useEffect(() => {
    if (!lockedRef.current) return;

    const timer = window.setTimeout(() => {
      lockedRef.current = false;
      setFromIndex(null);
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
  const footerIndex = total - 1;

  const footerCategories = useMemo(
    () => categories.map(({ name, slug }) => ({ name, slug })),
    [categories],
  );

  /**
   * One slide's cover state. See `SlideMotion` for the model:
   * - descending (`from < index`): the target covers the one that was showing;
   * - ascending (`from > index`): the target is revealed beneath the leaving top;
   * - anything strictly between the two ends is `skip`ped (snapped, not animated).
   */
  const slideMotion = useCallback((slide: number): SlideMotion => {
    if (fromIndex === null) {
      return {
        y: slide <= index ? "0%" : "100%",
        zIndex: slide === index ? 1 : 0,
        skip: false,
      };
    }

    if (index > fromIndex) {
      // Descending: the target rises over the slide that was showing.
      if (slide === index) return { y: "0%", zIndex: 3, skip: false };
      if (slide === fromIndex) return { y: "0%", zIndex: 2, skip: false };
      if (slide > fromIndex && slide < index) {
        return { y: "0%", zIndex: 0, skip: true };
      }
      return {
        y: slide <= index ? "0%" : "100%",
        zIndex: 1,
        skip: false,
      };
    }

    // Ascending: the leaving top slides back down over the target below it.
    if (slide === fromIndex) return { y: "100%", zIndex: 3, skip: false };
    if (slide === index) return { y: "0%", zIndex: 2, skip: false };
    if (slide > index && slide < fromIndex) {
      return { y: "100%", zIndex: 0, skip: true };
    }
    return { y: slide <= index ? "0%" : "100%", zIndex: 1, skip: false };
  }, [fromIndex, index]);

  const footerMotion = slideMotion(footerIndex);

  return (
    <div
      className="absolute inset-0 h-full overflow-hidden overscroll-none"
      aria-roledescription="carousel"
      aria-label="Shop by category"
    >
      {categories.map((category, slideIndex) => {
        const state = slideMotion(slideIndex);

        return (
          <CategorySlide
            key={category.id}
            category={category}
            slideIndex={slideIndex}
            y={state.y}
            zIndex={state.zIndex}
            skip={state.skip}
            visible={isSlidePainted(slideIndex, index, fromIndex, state.skip)}
            animating={
              fromIndex !== null &&
              (slideIndex === index || slideIndex === fromIndex)
            }
            isActive={slideIndex === index}
            duration={duration}
            zoomEnabled={zoomEnabled}
            registerSlide={registerSlide}
          />
        );
      })}

      <FooterSlide
        slideIndex={footerIndex}
        categories={footerCategories}
        details={details}
        y={footerMotion.y}
        zIndex={footerMotion.zIndex}
        skip={footerMotion.skip}
        visible={isSlidePainted(footerIndex, index, fromIndex, footerMotion.skip)}
        animating={
          fromIndex !== null &&
          (footerIndex === index || footerIndex === fromIndex)
        }
        isActive={footerIndex === index}
        duration={duration}
        registerSlide={registerSlide}
      />

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

/**
 * A slide paints only while it is the active one or the one being covered —
 * every other slide is mounted (so its image still loads and its position is
 * kept) but `visibility: hidden`, so the compositor never rasterises a
 * viewport-sized layer that cannot be seen. `skip` slides are always hidden.
 */
function isSlidePainted(
  slide: number,
  index: number,
  fromIndex: number | null,
  skip: boolean,
): boolean {
  return !skip && (slide === index || slide === fromIndex);
}

/**
 * Memoised so the homepage's own re-renders (the adaptive header tone, the
 * footer flag) never re-render the slider and its full-screen image tree.
 * Every prop is stable: the arrays/objects come from the server, and the two
 * callbacks are `useCallback`-wrapped in `HomeExperience`.
 */
export default memo(CategorySlider);

type CategorySlideProps = {
  category: HomeCategorySlide;
  slideIndex: number;
  y: string;
  zIndex: number;
  skip: boolean;
  visible: boolean;
  animating: boolean;
  isActive: boolean;
  duration: number;
  zoomEnabled: boolean;
  registerSlide: (slide: number, element: HTMLElement | null) => void;
};

/**
 * One category slide, memoised so a slide change re-renders only the two slides
 * the cover actually touches. Every prop is a primitive or a stable reference
 * (the category object, the register callback), so the untouched slides — and
 * their full-screen `<Image>` trees — are skipped entirely.
 */
const CategorySlide = memo(function CategorySlide({
  category,
  slideIndex,
  y,
  zIndex,
  skip,
  visible,
  animating,
  isActive,
  duration,
  zoomEnabled,
  registerSlide,
}: CategorySlideProps) {
  return (
    <motion.section
      ref={(element) => registerSlide(slideIndex, element)}
      // `touch-none` stops the browser from starting its own pan/overscroll on
      // the slide while a swipe is being handled by the slider. The footer
      // slide (a sibling, not a descendant) keeps its own native scrolling.
      className="absolute inset-0 h-full touch-none"
      initial={false}
      animate={{ y }}
      transition={skip ? INSTANT_TRANSITION : { duration, ease: SLIDER_EASE }}
      style={{
        zIndex,
        // Hidden slides keep their layout and decoded image but never paint.
        visibility: visible ? "visible" : "hidden",
        // Promote to a compositor layer only while this slide is animating;
        // pinning every full-screen slide to its own layer is what drops frames
        // on older phones.
        willChange: animating ? "transform" : "auto",
      }}
      aria-hidden={!isActive}
      inert={!isActive}
    >
      <motion.div
        className="absolute inset-0"
        initial={false}
        // The subtle depth zoom is desktop-only (see `useCoarsePointer`).
        animate={{ scale: zoomEnabled && !isActive ? 1.06 : 1 }}
        transition={skip ? INSTANT_TRANSITION : { duration, ease: SLIDER_EASE }}
        style={{ willChange: animating && zoomEnabled ? "transform" : "auto" }}
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
            Only the first slide gets `priority`. That marks it as the LCP image
            (killing the "add loading='eager'" warning) and emits a preload for
            the desktop candidate. On mobile the <source> above can still win:
            the preload is a small extra fetch, but slide 0 is the landing view,
            so prioritising it is the right trade. The next slide is eager too;
            everything after stays lazy.
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
});

type FooterSlideProps = {
  slideIndex: number;
  categories: { name: string; slug: string }[];
  details: StoreDetails;
  y: string;
  zIndex: number;
  skip: boolean;
  visible: boolean;
  animating: boolean;
  isActive: boolean;
  duration: number;
  registerSlide: (slide: number, element: HTMLElement | null) => void;
};

/** The footer slide; memoised like the category slides. */
const FooterSlide = memo(function FooterSlide({
  slideIndex,
  categories,
  details,
  y,
  zIndex,
  skip,
  visible,
  animating,
  isActive,
  duration,
  registerSlide,
}: FooterSlideProps) {
  return (
    <motion.section
      ref={(element) => registerSlide(slideIndex, element)}
      className="absolute inset-0 h-full"
      initial={false}
      animate={{ y }}
      transition={skip ? INSTANT_TRANSITION : { duration, ease: SLIDER_EASE }}
      style={{
        zIndex,
        visibility: visible ? "visible" : "hidden",
        willChange: animating ? "transform" : "auto",
      }}
      aria-hidden={!isActive}
      inert={!isActive}
      aria-label="Footer"
    >
      <SiteFooter categories={categories} details={details} />
    </motion.section>
  );
});

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
