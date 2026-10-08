/**
 * Shared motion values for the whole site.
 *
 * One place for the durations, easings and reusable Framer Motion variants so
 * every popup, drawer, menu, dialog and hover effect feels like the same site:
 * everything on `cubic-bezier(0.22, 1, 0.36, 1)` (an easy ease-out), transform
 * and opacity only (the GPU-friendly pair). Hover micro-interactions stay short
 * (150-350ms); drawers, popups and modals breathe a little more (400-600ms).
 *
 * Reduced motion is handled here twice over: components read
 * `useReducedMotion()` to shorten hard-coded `transition`s, and
 * `MotionConfig reducedMotion="user"` (see `MotionProvider`) plus the CSS
 * `@media (prefers-reduced-motion: reduce)` block in `globals.css` collapse the
 * variant-based animations to a simple fade (transforms are dropped, opacity
 * kept). Never animate width/height/top/left/margins/box-shadow here.
 */

import type { Transition, Variants } from "framer-motion";

/** Entrance ease: long soft deceleration. */
export const EASE_ENTER: [number, number, number, number] = [0.22, 1, 0.36, 1];

/** Exit ease: a faster ease-in, so things leave before the eye can linger. */
export const EASE_EXIT: [number, number, number, number] = [0.4, 0, 1, 1];

/** The shared durations, in seconds. */
export const MOTION_DURATION = {
  /** Micro-interactions: toolbar hovers, focus rings, quick fades. */
  fast: 0.15,
  /** Hover reveals, popovers, icon morphs, heart/badge pops. */
  hover: 0.25,
  /** Drawers and panels, with their backdrops. */
  medium: 0.32,
  /** Navbar chrome fade when the homepage reaches the footer slide. */
  slow: 0.35,
  /** Product-card gallery hover: the premium two-image swap / single-image zoom. */
  imageSwap: 0.8,
  /** "Add to Cart" bar: slides up from below the card image on hover. */
  addToCartReveal: 0.45,
  /** Heart / eye icons: fade + short slide on hover, staggered. */
  iconReveal: 0.35,
  /** The small stagger between the two icon controls when they reveal. */
  iconRevealStagger: 0.06,

  /** Menu / filter drawers: slide + fade in, their backdrop, and the close. */
  drawer: 0.6,
  drawerBackdrop: 0.5,
  drawerExit: 0.35,
  /** Menu items: each item, the stagger between them, and their start delay. */
  menuItem: 0.5,
  menuItemStagger: 0.08,
  menuItemDelay: 0.2,
  /** Menu accordion (the Women's / Men's / Kid's sub-category list). */
  accordion: 0.4,
  /** Search / cart popups: the panel, the items, their stagger, and the close. */
  popup: 0.4,
  popupItem: 0.4,
  popupItemStagger: 0.06,
  popupExit: 0.25,
  /** The cart-count badge pop. */
  badgePop: 0.5,
  /** Quick-view modal: the panel, its backdrop, and the close. */
  modal: 0.5,
  modalBackdrop: 0.4,
  modalExit: 0.3,
} as const;

/** Card hover zoom amount: the second image settles 1.08 -> 1, the single-image zoom scales to 1.08. */
export const CARD_IMAGE_SCALE = 1.08;

/** Short slide (px) the heart/eye icons travel while they fade in. */
export const CARD_ICON_SLIDE_PX = 8;

/**
 * The homepage category slider's cover-scroll. Deliberately a firmer
 * ease-in-out than `EASE_ENTER`: full-screen slides need weight at both ends
 * so one gesture always lands cleanly on one slide.
 */
export const SLIDER_DURATION = 0.85;
export const SLIDER_EASE: [number, number, number, number] = [0.76, 0, 0.24, 1];

/** The product-card gallery hover, both directions, mirrors the CSS in globals.css. */
export const TRANSITION_IMAGE_SWAP: Transition = {
  duration: MOTION_DURATION.imageSwap,
  ease: EASE_ENTER,
};

