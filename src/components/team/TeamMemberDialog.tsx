"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef } from "react";

import { CloseIcon } from "@/components/icons";
import FadeInImage from "@/components/ui/FadeInImage";
import BodyPortal from "@/components/layout/BodyPortal";
import { IMAGE_QUALITY } from "@/lib/images";
import { modalBackdropVariant, modalVariant } from "@/lib/motion";
import type { TeamMemberSlide } from "@/lib/team-data";

type TeamMemberDialogProps = {
  /** The member to show; `null` keeps the dialog closed. */
  member: TeamMemberSlide | null;
  onClose: () => void;
};

/**
 * A team member's full detail, as a popup on the Team page.
 *
 * Closes three ways - the X, a click on the backdrop, and Escape - and locks the
 * page behind it while open. Full-screen sheet on mobile, centred card from `md`
 * up, matching the product quick view.
 */
export default function TeamMemberDialog({
  member,
  onClose,
}: TeamMemberDialogProps) {
  const isOpen = member !== null;
  const overlayRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", onKeyDown);

    const { body } = document;
    const previousOverflow = body.style.overflow;
    body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      body.style.overflow = previousOverflow;
    };
  }, [isOpen, onClose]);

  const onOverlayClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === overlayRef.current) onClose();
  };

  return (
    <BodyPortal>
      <AnimatePresence>
        {isOpen && member ? (
          <motion.div
            key="team-member-backdrop"
            ref={overlayRef}
            variants={modalBackdropVariant}
            initial="hidden"
            animate="show"
            exit="exit"
            onClick={onOverlayClick}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 md:items-center md:p-4"
          >
            <motion.div
              key="team-member-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="team-member-name"
              variants={modalVariant}
              initial="hidden"
              animate="show"
              exit="exit"
              className="relative flex max-h-[100dvh] w-full flex-col overflow-y-auto overscroll-contain bg-white pb-8 md:max-h-[86vh] md:max-w-xl"
            >
              <div className="flex items-start justify-end p-4 sm:p-5">
                <button
                  ref={closeButtonRef}
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="flex h-11 w-11 items-center justify-center text-black transition-colors hover:text-plum focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum"
                >
                  <CloseIcon />
                </button>
              </div>

              <div className="flex flex-col items-center gap-6 px-6 text-center sm:px-8">
                <span className="relative block aspect-square w-40 overflow-hidden rounded-full bg-black/5 sm:w-48">
                  <FadeInImage
                    src={member.imageUrl}
                    alt=""
                    sizes="(max-width: 639px) 160px, 192px"
                    quality={IMAGE_QUALITY}
                    unoptimized={member.imageUrl.toLowerCase().split("?")[0].endsWith(".svg")}
                    className="object-cover"
                  />
                </span>

                <div className="flex flex-col gap-2">
                  <h2
                    id="team-member-name"
                    className="font-serif text-2xl tracking-[0.06em] sm:text-3xl"
                  >
                    {member.name}
                  </h2>

                  <p className="text-xs font-medium tracking-[0.2em] text-plum uppercase">
                    {member.role}
                  </p>
                </div>

                {member.bio ? (
                  <p className="max-w-prose text-sm leading-relaxed text-black/70 sm:text-base">
                    {member.bio}
                  </p>
                ) : null}
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </BodyPortal>
  );
}