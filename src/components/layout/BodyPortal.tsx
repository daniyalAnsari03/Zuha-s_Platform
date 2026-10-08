"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

/** Never called; this store exists only to ask "has the client mounted yet?". */
const emptySubscribe = () => () => {};

/**
 * Renders its children at the end of `<body>`.
 *
 * The navbar chrome on the homepage sits inside a `mix-blend-mode: difference`
 * wrapper, so a panel rendered inside the header would be blended with the slide
 * underneath it. Portalling to the body keeps the cart and search popups and the
 * menu drawer in normal document coordinates, above everything.
 *
 * Returns nothing on the server and while hydrating, so there is no hydration
 * mismatch; the panels then mount right after hydration.
 */
export default function BodyPortal({
  children,
}: {
  children: React.ReactNode;
}) {
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  if (!mounted) return null;

  return createPortal(children, document.body);
}