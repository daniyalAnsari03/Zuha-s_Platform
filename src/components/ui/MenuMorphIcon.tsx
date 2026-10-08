"use client";

import { motion, useReducedMotion } from "framer-motion";

import { MENU_ICON_MORPH } from "@/lib/motion";

type MenuMorphIconProps = {
  open: boolean;
  /** Icon size, matching the icon it replaces. The three bars scale with it. */
  width?: number;
  height?: number;
  className?: string;
};

/**
 * The hamburger that becomes an X. The three bars share the same colour and
 * stroke as the rest of the icon set; on open the top bar rotates to one
 * diagonal, the middle bar fades, and the bottom bar rotates to the other -
 * and back again on close. Transform and opacity only, so it stays smooth.
 *
 * Used by the storefront hamburger and the admin drawer button, which is why it
 * lives beside the other icons but in its own client module.
 */
export default function MenuMorphIcon({
  open,
  width = 22,
  height = 22,
  className,
}: MenuMorphIconProps) {
  const reduceMotion = useReducedMotion();
  const transition = reduceMotion
    ? { duration: 0.01 }
    : MENU_ICON_MORPH.transition;

  const bar = (props: { d: string; rotate: number; opacity: number }) => (
    <motion.path
      d={props.d}
      animate={{ rotate: props.rotate, opacity: props.opacity }}
      transition={transition}
      style={{ originX: "50%", originY: "50%" }}
    />
  );

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable={false}
      className={className}
    >
      {bar({ d: "M3 6h18", rotate: open ? 45 : 0, opacity: 1 })}
      {bar({ d: "M3 12h18", rotate: 0, opacity: open ? 0 : 1 })}
      {bar({ d: "M3 18h18", rotate: open ? -45 : 0, opacity: 1 })}
    </svg>
  );
}