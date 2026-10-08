"use client";

import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { Quicksand } from "next/font/google";
import { useEffect, useRef, useState } from "react";

import {
  HEADER_TONE_FALLBACK,
  HEADER_TONE_TRANSITION,
} from "@/lib/header-tone";
import type { HomeAnnouncement } from "@/lib/home-data";
import { TRANSITION_SLOW } from "@/lib/motion";

/**
 * The announcement ticker's own face: light, thin, rounded geometric sans.
 * Weight 400 only, no uppercase, normal tracking - and used here and nowhere
 * else on the site.
 */
const quicksand = Quicksand({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

type AnnouncementBarProps = {
  announcements: HomeAnnouncement[];
  /** Homepage: fades the bar out with the navbar over the footer slide. */
  hidden?: boolean;
  /**
   * `overlay` (homepage): transparent strip pinned over the slides, taking the
   * adaptive header tone.
   * `flow` (every white page): a normal block sitting above the navbar, black
   * text on the white page, in document flow so it never overlaps anything.
   */
  variant?: "overlay" | "flow";
  /** Homepage only: the adaptive colour from `lib/header-tone`. */
  tone?: string;
};

/** Copies per half at the very least, so a short list still spans the screen. */
const MIN_COPIES_PER_HALF = 2;
/** Travel time for MIN_COPIES_PER_HALF, scaled with the real copy count. */
const BASE_SECONDS = 38;

function AnnouncementCopy({
  announcements,
  interactive,
}: {
  announcements: HomeAnnouncement[];
  /** Only the first copy links out; the rest are hidden decoration. */
  interactive: boolean;
}) {
  return (
    <div className="flex shrink-0 items-center whitespace-nowrap">
      {announcements.map((announcement) => {
        const href = interactive ? announcement.href : null;

        const label = href ? (
          href.startsWith("/") ? (
            <Link
              href={href}
              className="pointer-events-auto underline-offset-4 hover:underline"
            >
              {announcement.text}
            </Link>
          ) : (
            <a
              href={href}
              target="_blank"
              rel="noreferrer noopener"
              className="pointer-events-auto underline-offset-4 hover:underline"
            >
              {announcement.text}
            </a>
          )
        ) : (
          <span>{announcement.text}</span>
        );

        return (
          <span
            key={announcement.id}
            className="flex items-center whitespace-nowrap"
          >
            {label}
            <span aria-hidden="true" className="px-5 opacity-70">
              &bull;
            </span>
          </span>
        );
      })}
    </div>
  );
}

/**
 * The announcement ticker. Over the homepage slides it is a transparent strip
 * pinned to the top of the stack in the adaptive header tone; on every other
 * storefront page it is a plain in-flow block above the navbar, black on white.
 *
 * The track is duplicated into enough copies that half of it is always wider
 * than the viewport, so the -50% loop never exposes an empty gap, and the
 * marquee is strictly one line high at every breakpoint.
 */
export default function AnnouncementBar({
  announcements,
  hidden = false,
  variant = "overlay",
  tone = HEADER_TONE_FALLBACK,
}: AnnouncementBarProps) {
  const reduceMotion = useReducedMotion();
  const barRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  const [copiesPerHalf, setCopiesPerHalf] = useState(MIN_COPIES_PER_HALF);
  const isEmpty = announcements.length === 0;
  const isOverlay = variant === "overlay";

  useEffect(() => {
    if (isEmpty) return;

    const update = () => {
      const bar = barRef.current;
      const copy = copyRef.current;
      if (!bar || !copy) return;

      const copyWidth = copy.getBoundingClientRect().width;
      if (copyWidth <= 0) return;

      const needed = Math.max(
        MIN_COPIES_PER_HALF,
        Math.ceil(bar.clientWidth / copyWidth),
      );
      setCopiesPerHalf((current) => (needed === current ? current : needed));
    };

    update();

    const copy = copyRef.current;
    const observer =
      copy && typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(update)
        : null;

    if (observer && copy) observer.observe(copy);
    window.addEventListener("resize", update);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [isEmpty, announcements]);

  if (isEmpty) {
    return null;
  }

  const copies = Array.from({ length: copiesPerHalf * 2 }, (_, i) => i);
  // Keep the scroll speed constant: more copies means a longer loop.
  const durationSeconds = (BASE_SECONDS * copiesPerHalf) / MIN_COPIES_PER_HALF;

  return (
    <div
      ref={barRef}
      style={
        isOverlay
          ? { color: tone, transition: HEADER_TONE_TRANSITION }
          : undefined
      }
      className={`h-10 overflow-hidden ${
        isOverlay
          ? "pointer-events-none absolute inset-x-0 top-0 z-30"
          : "relative z-30 w-full"
      }`}
      role="region"
      aria-label="Announcements"
    >
      <motion.div
        className="h-full"
        initial={false}
        animate={{ opacity: hidden ? 0 : 1, y: hidden ? -14 : 0 }}
        // Faded-out copies must not stay clickable over the footer slide.
        style={{ pointerEvents: hidden ? "none" : undefined }}
        transition={reduceMotion ? { duration: 0.01 } : TRANSITION_SLOW}
      >
        <div className="flex h-full items-center">
          <div
            className={`ticker-track ${quicksand.className} text-[13px] leading-relaxed font-normal md:text-sm`}
            style={{ animationDuration: `${durationSeconds}s` }}
            aria-live="polite"
          >
            {copies.map((copyIndex) => (
              <div
                key={copyIndex}
                ref={copyIndex === 0 ? copyRef : undefined}
                className="shrink-0"
                aria-hidden={copyIndex === 0 ? undefined : true}
              >
                <AnnouncementCopy
                  announcements={announcements}
                  interactive={!hidden && copyIndex === 0}
                />
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
