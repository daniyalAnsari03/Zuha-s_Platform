"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

import BodyPortal from "@/components/layout/BodyPortal";
import { CONTENT_CONTAINER } from "@/lib/content-container";
import { popoverVariant } from "@/lib/motion";

type NavbarPopoverProps = {
  open: boolean;
  onClose: () => void;
  /** The navbar header the panel hangs from. */
  anchorRef: RefObject<HTMLElement | null>;
  /** Used for the dialog's accessible name. */
  label: string;
  children: React.ReactNode;
};

/**
 * A panel that drops in directly below the navbar - the shell shared by the cart
 * and the search. It is a popup, not a page: nothing navigates, the page behind
 * stays exactly where it is.
 *
 * Closes on outside click, on Escape and (through the navbar) on a route change.
 *
 * Position is measured from the header rather than hard-coded, because the
 * header sits at a different offset on every layout: in flow on the white pages
 * and below the announcement bar over the homepage slides. The measurement is in
 * document coordinates and is kept in sync while the panel is open, so the panel
 * tracks the header on scroll and on resize.
 */
export default function NavbarPopover({
  open,
  onClose,
  anchorRef,
  label,
  children,
}: NavbarPopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [top, setTop] = useState<number | null>(null);

  const measure = useCallback(() => {
    const header = anchorRef.current;
    if (!header) return;

    const rect = header.getBoundingClientRect();
    setTop(rect.bottom + window.scrollY);
  }, [anchorRef]);

  useEffect(() => {
    if (!open) return;

    measure();

    let frame = 0;
    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        measure();
      });
    };

    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
    };
  }, [open, measure]);

  // Outside click + Escape. The trigger buttons live in the header, so the
  // header counts as "inside" and the navbar handles its own toggle.
  useEffect(() => {
    if (!open) return;

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

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose, anchorRef]);

  return (
    <BodyPortal>
      <AnimatePresence>
        {/*
         * Wait for the measurement before the first frame: rendering at top 0
         * for one paint would flash the panel over the announcement bar.
         */}
        {open && top !== null ? (
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-label={label}
            className="absolute inset-x-0 z-40"
            style={{ top: top ?? 0 }}
            variants={popoverVariant}
            initial="hidden"
            animate="show"
            exit="exit"
          >
            {/* The panel hangs from the navbar, so it takes the same container
                as the navbar itself: its left edge is the hamburger's edge. */}
            <div className={CONTENT_CONTAINER}>
              <div
                data-scrollable
                className="max-h-[75dvh] overflow-y-auto overscroll-contain border border-black/10 bg-white shadow-[0_18px_48px_rgba(0,0,0,0.12)]"
              >
                {children}
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </BodyPortal>
  );
}