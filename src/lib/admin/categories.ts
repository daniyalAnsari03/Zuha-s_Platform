"use server";

/**
 * Categories and sub-categories: the dashboard's create / edit / delete actions.
 *
 * Every action calls `requireAdmin()` itself. The `/admin` layout already gated
 * the page, but a layout is a single place to forget and it does not protect a
 * server action that is invoked directly — and these actions are exactly the code
 * that can change what the storefront shows.
 *
 * All four rules the spec sets are enforced here, not in the form:
 *
 *  - nothing is trusted from the browser. Names, URLs and numbers are re-validated
 *    against `admin/validation.ts`, and the browser's copy of the limits is only
 *    there to answer faster;
 *  - a category that still has sub-categories or products is **blocked**, with a
 *    message naming what is attached. `sub_categories.category_id` cascades on
 *    delete (migration 001), so allowing it would quietly destroy a whole branch
 *    of the catalog;
 *  - removed images are deleted from Storage, so the bucket does not keep every
 *    version of every product forever;
 *  - the storefront is revalidated after every change.
 */

import { getAdminDb } from "@/lib/admin/db";
import { requireAdmin } from "@/lib/admin/guard";
import { uniqueSlug } from "@/lib/admin/queries";
import { revalidateStorefront } from "@/lib/admin/revalidate";
import { deleteStoredImages } from "@/lib/admin/storage";
import {
  actionFail,
  actionOk,
  readImageUrl,
  readName,
  readOptionalId,
  type ActionResult,
} from "@/lib/admin/validation";

/** A top-level category as the form sends it. `id` is null when creating. */
export type CategoryInput = {
  id: string | null;
  name: string;
  imageUrl: string | null;
  mobileImageUrl: string | null;
};

/** A sub-category as the form sends it. */
export type SubCategoryInput = {
  id: string | null;
  categoryId: string;
  name: string;
  imageUrl: string | null;
};

/** Saves a top-level category: creates it, or updates the one with this id. */
export async function saveCategory(input: CategoryInput): Promise<ActionResult> {
  await requireAdmin();

  const id = readOptionalId(input?.id);

  const name = readName(input?.name);
  if (!name.ok) return name;

  const imageUrl = readImageUrl(input?.imageUrl);
  if (!imageUrl.ok) return imageUrl;

  if (!imageUrl.value) {
    return actionFail(
      "A desktop image is required — it is the slide on the homepage.",
    );
  }

  const mobileImageUrl = readImageUrl(input?.mobileImageUrl);
  if (!mobileImageUrl.ok) return mobileImageUrl;

  const db = getAdminDb();

  // The slug lookup and the reads the write branches need are all independent,
  // so they run together instead of one after another: the existing row's URLs
  // (edit) and the category order (create) only matter once the write succeeds,
  // and the slug is needed by the write itself.
  const [slug, existing, last] = await Promise.all([
    uniqueSlug("categories", name.value, "category", id),
    id
      ? db
          .from("categories")
          .select("id, slug, image_url, mobile_image_url")
          .eq("id", id)
          .maybeSingle()
      : Promise.resolve(null),
    id
      ? Promise.resolve(null)
      : db
          .from("categories")
          .select("sort_order")
          .order("sort_order", { ascending: false })
          .limit(1)
          .maybeSingle(),
  ]);

  if (id) {
    if (!existing || existing.error || !existing.data) {
      return actionFail("That category no longer exists.");
    }

    const { error } = await db
      .from("categories")
      .update({ name: name.value, slug, image_url: imageUrl.value, mobile_image_url: mobileImageUrl.value })
      .eq("id", id);

    if (error) {
      console.error("[admin] could not update the category.", error.message);
      return actionFail("Could not save the category. Please try again.");
    }

    // A rename moves the category's URL, so the old one is worth clearing too.
    await deleteStoredImages(db, [
      existing.data.image_url === imageUrl.value ? null : existing.data.image_url,
      existing.data.mobile_image_url === mobileImageUrl.value ? null : existing.data.mobile_image_url,
    ]);

    revalidateStorefront({ categorySlugs: [existing.data.slug, slug] });

    return actionOk(`Saved “${name.value}”.`);
  }

  if (!last || last.error) {
    console.error("[admin] could not read the category order.", last?.error?.message);
    return actionFail("Could not save the category. Please try again.");
  }

  // New categories go to the end of the slider; the dashboard has no drag-to-reorder.
  const { error } = await db.from("categories").insert({
    name: name.value,
    slug,
    description: null,
    image_url: imageUrl.value,
    mobile_image_url: mobileImageUrl.value,
    is_active: true,
    sort_order: (last.data?.sort_order ?? 0) + 1,
  });

  if (error) {
    console.error("[admin] could not create the category.", error.message);
    return actionFail("Could not save the category. Please try again.");
  }

  revalidateStorefront({ categorySlugs: [slug] });

  return actionOk(`Added “${name.value}”.`);
}

