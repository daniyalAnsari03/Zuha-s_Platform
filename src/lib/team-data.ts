import "server-only";

import { unstable_cache } from "next/cache";

import { CACHE_TAGS, DEFAULT_PUBLIC_REVALIDATE } from "@/lib/cache-tags";
import { createPublicClient } from "@/lib/supabase/public";

function isExpectedStaticThrownError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    (error as { digest?: unknown }).digest === "DYNAMIC_SERVER_USAGE"
  );
}

export type TeamMemberSlide = {
  id: string;
  name: string;
  role: string;
  bio: string;
  imageUrl: string;
};

async function getTeamMembersInternal(): Promise<TeamMemberSlide[]> {
  try {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("team_members")
      .select("id, name, role, bio, image_url")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (error) throw error;

    const members: TeamMemberSlide[] = [];

    for (const member of data ?? []) {
      if (!member.image_url) continue;

      members.push({
        id: member.id,
        name: member.name,
        role: member.role,
        bio: member.bio ?? "",
        imageUrl: member.image_url,
      });
    }

    return members;
  } catch (error) {
    if (isExpectedStaticThrownError(error)) return [];
    console.error("[team-data] team_members query failed.", error);
    throw error;
  }
}

export const getTeamMembers = unstable_cache(
  getTeamMembersInternal,
  ["team-members"],
  {
    tags: [CACHE_TAGS.team],
    revalidate: DEFAULT_PUBLIC_REVALIDATE,
  },
);
