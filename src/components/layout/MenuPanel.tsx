"use client";

import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from "framer-motion";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import {
  ChevronDownIcon,
  CloseIcon,
  HeartIcon,
  UserIcon,
} from "@/components/icons";
import BodyPortal from "@/components/layout/BodyPortal";
import { useCurrentUser } from "@/components/auth/useCurrentUser";
import {
  MOTION_DURATION,
  TRANSITION_ACCORDION,
  backdropVariant,
  chevronVariant,
  drawerLeftVariant,
  menuItemVariant,
  staggerContainer,
} from "@/lib/motion";
import type { MenuCategory } from "@/lib/menu-data";

type MenuPanelProps = {
  open: boolean;
  onClose: () => void;
  /** Navbar header, so a click on the hamburger itself is not an outside click. */
  anchorRef: React.RefObject<HTMLElement | null>;
  categories: MenuCategory[];
};

/**
 * The hamburger menu: a drawer from the left holding exactly the store
 * navigation - every active top-level category, then Account and Wishlist.
 *
 * Categories that have sub-categories are an accordion: the row toggles them
 * open right beneath it and only one is open at a time. Categories without any
 * (Bag's / Jewellery, or one the admin emptied) stay plain links.
 *
* Everything comes from the `categories` / `sub_categories` tables, so whatever
 * the admin adds or removes shows up here without a code change. Contact is
 * deliberately absent: it only ever lives in the footer.
 *
 * Closes on outside click, on Escape and on a route change, and locks the page
 * behind it while open.
 */