/**
 * Deletes a top-level category, unless something is still attached to it.
 *
 * Blocked rather than confirmed: `sub_categories.category_id` is `on delete
 * cascade`, so a delete would take a whole branch with it and leave its products'
 * sub-category reference dangling. The admin is told exactly what to clear first.
 */
export async function deleteCategory(input: { id: string }): Promise<ActionResult> {
  await requireAdmin();

  const id = readOptionalId(input?.id);
  if (!id) return actionFail("That category no longer exists.");

  const db = getAdminDb();

  const { data: category, error: readError } = await db
    .from("categories")
    .select("id, name, slug, image_url, mobile_image_url")
    .eq("id", id)
    .maybeSingle();

  if (readError || !category) return actionFail("That category no longer exists.");

  // The two "what is still attached" checks touch different tables, so they are
  // independent and run together.
  const [{ count: subCategoryCount }, { count: productCount }] = await Promise.all([
    db
      .from("sub_categories")
      .select("id", { count: "exact", head: true })
      .eq("category_id", id),
    db
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("category_id", id),
  ]);

  if ((subCategoryCount ?? 0) > 0) {
    return actionFail(
      `“${category.name}” still has ${subCategoryCount} sub-categor${
        subCategoryCount === 1 ? "y" : "ies"
      }. Delete ${subCategoryCount === 1 ? "it" : "them"} first.`,
    );
  }

  if ((productCount ?? 0) > 0) {
    return actionFail(
      `“${category.name}” still has ${productCount} product${
        productCount === 1 ? "" : "s"
      }. Move or delete ${productCount === 1 ? "it" : "them"} first.`,
    );
  }

  const { error } = await db.from("categories").delete().eq("id", id);

  if (error) {
    console.error("[admin] could not delete the category.", error.message);
    return actionFail("Could not delete the category. Please try again.");
  }

  await deleteStoredImages(db, [category.image_url, category.mobile_image_url]);
  revalidateStorefront({ categorySlugs: [category.slug] });

  return actionOk(`Deleted “${category.name}”.`);
}

