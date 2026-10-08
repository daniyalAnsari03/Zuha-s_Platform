"use server";

/**
 * Contact messages: the two things the dashboard may do to one — open it (which
 * marks it read) and delete it.
 *
 * Same contract as every other admin action: `requireAdmin()` first, the id
 * re-validated here rather than trusted, the write on the service-role client,
 * then `revalidatePath` so the list and the sidebar's unread badge reflect the
 * change without the client asking for a refresh.
 *
 * The row is private correspondence, and `contact_messages` has no RLS policy
 * at all (migration 013), so this file and the `sendContactMessage` action on
 * the storefront are the only two ways a row is ever written.
 */

import { revalidatePath } from "next/cache";

import { getAdminDb } from "@/lib/admin/db";
import { requireAdmin } from "@/lib/admin/guard";
import {
  actionFail,
  actionOk,
  readOptionalId,
  type ActionResult,
} from "@/lib/admin/validation";

/** Marks one message read — what opening it in the dashboard does. */
export async function markContactMessageRead(input: {
  id: unknown;
}): Promise<ActionResult> {
  await requireAdmin();

  const id = readOptionalId(input?.id);
  if (!id) return actionFail("That message no longer exists.");

  const db = getAdminDb();

  const { data: message, error: readError } = await db
    .from("contact_messages")
    .select("id, is_read")
    .eq("id", id)
    .maybeSingle();

  if (readError || !message) {
    return actionFail("That message no longer exists.");
  }

  // Already read: nothing to write, so no round-trip and no re-render.
  if (message.is_read) return actionOk("Message marked as read.");

  const { error } = await db
    .from("contact_messages")
    .update({ is_read: true })
    .eq("id", id);

  if (error) {
    console.error("[admin] could not mark the message read.", error.message);
    return actionFail("Could not update that message. Please try again.");
  }

  // The list, its page count and the sidebar's unread badge all read the same
  // column, so the route is revalidated once for all three.
  revalidatePath("/admin/messages");

  return actionOk("Message marked as read.");
}

/** Deletes one message. The confirm dialog's own refusal is shown as-is. */
export async function removeContactMessage(input: {
  id: unknown;
}): Promise<ActionResult> {
  await requireAdmin();

  const id = readOptionalId(input?.id);
  if (!id) return actionFail("That message no longer exists.");

  const db = getAdminDb();

  const { data: message, error: readError } = await db
    .from("contact_messages")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (readError || !message) {
    return actionFail("That message no longer exists.");
  }

  const { error } = await db
    .from("contact_messages")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[admin] could not remove the message.", error.message);
    return actionFail("Could not delete that message. Please try again.");
  }

  revalidatePath("/admin/messages");

  return actionOk("Message deleted.");
}
