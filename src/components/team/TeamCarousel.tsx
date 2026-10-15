"use client";

import { useCallback, useState } from "react";

import TeamMemberDialog from "@/components/team/TeamMemberDialog";
import CardRowCarousel, {
  CARD_ROW_ACTION_CLASS,
  TEAM_CARD_WIDTH,
  TEAM_IMAGE_SIZES,
} from "@/components/ui/CardRowCarousel";
import FadeInImage from "@/components/ui/FadeInImage";
import { IMAGE_QUALITY, isVectorImage } from "@/lib/images";
import { CONTENT_CONTAINER } from "@/lib/content-container";
import type { TeamMemberSlide } from "@/lib/team-data";

type TeamCarouselProps = {
  members: TeamMemberSlide[];
};

/**
 * The Team page: a flat horizontal row of circular cards, one circle and a
 * name per member and nothing else.
 *
 * Tapping a circle opens that member's full detail in a popup on this same
 * page, so the row is never replaced by a wall of bios. The roster arrives
 * whole (the server already read it) so the popup opens instantly; the role
 * and bio are in the page payload but are never rendered here.
 *
 * The row mechanics and the entrance animation are shared with the
 * sub-category page (see `components/ui/CardRowCarousel`); this file only
 * decides the circle card and what a tap does.
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
      <CardRowCarousel
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
        cardWidthClassName={TEAM_CARD_WIDTH}
        renderAction={(member) => (
          <button
            type="button"
            onClick={() => setSelectedId(member.id)}
            aria-haspopup="dialog"
            className={`${CARD_ROW_ACTION_CLASS} gap-3 sm:gap-4`}
          >
            <span className="relative block aspect-square w-full overflow-hidden rounded-full bg-black/5">
              <FadeInImage
                src={member.imageUrl}
                alt=""
                sizes={TEAM_IMAGE_SIZES}
                quality={IMAGE_QUALITY}
                unoptimized={isVectorImage(member.imageUrl)}
                className="object-cover"
              />
            </span>
            <span className="text-center text-sm tracking-[0.06em] sm:text-base">
              {member.name}
            </span>
          </button>
        )}
      />

      <TeamMemberDialog member={selected} onClose={close} />
    </>
  );
}
