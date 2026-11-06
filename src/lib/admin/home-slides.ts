"use server";

/**
 * Home Slides: add / edit / delete for the homepage's non-clickable
 * informational slides (the full-bleed images with no text, no link and no
 * click behaviour).
 *
 * Same contract as the team actions: `requireAdmin()` first, every field
 * re-validated here rather than trusted, replaced or deleted images removed
 * from Storage afterwards, and the homepage revalidated so the storefront
 * picks the change up immediately. Moving a slide swaps its `sort_order` with
 * the neighbour of the SAME placement group — placement is the stack group,
 * and order inside each group is what Move up / Move down changes.
 */

import { getAdminDb, type AdminDb } from "@/lib/admin/db";
import { requireAdmin } from "@/lib/admin/guard";
import { revalidateStorefront } from "@/lib/admin/revalidate";
import { deleteStoredImages } from "@/lib/admin/storage";
import {
  actionFail,
  actionOk,
  readImageUrl,
  readOptionalId,
  type ActionResult,
} from "@/lib/admin/validation";
import type { HomeSlidePlacement } from "@/lib/admin/queries";

const PLACEMENTS: readonly HomeSlidePlacement[] = [
  "first",
  "after_sale",
  "after_categories",
];

const PLACEMENT_LABELS: Record<HomeSlidePlacement, string> = {
  first: "First (before Sale slide)",
  after_sale: "After Sale slide, before categories",
  after_categories: "After categories (before footer)",
};

function readPlacement(value: unknown):
  | { ok: true; value: HomeSlidePlacement }
  | ActionErrorLike {
  const placement = typeof value === "string" ? value.trim() : "";

  if (!PLACEMENTS.includes(placement as HomeSlidePlacement)) {
    return { ok: false, error: "Choose where the slide sits." };
  }

  return { ok: true, value: placement as HomeSlidePlacement };
}

function readActive(value: unknown): boolean {
  return value === true;
}

type ActionErrorLike = { ok: false; error: string };

/**
 * The next `sort_order` at the END of a placement group, for a slide that is
 * created or that moves into a different group.
 */
async function nextSortOrderInPlacement(
  db: AdminDb,
  placement: HomeSlidePlacement,
): Promise<number> {
  const { data: last, error } = await db
    .from("home_slides")
    .select("sort_order")
    .eq("placement", placement)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(
      "[admin] could not read the home slides' order.",
      error.message,
    );
  }

  return (last?.sort_order ?? 0) + 1;
}

/** The admin-readable placement label, for the save feedback line. */
function placementLabel(placement: HomeSlidePlacement): string {
  return PLACEMENT_LABELS[placement] ?? placement;
}

export async function saveHomeSlide(input: {
  id: unknown;
  desktopImageUrl: unknown;
  mobileImageUrl: unknown;
  placement: unknown;
  isActive: unknown;
}): Promise<ActionResult> {
  await requireAdmin();

  const id = readOptionalId(input?.id);

  const desktopImageUrl = readImageUrl(input?.desktopImageUrl);
  if (!desktopImageUrl.ok) return desktopImageUrl;

  if (!desktopImageUrl.value) {
    return actionFail("A Desktop Image is required for a home slide.");
  }

  const mobileImageUrl = readImageUrl(input?.mobileImageUrl);
  if (!mobileImageUrl.ok) return mobileImageUrl;

  const placement = readPlacement(input?.placement);
  if (!placement.ok) return placement;

  const isActive = readActive(input?.isActive);

  const db = getAdminDb();

  if (id) {
    const { data: existing, error: readError } = await db
      .from("home_slides")
      .select("id, desktop_image_url, mobile_image_url, placement")
      .eq("id", id)
      .maybeSingle();

    if (readError || !existing) {
      return actionFail("That home slide no longer exists.");
    }

    // A slide that changes group joins the END of its new group; moving is
    // the Move up / Move down action's job, not the edit form's.
    let sortOrder: number | undefined;
    if (existing.placement !== placement.value) {
      sortOrder = await nextSortOrderInPlacement(db, placement.value);
    }

    const { error } = await db
      .from("home_slides")
      .update({
        desktop_image_url: desktopImageUrl.value,
        mobile_image_url: mobileImageUrl.value,
        placement: placement.value,
        is_active: isActive,
        ...(sortOrder !== undefined ? { sort_order: sortOrder } : {}),
      })
      .eq("id", id);

    if (error) {
      console.error("[admin] could not update the home slide.", error.message);
      return actionFail("Could not save the home slide. Please try again.");
    }

    // Clean up every replaced file: an image removed from the form (or a
    // desktop/mobile swap) stops being referenced the moment this row is
    // written.
    const replaced = [
      existing.desktop_image_url === desktopImageUrl.value
        ? null
        : existing.desktop_image_url,
      existing.mobile_image_url === mobileImageUrl.value
        ? null
        : existing.mobile_image_url,
    ];

    await deleteStoredImages(db, replaced);
    revalidateStorefront({});

    return actionOk(`Saved. Placement: ${placementLabel(placement.value)}.`);
  }

  const sortOrder = await nextSortOrderInPlacement(db, placement.value);

  const { error } = await db.from("home_slides").insert({
    desktop_image_url: desktopImageUrl.value,
    mobile_image_url: mobileImageUrl.value,
    placement: placement.value,
    sort_order: sortOrder,
    is_active: isActive,
  });

  if (error) {
    console.error("[admin] could not create the home slide.", error.message);
    return actionFail("Could not save the home slide. Please try again.");
  }

  revalidateStorefront({});

  return actionOk(`Slide added. Placement: ${placementLabel(placement.value)}.`);
}

