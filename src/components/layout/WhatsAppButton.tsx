"use client";

import { motion } from "framer-motion";

import { WhatsAppIcon } from "@/components/icons";
import { TRANSITION_ENTER, TRANSITION_HOVER } from "@/lib/motion";
import type { StoreDetails } from "@/lib/site-config";

/**
 * The storefront's floating WhatsApp button: a round brand-green pill fixed at
 * the bottom *right* of every storefront page (the homepage slides and the
 * full-screen footer slide included), mirroring the currency switcher that sits
 * at the bottom left — same bottom offset, same 44px height, same `z-30`, so
 * the two read as a matched pair. Never rendered in `/admin`.
 *
 * It uses the WhatsApp link the admin sets in Settings → Social links: the
 * caller passes the same `StoreDetails` the footer and /contact render, so
 * there is one number and one cache/revalidation path, and the button simply
 * does not render when that link is empty. It opens the chat in a new tab,
 * exactly like the footer icon — no message field, no pre-filled text.
 *
 * `z-30` puts it below every popup, drawer and modal (the navbar panels are
 * `z-40`, the drawers and quick view `z-50`), whose backdrops therefore cover
 * it while an overlay is open — it can never block a dialog's buttons. The
 * entrance is the shared opacity fade, the hover is a slight scale, and
 * `MotionProvider`'s `reducedMotion="user"` drops that transform for anyone who
 * asked for less motion.
 */
export default function WhatsAppButton({
  details,
}: {
  /** The same merged store details the footer renders. */
  details: StoreDetails;
}) {
  const href = details.socials.find((social) => social.label === "WhatsApp")
    ?.href.trim();

  // No link set in Settings: no button at all.
  if (!href) return null;

  return (
    <motion.a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      aria-label="Chat on WhatsApp"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={TRANSITION_ENTER}
      whileHover={{ scale: 1.06, transition: TRANSITION_HOVER }}
      className="fixed right-3 z-30 flex h-11 w-11 items-center justify-center rounded-full bg-[#25D366] text-white shadow-[0_2px_10px_rgba(0,0,0,0.18)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum sm:right-4"
      style={{ bottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}
    >
      <WhatsAppIcon className="h-6 w-6" />
    </motion.a>
  );
}
