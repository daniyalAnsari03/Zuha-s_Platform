"use server";

/**
 * Team Members: add / edit / delete for the footer's Team page.
 *
 * Same contract as the category actions: `requireAdmin()` first, every field
 * re-validated here rather than trusted, the portrait deleted from Storage when
 * it comes off a member or the member itself is deleted, and the storefront
 * revalidated so the Team carousel shows the change on the next load.
 *
 * The columns are `team_members`' own — `name`, `role`, `bio`, `image_url` —
 * because that is what `getTeamMembers()` reads for the circles and the popup:
 * `role` is the short line under the name, `bio` is the description inside it.
 */

import { revalidatePath } from "next/cache";

import { getAdminDb } from "@/lib/admin/db";
import { requireAdmin } from "@/lib/admin/guard";
import { expireCacheTag } from "@/lib/admin/revalidate";
import { deleteStoredImages } from "@/lib/admin/storage";
import {
  actionFail,
  actionOk,
  MAX_TEAM_BIO_LENGTH,
  MAX_TEAM_ROLE_LENGTH,
  readImageUrl,
  readLine,
  readName,
  readOptionalId,
  type ActionResult,
} from "@/lib/admin/validation";
import { CACHE_TAGS } from "@/lib/cache-tags";

/** A team member as the form sends it. `id` is null when creating. */
export type TeamMemberInput = {
  id: string | null;
  name: string;
  role: string;
  bio: string | null;
  imageUrl: string | null;
};

/** Saves a team member: creates them, or updates the one with this id. */
export async function saveTeamMember(
  input: TeamMemberInput,
): Promise<ActionResult> {
  await requireAdmin();

  const id = readOptionalId(input?.id);

  const name = readName(input?.name);
  if (!name.ok) return name;

  const role = readLine(input?.role, "Description/role", MAX_TEAM_ROLE_LENGTH, true);
  if (!role.ok) return role;

  const bio = readLine(input?.bio, "Description", MAX_TEAM_BIO_LENGTH);
  if (!bio.ok) return bio;

  const imageUrl = readImageUrl(input?.imageUrl);
  if (!imageUrl.ok) return imageUrl;

  if (!imageUrl.value) {
    return actionFail("An image is required for a team member.");
  }

  const db = getAdminDb();

  if (id) {
    const { data: existing, error: readError } = await db
      .from("team_members")
      .select("id, image_url")
      .eq("id", id)
      .maybeSingle();

    if (readError || !existing) {
      return actionFail("That team member no longer exists.");
    }

    const { error } = await db
      .from("team_members")
      .update({
        name: name.value,
        role: role.value,
        bio: bio.value || null,
        image_url: imageUrl.value,
      })
      .eq("id", id);

    if (error) {
      console.error("[admin] could not update the team member.", error.message);
      return actionFail("Could not save the team member. Please try again.");
    }

    await deleteStoredImages(db, [
      existing.image_url === imageUrl.value ? null : existing.image_url,
    ]);

    revalidateTeamPage();

    return actionOk(`Saved “${name.value}”.`);
  }

  // New members go to the end of the carousel; the dashboard has no drag-to-reorder.
  const { data: last, error: orderError } = await db
    .from("team_members")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (orderError) {
    console.error("[admin] could not read the team order.", orderError.message);
    return actionFail("Could not save the team member. Please try again.");
  }

  const { error } = await db.from("team_members").insert({
    name: name.value,
    role: role.value,
    bio: bio.value || null,
    image_url: imageUrl.value,
    email: null,
    is_active: true,
    sort_order: (last?.sort_order ?? 0) + 1,
  });

  if (error) {
    console.error("[admin] could not create the team member.", error.message);
    return actionFail("Could not save the team member. Please try again.");
  }

  revalidateTeamPage();

  return actionOk(`Added “${name.value}”.`);
}

/** Deletes a team member and their portrait. */
export async function deleteTeamMember(input: {
  id: string;
}): Promise<ActionResult> {
  await requireAdmin();

  const id = readOptionalId(input?.id);
  if (!id) return actionFail("That team member no longer exists.");

  const db = getAdminDb();

  const { data: member, error: readError } = await db
    .from("team_members")
    .select("id, name, image_url")
    .eq("id", id)
    .maybeSingle();

  if (readError || !member) {
    return actionFail("That team member no longer exists.");
  }

  const { error } = await db.from("team_members").delete().eq("id", id);

  if (error) {
    // 23503 is a foreign key violation: something still references the row.
    const blocked = error.code === "23503";

    console.error("[admin] could not delete the team member.", error.message);

    return actionFail(
      blocked
        ? `“${member.name}” is still referenced elsewhere and cannot be deleted.`
        : "Could not delete the team member. Please try again.",
    );
  }

  await deleteStoredImages(db, [member.image_url]);
  revalidateTeamPage();

  return actionOk(`Deleted “${member.name}”.`);
}

/**
 * The Team page's data and its rendered path.
 *
 * The path alone is no longer enough now that `getTeamMembers()` sits behind
 * `unstable_cache`: those rows are tagged `team`, so the tag has to expire too
 * or the carousel keeps the previous members until the 300-second fallback.
 */
function revalidateTeamPage(): void {
  revalidatePath("/team");
  expireCacheTag(CACHE_TAGS.team);
}
