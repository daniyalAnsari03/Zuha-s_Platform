"use server";

import { getAdminDb } from "@/lib/admin/db";
import { requireAdmin } from "@/lib/admin/guard";
import { revalidateStorefront } from "@/lib/admin/revalidate";
import {
  actionFail,
  actionOk,
  MAX_LINE_LENGTH,
  readLine,
  readOptionalId,
  type ActionResult,
} from "@/lib/admin/validation";

export async function addAnnouncement(input: {
  text: unknown;
}): Promise<ActionResult> {
  await requireAdmin();

  const text = readLine(input?.text, "Announcement", MAX_LINE_LENGTH, true);
  if (!text.ok) return text;

  const db = getAdminDb();

  const { error } = await db.from("announcements").insert({
    title: text.value,
    body: null,
    link_url: null,
    is_active: true,
    starts_at: null,
    ends_at: null,
  });

  if (error) {
    console.error("[admin] could not add the announcement.", error.message);
    return actionFail("Could not add the announcement. Please try again.");
  }

  // The ticker sits on every storefront page, so the whole storefront is
  // refreshed rather than only the homepage: `revalidateStorefront` expires the
  // announcements tag (and the home/menu tags these entries are read through)
  // and invalidates every path that renders the bar.
  revalidateStorefront({});

  return actionOk("Announcement added.");
}

export async function removeAnnouncement(input: {
  id: unknown;
}): Promise<ActionResult> {
  await requireAdmin();

  const id = readOptionalId(input?.id);
  if (!id) return actionFail("That announcement no longer exists.");

  const db = getAdminDb();

  const { data: announcement, error: readError } = await db
    .from("announcements")
    .select("id, title")
    .eq("id", id)
    .maybeSingle();

  if (readError || !announcement) {
    return actionFail("That announcement no longer exists.");
  }

  const { error } = await db.from("announcements").delete().eq("id", id);

  if (error) {
    console.error("[admin] could not remove the announcement.", error.message);
    return actionFail("Could not remove the announcement. Please try again.");
  }

  revalidateStorefront({});

  return actionOk("Announcement removed.");
}
