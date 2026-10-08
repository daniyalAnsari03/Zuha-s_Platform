"use client";

import { motion, useReducedMotion } from "framer-motion";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";

import { useCart } from "@/components/cart/CartProvider";
import { BasketIcon, SearchIcon } from "@/components/icons";
import MenuPanel from "@/components/layout/MenuPanel";
import AuthNavLink from "@/components/layout/AuthNavLink";
import MenuMorphIcon from "@/components/ui/MenuMorphIcon";
import PopOnChange from "@/components/ui/PopOnChange";
import { CONTENT_CONTAINER } from "@/lib/content-container";
import {
  HEADER_TONE_FALLBACK,
  HEADER_TONE_TRANSITION,
} from "@/lib/header-tone";
import { LOGO_CLASS } from "@/lib/logo";
import {
  BADGE_POP_FROM,
  BADGE_POP_PEAK,
  TRANSITION_BADGE_POP,
  TRANSITION_SLOW,
} from "@/lib/motion";
import type { MenuCategory } from "@/lib/menu-data";

/**
 * Both popups hang off the navbar and render nothing until they are opened, so
 * their code (search results, cart rows, the popover motion) is a separate
 * chunk per popup instead of riding along with every page's header.
 */
const CartPopup = dynamic(() => import("@/components/cart/CartPopup"), {
  ssr: false,
});

const SearchPopup = dynamic(() => import("@/components/search/SearchPopup"), {
  ssr: false,
});


type NavbarProps = {
  hidden: boolean;
  /**
   * `overlay` (homepage): transparent, floats over the slides, glyphs take the
   * adaptive tone colour computed from the active slide and the bar itself takes
   * no layout space.
   * `solid` (every white page): plain black chrome sitting in normal flow above
   * the content, so nothing depends on blend modes. Deliberately has no border,
   * shadow or background of its own - black glyphs straight onto the white page.
   */
  variant?: "overlay" | "solid";
  /**
   * Navigation for the hamburger menu. Fetched by the route shell and passed in
   * so the drawer is always the live category tree, including on the homepage.
   */
  menuCategories?: MenuCategory[];
  /**
   * Homepage only: the colour shared by the hamburger, logo and search/login/
   * cart icons over the slides. It comes from `lib/header-tone` and changes with
   * the active slide; the default is the colour shown before the first
   * measurement lands.
   */
  overlayTone?: string;
};

type PanelKind = "menu" | "search" | "cart";

/** The panel plus the route and chrome state it was opened on. */
type PanelState = {
  kind: PanelKind;
  pathname: string;
  hidden: boolean;
};

// Pointer gating is added separately: over the footer slide the bar is faded
// out, and a child that re-enables pointer events would stay clickable while
// invisible.
const OVERLAY_ICON_BUTTON =
  "relative flex h-11 w-11 items-center justify-center rounded-full text-inherit transition-opacity hover:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current";

const SOLID_ICON_BUTTON =
  "pointer-events-auto relative flex h-11 w-11 items-center justify-center rounded-full text-black transition-colors hover:text-plum focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum";

/**
 * The navbar row is deliberately compact: the ticker sits above it and the
 * page content below it, and both distances are part of the spec (see the
 * spacing note in AGENTS.md). The row is tall enough for the h-11 icon
 * buttons and the logo, and nothing more.
 */
const NAV_HEIGHT = "h-12 md:h-[59px]";

/**
 * The three panels below the navbar (menu drawer, search, cart) are popups, not
 * pages: only one is ever open, and each closes on outside click, on Escape and
 * whenever the route changes. They render through a portal so the homepage's
 * blend-mode chrome cannot tint them.
 */
