"use client";

import { useCallback, useState } from "react";

import TeamMemberDialog from "@/components/team/TeamMemberDialog";
import CircleCarousel, {
  CIRCLE_CARD_ACTION_CLASS,
  CIRCLE_CARD_IMAGE_SIZES,
  CircleCard,
} from "@/components/ui/CircleCarousel";
import type { TeamMemberSlide } from "@/lib/team-data";
import { CONTENT_CONTAINER } from "@/lib/content-container";

type TeamCarouselProps = {
  members: TeamMemberSlide[];
};

/**
 * The Team page: the same circular-card carousel as the sub-category page,
 * showing one circle and a name per member and nothing else.
 *
 * Tapping a circle opens that member's full detail in a popup on this same page,
 * so the carousel is never replaced by a wall of bios. The roster arrives whole
 * (the server already read it) so the popup opens instantly; the role and bio
 * are in the page payload but are never rendered here.
 */
export default function TeamCarousel({ members }: TeamCarouselProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Stable identity, so the popup's scroll-lock effect does not re-run on every
  // render of this component.
  const close = useCallback(() => setSelectedId(null), []);

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
      <CircleCarousel
        ariaLabel="Team members"
        trackId="team-member-track"
        className={CONTENT_CONTAINER}
        headingId="team-heading"
        heading={
          <h1
            id="team-heading"
            className="mb-8 text-center font-serif text-2xl tracking-[0.1em] sm:mb-10 sm:text-3xl md:text-4xl"
          >
            The Team
          </h1>
        }
        items={members}
        renderAction={(member) => (
          <button
            type="button"
            onClick={() => setSelectedId(member.id)}
            aria-haspopup="dialog"
            className={CIRCLE_CARD_ACTION_CLASS}
          >
            <CircleCard
              name={member.name}
              imageUrl={member.imageUrl}
              sizes={CIRCLE_CARD_IMAGE_SIZES}
            />
          </button>
        )}
      />

      <TeamMemberDialog member={selected} onClose={close} />
    </>
  );
}