/** Deletes a home slide and both of its image files. */
export async function deleteHomeSlide(input: {
  id: unknown;
}): Promise<ActionResult> {
  await requireAdmin();

  const id = readOptionalId(input?.id);
  if (!id) return actionFail("That home slide no longer exists.");

  const db = getAdminDb();

  const { data: slide, error: readError } = await db
    .from("home_slides")
    .select("id, desktop_image_url, mobile_image_url")
    .eq("id", id)
    .maybeSingle();

  if (readError || !slide) {
    return actionFail("That home slide no longer exists.");
  }

  const { error } = await db.from("home_slides").delete().eq("id", id);

  if (error) {
    console.error("[admin] could not delete the home slide.", error.message);
    return actionFail("Could not delete the home slide. Please try again.");
  }

  await deleteStoredImages(db, [slide.desktop_image_url, slide.mobile_image_url]);
  revalidateStorefront({});

  return actionOk("Home slide deleted.");
}

/** Toggles a home slide's Active on/off switch. */
export async function setHomeSlideActive(input: {
  id: unknown;
  active: unknown;
}): Promise<ActionResult> {
  await requireAdmin();

  const id = readOptionalId(input?.id);
  if (!id) return actionFail("That home slide no longer exists.");

  const db = getAdminDb();

  const { error } = await db
    .from("home_slides")
    .update({ is_active: readActive(input?.active) })
    .eq("id", id);

  if (error) {
    console.error("[admin] could not update the home slide.", error.message);
    return actionFail("Could not update the home slide. Please try again.");
  }

  revalidateStorefront({});

  return actionOk(readActive(input?.active) ? "Slide is active." : "Slide is off.");
}

/**
 * Moves a slide one place up or down INSIDE its placement group.
 *
 * The two adjacent rows' `sort_order` values are swapped, so every other row
 * stays exactly where it is and no other group is touched.
 */
export async function moveHomeSlide(input: {
  id: unknown;
  direction: unknown;
}): Promise<ActionResult> {
  await requireAdmin();

  const id = readOptionalId(input?.id);
  if (!id) return actionFail("That home slide no longer exists.");

  const direction =
    input?.direction === "up" || input?.direction === "down"
      ? input.direction
      : null;
  if (!direction) {
    return actionFail("That home slide no longer exists.");
  }

  const db = getAdminDb();

  const { data: slide, error: readError } = await db
    .from("home_slides")
    .select("id, placement")
    .eq("id", id)
    .maybeSingle();

  if (readError || !slide) {
    return actionFail("That home slide no longer exists.");
  }

  // The group's rows in their display order (created_at breaks ties).
  const { data: groupRows, error: groupError } = await db
    .from("home_slides")
    .select("id, sort_order")
    .eq("placement", slide.placement)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (groupError) {
    console.error("[admin] could not read the home slides' order.", groupError.message);
    return actionFail("Could not move the home slide. Please try again.");
  }

  const rows = groupRows ?? [];
  const index = rows.findIndex((row) => row.id === id);
  const neighbourIndex = direction === "up" ? index - 1 : index + 1;

  if (index === -1 || neighbourIndex < 0 || neighbourIndex >= rows.length) {
    return actionOk("The slide is already at the edge of its placement.");
  }

  const [row, neighbour] = [rows[index], rows[neighbourIndex]];

  const { error: firstError } = await db
    .from("home_slides")
    .update({ sort_order: neighbour.sort_order })
    .eq("id", row.id);

  if (firstError) {
    console.error("[admin] could not move the home slide.", firstError.message);
    return actionFail("Could not move the home slide. Please try again.");
  }

  const { error: secondError } = await db
    .from("home_slides")
    .update({ sort_order: row.sort_order })
    .eq("id", neighbour.id);

  if (secondError) {
    console.error("[admin] could not move the home slide.", secondError.message);
    return actionFail("Could not move the home slide. Please try again.");
  }

  revalidateStorefront({});

  return actionOk("Slide moved.");
}