export default function Navbar({
  hidden,
  variant = "overlay",
  menuCategories = [],
  overlayTone = HEADER_TONE_FALLBACK,
}: NavbarProps) {
  const reduceMotion = useReducedMotion();
  const pathname = usePathname();
  const headerRef = useRef<HTMLElement>(null);
  const [panel, setPanel] = useState<PanelState | null>(null);

  const { count } = useCart();
  const isOverlay = variant === "overlay";
  // No pointer events while the bar is faded out over the footer slide.
  const glyphPointerEvents = isOverlay && hidden ? "pointer-events-none" : "pointer-events-auto";
  const iconButtonClass = isOverlay
    ? `${OVERLAY_ICON_BUTTON} ${glyphPointerEvents}`
    : SOLID_ICON_BUTTON;
  const logoColor = isOverlay ? "text-inherit" : "text-black";

  /*
   * A panel belongs to the page it was opened on: deriving the open panel from
   * the current route and chrome state means a navigation - or the chrome hiding
   * itself over the homepage footer slide - dismisses it automatically, with no
   * effect and no flash of a panel left hanging over the new page.
   */
  const openPanel: PanelKind | null =
    panel && panel.pathname === pathname && !panel.hidden ? panel.kind : null;

  const toggle = (kind: PanelKind) => {
    setPanel((current) =>
      current?.kind === kind &&
      current.pathname === pathname &&
      current.hidden === hidden
        ? null
        : { kind, pathname, hidden },
    );
  };

  const close = () => setPanel(null);

  return (
    <>
      <header
        ref={headerRef}
        style={
          isOverlay
            ? { color: overlayTone, transition: HEADER_TONE_TRANSITION }
            : undefined
        }
        className={
          isOverlay
            ? `pointer-events-none absolute inset-x-0 top-10 z-30 ${NAV_HEIGHT}`
            : `relative z-30 ${NAV_HEIGHT} shrink-0 border-0 bg-transparent shadow-none`
        }
      >
        <motion.nav
          aria-label="Primary"
          className={`${CONTENT_CONTAINER} flex ${NAV_HEIGHT} items-center justify-between`}
          initial={false}
animate={{ opacity: hidden ? 0 : 1, y: hidden ? -24 : 0 }}
          // Faded-out controls must not stay clickable over the footer slide.
          style={{ pointerEvents: hidden ? "none" : undefined }}
          transition={reduceMotion ? { duration: 0.01 } : TRANSITION_SLOW}
        >
          <button
            type="button"
            aria-label="Open menu"
            aria-expanded={openPanel === "menu"}
            onClick={() => toggle("menu")}
            className={iconButtonClass}
          >
            <MenuMorphIcon open={openPanel === "menu"} />
          </button>

          <Link
            href="/"
            aria-label="ZUHA'S home"
            onClick={close}
            className={`${glyphPointerEvents} ${LOGO_CLASS} transition-opacity hover:opacity-70 ${logoColor}`}
          >
            ZUHA&apos;S
          </Link>

          <div className="flex items-center">
            <button
              type="button"
              aria-label="Search"
              aria-expanded={openPanel === "search"}
              onClick={() => toggle("search")}
              className={iconButtonClass}
            >
              <SearchIcon />
            </button>
{/*
              Phase 7: the same icon leads to /login when signed out and
              /account once there is a session. It takes the bar's own icon
              styling so it stays legible over the homepage slides.
            */}
            <AuthNavLink className={iconButtonClass} />
            <button
              type="button"
              aria-label={count > 0 ? `Cart, ${count} items` : "Cart, empty"}
              aria-expanded={openPanel === "cart"}
              onClick={() => toggle("cart")}
              className={iconButtonClass}
            >
<BasketIcon />
              <PopOnChange
                trigger={count}
                from={BADGE_POP_FROM}
                peak={BADGE_POP_PEAK}
                transition={TRANSITION_BADGE_POP}
                className="pointer-events-none absolute top-0.5 right-0.5 flex"
              >
                {count > 0 ? (
                  <span
                    aria-hidden="true"
                    className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-plum px-1 text-[10px] leading-none font-medium text-white"
                  >
                    {count > 99 ? "99+" : count}
                  </span>
                ) : null}
              </PopOnChange>
            </button>
          </div>
        </motion.nav>
      </header>

      <MenuPanel
        open={openPanel === "menu"}
        onClose={close}
        anchorRef={headerRef}
        categories={menuCategories}
      />

      <SearchPopup
        open={openPanel === "search"}
        onClose={close}
        anchorRef={headerRef}
      />

      <CartPopup
        open={openPanel === "cart"}
        onClose={close}
        anchorRef={headerRef}
      />
    </>
  );
}



