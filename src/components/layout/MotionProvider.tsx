"use client";

import { MotionConfig } from "framer-motion";

/**
 * Root motion settings: honour the user's `prefers-reduced-motion` for every
 * Framer Motion animation on the site without each component having to ask.
 * With `reducedMotion="user"` Motion drops transform/layout animations while
 * keeping opacity, which together with the CSS `@media (prefers-reduced-motion:
 * reduce)` fallback in `globals.css` turns every entrance into a simple fade
 * (or an instant swap) for users who ask for it.
 */
export default function MotionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}