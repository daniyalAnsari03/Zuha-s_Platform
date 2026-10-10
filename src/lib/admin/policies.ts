"use server";

/**
 * Store Policies: the body text of the four public policy pages
 * (/policies/[slug], migration 014).
 *
 * Same contract as every other admin action: `requireAdmin()` first and the
 * payload re-validated here rather than trusted. The slug is checked against the
 * fixed route list, so no arbitrary row can be written through this action, and
 * the body may be empty (clearing a policy returns its page to the empty state).
 *
 * The write goes through the service-role client and finishes by expiring the
 * policies cache tag and revalidating that one policy path, which is what makes
 * the storefront show the new text.
 */

import { revalidatePath } from "next/cache";

import { getAdminDb } from "@/lib/admin/db";
import { requireAdmin } from "@/lib/admin/guard";
import { expireCacheTag } from "@/lib/admin/revalidate";
import {
  actionFail,
  actionOk,
  readLongText,
  type ActionResult,
} from "@/lib/admin/validation";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { isStorePolicySlug, STORE_POLICY_TITLES } from "@/lib/policy-types";

/** Saves one policy page's content. An empty body is allowed. */
export async function saveStorePolicy(
  slug: string,
  content: string,
): Promise<ActionResult> {
  await requireAdmin();

  if (!isStorePolicySlug(slug)) {
    return actionFail("That policy page does not exist.");
  }

  const body = readLongText(content, "Policy content");
  if (!body.ok) return body;

  const db = getAdminDb();

  const { error } = await db
    .from("store_policies")
    .update({
      content: body.value,
      updated_at: new Date().toISOString(),
    })
    .eq("slug", slug);

  if (error) {
    console.error("[admin] could not save the store policy.", error.message);

    // The most likely cause by far: migration 014 has not been run yet.
    return actionFail(
      "Could not save the policy. Run supabase/migrations/014_store_policies.sql first, then try again.",
    );
  }

  expireCacheTag(CACHE_TAGS.policies);
  expireCacheTag(CACHE_TAGS.policy(slug));
  revalidatePath(`/policies/${slug}`);

  return actionOk(`${STORE_POLICY_TITLES[slug]} saved.`);
}