/** Saves a sub-category under the given top-level category. */
export async function saveSubCategory(
  input: SubCategoryInput,
): Promise<ActionResult> {
  await requireAdmin();

  const id = readOptionalId(input?.id);

  const categoryId = readOptionalId(input?.categoryId);
  if (!categoryId) return actionFail("Choose the category this belongs to.");

  const name = readName(input?.name);
  if (!name.ok) return name;

  const imageUrl = readImageUrl(input?.imageUrl);
  if (!imageUrl.ok) return imageUrl;

  if (!imageUrl.value) return actionFail("An image is required for a sub-category.");

  const db = getAdminDb();

  // The parent read, the slug lookup and (on create) the order read are all
  // independent of one another, so they run together; the existing row read is
  // included too, so an edit needs nothing after this one hop.
  const [parent, slug, existing, last] = await Promise.all([
    db
      .from("categories")
      .select("id, slug")
      .eq("id", categoryId)
      .maybeSingle(),
    uniqueSlug("sub_categories", name.value, "sub-category", id),
    id
      ? db
          .from("sub_categories")
          .select("id, slug, image_url")
          .eq("id", id)
          .maybeSingle()
      : Promise.resolve(null),
    id
      ? Promise.resolve(null)
      : db
          .from("sub_categories")
          .select("sort_order")
          .order("sort_order", { ascending: false })
          .limit(1)
          .maybeSingle(),
  ]);

  if (!parent || !parent.data) return actionFail("That category no longer exists.");

  if (id) {
    if (!existing || existing.error || !existing.data) {
      return actionFail("That sub-category no longer exists.");
    }

    const { error } = await db
      .from("sub_categories")
      .update({ name: name.value, slug, category_id: categoryId, image_url: imageUrl.value })
      .eq("id", id);

    if (error) {
      console.error("[admin] could not update the sub-category.", error.message);
      return actionFail("Could not save the sub-category. Please try again.");
    }

    await deleteStoredImages(db, [existing.data.image_url === imageUrl.value ? null : existing.data.image_url]);

    revalidateStorefront({
      categorySlugs: [parent.data.slug],
      subCategories: [
        { categorySlug: parent.data.slug, subSlug: existing.data.slug },
        { categorySlug: parent.data.slug, subSlug: slug },
      ],
    });

    return actionOk(`Saved “${name.value}”.`);
  }

  if (!last || last.error) {
    console.error("[admin] could not read the sub-category order.", last?.error?.message);
    return actionFail("Could not save the sub-category. Please try again.");
  }

  const { error } = await db.from("sub_categories").insert({
    category_id: categoryId,
    name: name.value,
    slug,
    description: null,
    image_url: imageUrl.value,
    is_active: true,
    sort_order: (last.data?.sort_order ?? 0) + 1,
  });

  if (error) {
    console.error("[admin] could not create the sub-category.", error.message);
    return actionFail("Could not save the sub-category. Please try again.");
  }

  revalidateStorefront({
    categorySlugs: [parent.data.slug],
    subCategories: [{ categorySlug: parent.data.slug, subSlug: slug }],
  });

  return actionOk(`Added “${name.value}”.`);
}

/** Deletes a sub-category, unless products are still filed under it. */
export async function deleteSubCategory(input: {
  id: string;
}): Promise<ActionResult> {
  await requireAdmin();

  const id = readOptionalId(input?.id);
  if (!id) return actionFail("That sub-category no longer exists.");

  const db = getAdminDb();

  const { data: subCategory, error: readError } = await db
    .from("sub_categories")
    .select("id, name, slug, image_url, category_id")
    .eq("id", id)
    .maybeSingle();

  if (readError || !subCategory) {
    return actionFail("That sub-category no longer exists.");
  }

  // The "what is attached" check and the parent's slug (which the storefront
  // paths below need) are on different tables, so they run together — before the
  // delete, not after it.
  const [{ count: productCount }, { data: parent }] = await Promise.all([
    db
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("sub_category_id", id),
    db
      .from("categories")
      .select("slug")
      .eq("id", subCategory.category_id)
      .maybeSingle(),
  ]);

  if ((productCount ?? 0) > 0) {
    return actionFail(
      `“${subCategory.name}” still has ${productCount} product${
        productCount === 1 ? "" : "s"
      }. Move or delete ${productCount === 1 ? "it" : "them"} first.`,
    );
  }

  const { error } = await db.from("sub_categories").delete().eq("id", id);

  if (error) {
    console.error("[admin] could not delete the sub-category.", error.message);
    return actionFail("Could not delete the sub-category. Please try again.");
  }

  await deleteStoredImages(db, [subCategory.image_url]);

  if (parent) {
    revalidateStorefront({
      categorySlugs: [parent.slug],
      subCategories: [{ categorySlug: parent.slug, subSlug: subCategory.slug }],
    });
  } else {
    revalidateStorefront({});
  }

  return actionOk(`Deleted “${subCategory.name}”.`);
}
