import type { Metadata } from "next";

import Breadcrumb from "@/components/layout/Breadcrumb";
import TeamCarousel from "@/components/team/TeamCarousel";
import { getTeamMembers } from "@/lib/team-data";

export const metadata: Metadata = {
  title: "Team — ZUHA'S",
  description: "The people behind ZUHA'S.",
};

/**
 * The Team page, opened from the footer's Team button.
 *
 * One circle and a name per member in a side-scrolling carousel - the same
 * component the sub-category page uses - with the full detail in a popup rather
 * than on the page. Members come from `team_members` per request, so the admin
 * adding or removing someone shows up here without a code change.
 *
 * The navbar (no border), the page spacing and the normal footer all come from
 * the `(site)` layout.
 */
export default async function TeamPage() {
  const members = await getTeamMembers();

  return (
    <section className="mx-auto w-full max-w-[1600px]">
      <div className="px-4 sm:px-6 lg:px-12 xl:px-24">
        <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Team" }]} />
      </div>

      <div className="mt-8 sm:mt-10 md:mt-12">
        <TeamCarousel members={members} />
      </div>
    </section>
  );
}