export default function MenuPanel({
  open,
  onClose,
  anchorRef,
  categories,
}: MenuPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    // Captured while the drawer is open: the cleanup then focuses the very
    // hamburger that is still on screen.
    const trigger = anchorRef.current?.querySelector<HTMLElement>("button");

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (panelRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;

      onClose();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    const { body } = document;
    const previousOverflow = body.style.overflow;
    body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      body.style.overflow = previousOverflow;

      // Hand focus back to the hamburger that opened the drawer.
      trigger?.focus();
    };
  }, [open, onClose, anchorRef]);

  return (
    <BodyPortal>
      <AnimatePresence>
        {open ? (
          <>
<motion.div
              key="menu-backdrop"
              className="fixed inset-0 z-40 bg-black/45"
              variants={backdropVariant}
              initial="hidden"
              animate="show"
              exit="exit"
              onClick={onClose}
            />

            <motion.div
              key="menu-drawer"
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-label="Menu"
              className="fixed inset-y-0 left-0 z-40 flex w-full flex-col bg-white sm:w-[360px] sm:shadow-[0_0_48px_rgba(0,0,0,0.18)]"
              variants={drawerLeftVariant}
              initial="hidden"
              animate="show"
              exit="exit"
            >
              <header className="flex h-16 shrink-0 items-center justify-end border-b border-black/10 px-4 sm:h-20 sm:px-6">
                <button
                  ref={closeButtonRef}
                  type="button"
                  onClick={onClose}
                  aria-label="Close menu"
                  className="flex h-11 w-11 items-center justify-center text-black transition-colors hover:text-plum focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum"
                >
                  <CloseIcon />
                </button>
              </header>

              <MenuList categories={categories} onClose={onClose} />
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </BodyPortal>
  );
}

type MenuListProps = {
  categories: MenuCategory[];
  onClose: () => void;
};

/**
 * The navigation list inside the drawer.
 *
 * Only mounted while the drawer is open, so the accordion starts fully
 * collapsed on every open without needing a reset effect. Holding a single id
 * (or `null`) is what makes it an accordion: opening a second category closes
 * the first, and tapping the open one closes it.
 */
function MenuList({ categories, onClose }: MenuListProps) {
  const reduceMotion = useReducedMotion();
  const { user } = useCurrentUser();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Same rule as the navbar icon: the account area for a session, the sign-in
  // page for a guest.
  const accountHref = user ? "/account" : "/login";

  const toggle = (categoryId: string) => {
    setExpandedId((current) => (current === categoryId ? null : categoryId));
  };

  // The items fade and slide up one after another, starting once the drawer is
  // mostly in. Reduced motion drops the transform and the stagger.
  const container = reduceMotion
    ? staggerContainer(0, 0)
    : staggerContainer(
        MOTION_DURATION.menuItemStagger,
        MOTION_DURATION.menuItemDelay,
      );

  return (
    <motion.nav
      aria-label="Store"
      variants={container}
      initial="hidden"
      animate="show"
      className="flex-1 overflow-y-auto overscroll-contain px-4 py-6 font-normal sm:px-6"
      data-scrollable
    >
      <ul className="flex flex-col">
        {categories.map((category, index) => {
          const hasSubCategories = category.subCategories.length > 0;
          const expanded = hasSubCategories && expandedId === category.id;
          const panelId = `menu-sub-categories-${index}`;

          return (
            <motion.li key={category.id} variants={menuItemVariant}>
              {hasSubCategories ? (
                <button
                  type="button"
                  onClick={() => toggle(category.id)}
                  aria-expanded={expanded}
                  aria-controls={panelId}
                  className="flex min-h-11 w-full items-center justify-between gap-3 py-2 text-left font-sans text-base font-light tracking-[0.02em] uppercase transition-colors hover:text-plum focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum sm:text-lg"
                >
                  <span>{category.name}</span>

                  <motion.span
                    aria-hidden="true"
                    className="shrink-0 opacity-60"
                    variants={chevronVariant}
                    animate={expanded ? "open" : "closed"}
                    initial={false}
                    transition={
                      reduceMotion ? { duration: 0.01 } : TRANSITION_ACCORDION
                    }
                  >
                    <ChevronDownIcon width={18} height={18} />
                  </motion.span>
                </button>
              ) : (
                <Link
                  href={`/category/${category.slug}`}
                  onClick={onClose}
className="flex min-h-11 items-center py-2 font-sans text-base font-light tracking-[0.02em] uppercase transition-colors hover:text-plum focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum sm:text-lg"
                >
                  {category.name}
                </Link>
              )}

              {/*
               * Accordion open/close uses the CSS grid-template-rows 0fr -> 1fr
               * technique (never height: auto): the grid row and the panel
               * opacity are the only things that change. `inert` keeps the
               * collapsed links out of the tab order and unreachable.
               */}
              <div
                id={panelId}
                aria-hidden={!expanded}
                inert={!expanded}
                className="grid overflow-hidden"
                style={{
                  gridTemplateRows: expanded ? "1fr" : "0fr",
                  opacity: expanded ? 1 : 0,
                  transition: reduceMotion
                    ? "none"
                    : "grid-template-rows var(--motion-duration-accordion) var(--motion-ease), opacity var(--motion-duration-accordion) var(--motion-ease)",
                }}
              >
                <ul className="mb-3 ml-4 flex min-h-0 flex-col border-l border-black/10 pl-4">
                  {category.subCategories.map((subCategory) => (
                    <li key={subCategory.id}>
                      <Link
                        href={`/category/${category.slug}/${subCategory.slug}`}
                        onClick={onClose}
                        className="flex min-h-11 items-center py-1.5 font-sans text-base font-light text-black/60 uppercase transition-colors hover:text-plum focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum sm:text-lg"
                      >
                        {subCategory.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </motion.li>
          );
        })}

        <motion.li
          variants={menuItemVariant}
          className="mt-4 border-t border-black/10 pt-4"
        >
          <Link
            href={accountHref}
            onClick={onClose}
            className="flex min-h-11 items-center gap-3 py-2 font-sans text-base font-light tracking-[0.02em] uppercase transition-colors hover:text-plum focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum sm:text-lg"
          >
            <UserIcon width={20} height={20} className="shrink-0" />
            Account
          </Link>
        </motion.li>

        <motion.li variants={menuItemVariant}>
          <Link
            href="/wishlist"
            onClick={onClose}
            className="flex min-h-11 items-center gap-3 py-2 font-sans text-base font-light tracking-[0.02em] uppercase transition-colors hover:text-plum focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum sm:text-lg"
          >
            <HeartIcon width={20} height={20} className="shrink-0" />
            Wishlist
          </Link>
        </motion.li>
      </ul>
    </motion.nav>
  );
}
