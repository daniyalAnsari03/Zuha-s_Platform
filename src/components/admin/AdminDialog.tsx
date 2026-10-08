"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, type ReactNode } from "react";

import { CloseIcon } from "@/components/icons";
import { ADMIN_SECONDARY_BUTTON_CLASS } from "@/components/admin/admin-fields";
import { modalBackdropVariant, modalVariant } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * The dashboard's one modal: add / edit forms and delete confirmations open in
 * it, so there is a single dialog behaviour to get right.
 *
 * Modelled on the storefront's filter drawer — dimmed backdrop, Escape to close,
 * the page behind locked so it cannot scroll under the panel. Full width on
 * mobile so a form is never squeezed, capped at 640px from tablet up where the
 * sidebar is visible beside it.
 */
export default function AdminDialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  /** Buttons, rendered pinned to the bottom of the panel. */
  footer?: ReactNode;
}) {
  // Escape closes, and the page behind the panel cannot be scrolled away.
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    const { body } = document;
    const previousOverflow = body.style.overflow;
    body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);

    return () => {
      body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="fixed inset-0 z-50 cursor-default bg-black/45"
            variants={modalBackdropVariant}
            initial="hidden"
            animate="show"
            exit="exit"
          />

          {/* Transparent to clicks so the backdrop button underneath still
              closes on a backdrop click; the panel opts back in. */}
          <div className="pointer-events-none fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label={title}
              variants={modalVariant}
              initial="hidden"
              animate="show"
              exit="exit"
              className={cn(
                "pointer-events-auto flex max-h-[92dvh] w-full flex-col bg-white shadow-[0_0_48px_rgba(0,0,0,0.18)] sm:max-w-[640px]",
              )}
            >
              <header className="flex shrink-0 items-start justify-between gap-4 border-b border-black/10 px-4 py-4 sm:px-6 sm:py-5">
                <div>
                  <h2 className="text-sm font-semibold tracking-[0.16em] uppercase">
                    {title}
                  </h2>

                  {description ? (
                    <p className="mt-1 text-xs text-black/50">{description}</p>
                  ) : null}
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="-mt-2 -mr-2 flex size-11 shrink-0 items-center justify-center transition-colors hover:text-plum focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum"
                >
                  <CloseIcon />
                </button>
              </header>

              <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">
                {children}
              </div>

              {footer ? (
                <footer className="flex shrink-0 flex-wrap items-center justify-end gap-3 border-t border-black/10 px-4 py-4 sm:px-6">
                  {footer}
                </footer>
              ) : null}
            </motion.div>
          </div>
        </>
      ) : null}
    </AnimatePresence>
  );
}

/** The cancel half of every dialog footer. */
export function AdminDialogCancel({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      onClick={onClose}
      className={ADMIN_SECONDARY_BUTTON_CLASS}
    >
      Cancel
    </button>
  );
}
