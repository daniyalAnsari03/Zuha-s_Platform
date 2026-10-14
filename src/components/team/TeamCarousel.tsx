"use client";

import { useCallback, useState } from "react";

import TeamMemberDialog from "@/components/team/TeamMemberDialog";
import CoverflowCarousel from "@/components/ui/CoverflowCarousel";
import { CONTENT_CONTAINER } from "@/lib/content-container";
import type { TeamMemberSlide } from "@/lib/team-data";

type TeamCarouselProps = {
  members: TeamMemberSlide[];
};

/**
 * The Team page: the same 3D coverflow as the sub-category page, showing one
 * portrait card and a name per member and nothing else.
 *
 * Activating the centred card opens that member's full detail in a popup on
 * this same page, so the carousel is never replaced by a wall of bios. The
 * roster arrives whole (the server already read it) so the popup opens
 * instantly; the role and bio are in the page payload but are never rendered
 * here.
 */
export default function TeamCarousel({ members }: TeamCarouselProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Stable identity, so the popup's scroll-lock effect does not re-run on every
  // render of this component.
  const close = useCallback(() => setSelectedId(null), []);
  const open = useCallback((member: TeamMemberSlide) => {
    setSelectedId(member.id);
  }, []);

  // Looked up by id rather than holding the object, so the popup always shows the
  // member as it is right now.
  const selected = members.find((member) => member.id === selectedId) ?? null;

  if (members.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-black/50">
        Our team is being put together. Please check back soon.
      </p>
    );
  }

  return (
    <>
      <CoverflowCarousel
        ariaLabel="Team members"
        headingId="team-heading"
        className={CONTENT_CONTAINER}
        heading={
          <h1
            id="team-heading"
            className="mb-8 text-center font-serif text-2xl tracking-[0.1em] sm:mb-10 sm:text-3xl md:text-4xl"
          >
            The Team
          </h1>
        }
        items={members}
        onActivate={open}
      />

      <TeamMemberDialog member={selected} onClose={close} />
    </>
  );
}