/** The "Add to Cart" bar's slide-up reveal on card hover. */
export const TRANSITION_ADD_TO_CART_REVEAL: Transition = {
  duration: MOTION_DURATION.addToCartReveal,
  ease: EASE_ENTER,
};

/** One icon's fade-and-slide reveal; the stagger between the two is `MOTION_DURATION.iconRevealStagger`. */
export const TRANSITION_ICON_REVEAL: Transition = {
  duration: MOTION_DURATION.iconReveal,
  ease: EASE_ENTER,
};

/** Drawer entrances/exits (menu + filter), and their dimmed backdrop. */
export const TRANSITION_DRAWER: Transition = {
  duration: MOTION_DURATION.drawer,
  ease: EASE_ENTER,
};

export const TRANSITION_DRAWER_BACKDROP: Transition = {
  duration: MOTION_DURATION.drawerBackdrop,
  ease: EASE_ENTER,
};

export const TRANSITION_DRAWER_EXIT: Transition = {
  duration: MOTION_DURATION.drawerExit,
  ease: EASE_ENTER,
};

/** A menu item's reveal, and the accordion open/close it sits inside. */
export const TRANSITION_MENU_ITEM: Transition = {
  duration: MOTION_DURATION.menuItem,
  ease: EASE_ENTER,
};

export const TRANSITION_ACCORDION: Transition = {
  duration: MOTION_DURATION.accordion,
  ease: EASE_ENTER,
};

/** The navbar search / cart popups: panel, inner items, and the close. */
export const TRANSITION_POPUP: Transition = {
  duration: MOTION_DURATION.popup,
  ease: EASE_ENTER,
};

export const TRANSITION_POPUP_ITEM: Transition = {
  duration: MOTION_DURATION.popupItem,
  ease: EASE_ENTER,
};

export const TRANSITION_POPUP_EXIT: Transition = {
  duration: MOTION_DURATION.popupExit,
  ease: EASE_ENTER,
};

/** A short opacity fade for the transient messages inside the search popup. */
export const TRANSITION_POPUP_FADE: Transition = {
  duration: MOTION_DURATION.popupExit,
  ease: EASE_ENTER,
};

/** Quick-view modal: the panel, its backdrop, and the close. */
export const TRANSITION_MODAL: Transition = {
  duration: MOTION_DURATION.modal,
  ease: EASE_ENTER,
};

export const TRANSITION_MODAL_BACKDROP: Transition = {
  duration: MOTION_DURATION.modalBackdrop,
  ease: EASE_ENTER,
};

export const TRANSITION_MODAL_EXIT: Transition = {
  duration: MOTION_DURATION.modalExit,
  ease: EASE_ENTER,
};

/** Scale stops for the cart-count badge pop: 1 -> 1.3 -> 1. */
export const BADGE_POP_FROM = 1;
export const BADGE_POP_PEAK = 1.3;

export const TRANSITION_BADGE_POP: Transition = {
  duration: MOTION_DURATION.badgePop,
  ease: "easeOut",
  times: [0, 0.5, 1],
};

export const TRANSITION_FAST: Transition = {
  duration: MOTION_DURATION.fast,
  ease: EASE_EXIT,
};

export const TRANSITION_ENTER: Transition = {
  duration: MOTION_DURATION.medium,
  ease: EASE_ENTER,
};

export const TRANSITION_SLOW: Transition = {
  duration: MOTION_DURATION.slow,
  ease: EASE_ENTER,
};

export const TRANSITION_HOVER: Transition = {
  duration: MOTION_DURATION.hover,
  ease: EASE_ENTER,
};

export const TRANSITION_POP: Transition = {
  duration: MOTION_DURATION.hover,
  ease: "easeOut",
};

/** Simple opacity fade, used for placeholders and transient states. */
export const TRANSITION_BACKDROP: Transition = {
  duration: 0.2,
  ease: EASE_ENTER,
};

export const TRANSITION_POPOVER: Transition = {
  duration: 0.2,
  ease: EASE_ENTER,
};

