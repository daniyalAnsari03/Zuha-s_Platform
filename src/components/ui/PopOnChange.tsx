"use client";

import { motion, type Transition } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { POP_TRANSITION } from "@/lib/motion";

type PopOnChangeProps = {
  /** Any value; the pop plays when this changes. */
  trigger: unknown;
  /** Set false to suppress the pop for a change (e.g. un-saving a heart). */
  enabled?: boolean;
  children: ReactNode;
  className?: string;
  /** Scale the keyframe starts at. */
  from?: number;
  /** Scale the keyframe peaks at. */
  peak?: number;
  /** The pop's timing; defaults to the shared short pop. */
  transition?: Transition;
};

/**
 * Plays a short scale "pop" (default 0.8 → 1.2 → 1) whenever `trigger`
 * changes - never on first render, and never while `enabled` is false. Used by
 * the cart count badge (any change) and the wishlist heart (only on save).
 */
export default function PopOnChange({
  trigger,
  enabled = true,
  children,
  className,
  from = 0.8,
  peak = 1.2,
  transition = POP_TRANSITION,
}: PopOnChangeProps) {
  const [popping, setPopping] = useState(false);
  const previous = useRef(trigger);

  useEffect(() => {
    const changed = previous.current !== trigger;
    previous.current = trigger;

    if (!changed || !enabled) return;

    setPopping(true);
    const durationMs =
      typeof transition.duration === "number" ? transition.duration * 1000 : 300;
    const timer = window.setTimeout(() => setPopping(false), durationMs);
    return () => window.clearTimeout(timer);
  }, [trigger, enabled, transition.duration]);

  return (
    <motion.span
      className={className}
      initial={false}
      animate={popping ? { scale: [from, peak, 1] } : { scale: 1 }}
      transition={transition}
    >
      {children}
    </motion.span>
  );
}