export const fadeVariant: Variants = {
  hidden: { opacity: 0, transition: TRANSITION_POPUP_FADE },
  show: { opacity: 1, transition: TRANSITION_POPUP_FADE },
  exit: { opacity: 0, transition: TRANSITION_POPUP_EXIT },
};

/** Fade up from a little below: search results, cart lines. */
export const fadeUpVariant: Variants = {
  hidden: { opacity: 0, y: 8, transition: TRANSITION_POPUP_EXIT },
  show: {
    opacity: 1,
    y: 0,
    transition: TRANSITION_POPUP_ITEM,
  },
  exit: { opacity: 0, y: 8, transition: TRANSITION_POPUP_EXIT },
};

/**
 * A single menu item. Same fade-up as the popups, but slower and paired with
 * the drawer's own timing, so the drawer arrives first and the items follow.
 */
export const menuItemVariant: Variants = {
  hidden: { opacity: 0, y: 8, transition: TRANSITION_DRAWER_EXIT },
  show: {
    opacity: 1,
    y: 0,
    transition: TRANSITION_MENU_ITEM,
  },
  exit: { opacity: 0, y: 8, transition: TRANSITION_DRAWER_EXIT },
};

/**
 * A dimmed backdrop for the drawers (menu + filter). Keeps a plain fade so the
 * colour never interpolates while the panel itself is transforming.
 */
export const backdropVariant: Variants = {
  hidden: { opacity: 0, transition: TRANSITION_DRAWER_EXIT },
  show: { opacity: 1, transition: TRANSITION_DRAWER_BACKDROP },
  exit: { opacity: 0, transition: TRANSITION_DRAWER_EXIT },
};

/** The dimmed backdrop for the centred modals (quick view, team, admin). */
export const modalBackdropVariant: Variants = {
  hidden: { opacity: 0, transition: TRANSITION_MODAL_EXIT },
  show: { opacity: 1, transition: TRANSITION_MODAL_BACKDROP },
  exit: { opacity: 0, transition: TRANSITION_MODAL_EXIT },
};

/** A drawer (or full-screen sheet) that slides in from the left and fades in. */
export const drawerLeftVariant: Variants = {
  hidden: { x: "-100%", opacity: 0, transition: TRANSITION_DRAWER_EXIT },
  show: { x: 0, opacity: 1, transition: TRANSITION_DRAWER },
  exit: { x: "-100%", opacity: 0, transition: TRANSITION_DRAWER_EXIT },
};

/**
 * A centred modal or popup: fades in with a slight scale-down and a small upward
 * slide, and leaves in reverse.
 */
export const modalVariant: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.96,
    y: 12,
    transition: TRANSITION_MODAL_EXIT,
  },
  show: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: TRANSITION_MODAL,
  },
  exit: {
    opacity: 0,
    scale: 0.96,
    y: 12,
    transition: TRANSITION_MODAL_EXIT,
  },
};

/** A dropdown below the navbar: a small downward drop onto the page. */
export const popoverVariant: Variants = {
  hidden: { opacity: 0, y: -12, transition: TRANSITION_POPUP_EXIT },
  show: { opacity: 1, y: 0, transition: TRANSITION_POPUP },
  exit: { opacity: 0, y: -12, transition: TRANSITION_POPUP_EXIT },
};

/** Children appear one at a time; `stagger` is the seconds between them. */
export function staggerContainer(
  stagger = 0.04,
  delayChildren = 0,
): Variants {
  return {
    hidden: {},
    show: { transition: { staggerChildren: stagger, delayChildren } },
  };
}

/** The accordion chevron: a smooth 180deg swing. */
export const chevronVariant: Variants = {
  closed: { rotate: 0 },
  open: { rotate: 180 },
};

/** The hamburger-to-X morph: one curve, ~250ms. */
export const MENU_ICON_MORPH: { transition: Transition } = {
  transition: { duration: 0.25, ease: EASE_ENTER },
};

/** A quick "pop" for the cart badge and the wishlist heart when they toggle. */
export const POP_TRANSITION: Transition = {
  duration: 0.25,
  ease: "easeOut",
  times: [0, 0.5, 1],
};