"use server";

/**
 * Products: the dashboard's create / edit / delete actions.
 *
 * Same contract as the category actions (see `lib/admin/categories.ts`):
 * `requireAdmin()` first, every field re-validated here rather than trusted, the
 * parent rows re-read from the database so a stale form cannot file a product
 * under a category it does not belong to, gallery images that are no longer
 * referenced deleted from Storage, and the storefront revalidated so the listing
 * and the product page show the change on the next load.
 *
 * The stock columns are written here as well as on the Inventory screen: both
 * edit the same `stock_quantity` / `low_stock_threshold` columns, so a change
 * saved in either place shows up in the other and on the dashboard's low-stock
 * section.
 */

import { revalidatePath } from "next/cache";

import { getAdminDb } from "@/lib/admin/db";
import { requireAdmin } from "@/lib/admin/guard";
import { uniqueSlug } from "@/lib/admin/queries";
import { revalidateStorefront } from "@/lib/admin/revalidate";
import { deleteStoredImages } from "@/lib/admin/storage";
import {
  actionFail,
  actionOk,
  MAX_GALLERY_IMAGES,
  MAX_PRODUCT_DESCRIPTION_LENGTH,
  readCount,
  readDescription,
  readImageUrl,
  readName,
  readOptionalId,
  readOptionalPrice,
  readOptionList,
  readPrice,
  readRequiredId,
  type ActionError,
  type ActionResult,
} from "@/lib/admin/validation";

export type ProductInput = {
  id: string | null;
  name: string;
  description: string | null;
  categoryId: string;
  subCategoryId: string | null;
  price: number | string;
  discountPrice: number | string | null;
  sizes: string | null;
  color: string | null;
  stockQuantity: number | string;
  lowStockThreshold: number | string;
  images: string[];
};

/**
 * The gallery the browser sent.
 *
 * Empty is allowed — the listing card falls back to a placeholder — but every
 * entry has to be a plain http(s) URL and the count cannot exceed the gallery
 * limit, so a hand-edited payload cannot store something that is not an image.
 */
function readGallery(value: unknown): { ok: true; value: string[] } | ActionError {
  if (value === undefined || value === null) return { ok: true, value: [] };
  if (!Array.isArray(value)) {
    return actionFail("The images could not be read. Remove and re-add them.");
  }

  if (value.length > MAX_GALLERY_IMAGES) {
    return actionFail(`A product can have at most ${MAX_GALLERY_IMAGES} images.`);
  }

  const urls: string[] = [];

  for (const entry of value) {
    if (typeof entry !== "string") {
      return actionFail("The images could not be read. Remove and re-add them.");
    }

    const url = readImageUrl(entry);
    if (!url.ok) return url;
    if (url.value) urls.push(url.value);
  }

  return { ok: true, value: urls };
}

/** Saves a product: creates it, or updates the one with this id. */
export async function saveProduct(input: ProductInput): Promise<ActionResult> {
  await requireAdmin();

  const id = readOptionalId(input?.id);

  const name = readName(input?.name);
  if (!name.ok) return name;

  const description = readDescription(
    input?.description,
    MAX_PRODUCT_DESCRIPTION_LENGTH,
  );
  if (!description.ok) return description;

  const categoryId = readRequiredId(input?.categoryId, "Category");
  if (!categoryId.ok) return categoryId;

  const subCategoryId = readOptionalId(input?.subCategoryId);

  const price = readPrice(input?.price, "Price");
  if (!price.ok) return price;

  const discountPrice = readOptionalPrice(input?.discountPrice, "Discount price");
  if (!discountPrice.ok) return discountPrice;

  if (discountPrice.value !== null && discountPrice.value >= price.value) {
    return actionFail("The discount price has to be lower than the price.");
  }

  const sizes = readOptionList(input?.sizes, "Sizes");
  if (!sizes.ok) return sizes;

  const color = readOptionList(input?.color, "Colours");
  if (!color.ok) return color;

  const stockQuantity = readCount(input?.stockQuantity, "Stock quantity");
  if (!stockQuantity.ok) return stockQuantity;

  const lowStockThreshold = readCount(
    input?.lowStockThreshold,
    "Low-stock threshold",
  );
  if (!lowStockThreshold.ok) return lowStockThreshold;

  const images = readGallery(input?.images);
  if (!images.ok) return images;

  const db = getAdminDb();

  // Everything the write needs is read up front, and all of these reads are
  // independent of one another, so they run together: the two parent lookups,
  // the slug, the current row on edit, and — only when nothing points at a
  // sub-category — the check that the category does not list one (otherwise the
  // product would never appear on the storefront). The browser's ids are only
  // accepted after their rows come back from the database.
  const [
    categoryResult,
    subCategoryResult,
    slug,
    existingResult,
    subCategoryCount,
  ] = await Promise.all([
    db
      .from("categories")
      .select("id, slug, name")
      .eq("id", categoryId.value)
      .maybeSingle(),
    subCategoryId
      ? db
          .from("sub_categories")
          .select("id, category_id")
          .eq("id", subCategoryId)
          .maybeSingle()
      : Promise.resolve(null),
    uniqueSlug("products", name.value, "product", id),
    id
      ? db
          .from("products")
          .select("id, slug, images")
          .eq("id", id)
          .maybeSingle()
      : Promise.resolve(null),
    subCategoryId
      ? Promise.resolve(null)
      : db
          .from("sub_categories")
          .select("id", { count: "exact", head: true })
          .eq("category_id", categoryId.value)
          .eq("is_active", true)
          .then(({ count }) => count),
  ]);

  if (categoryResult.error || !categoryResult.data) {
    console.error(
      "[admin] could not read the product's category.",
      categoryResult.error?.message,
    );
    return actionFail("That category no longer exists.");
  }

  const category = categoryResult.data;

  if (subCategoryId) {
    const subCategory = subCategoryResult;

    if (!subCategory || subCategory.error || !subCategory.data) {
      console.error(
        "[admin] could not read the product's sub-category.",
        subCategory?.error?.message,
      );
      return actionFail("That sub-category no longer exists.");
    }

    if (subCategory.data.category_id !== category.id) {
      return actionFail("That sub-category belongs to a different category.");
    }
  } else if ((subCategoryCount ?? 0) > 0) {
    return actionFail(
      `“${category.name}” has sub-categories — choose one, otherwise the product would never appear on the storefront.`,
    );
  }

  const row = {
    name: name.value,
    slug,
    description: description.value,
    category_id: category.id,
    sub_category_id: subCategoryId,
    price: price.value,
    discount_price: discountPrice.value,
    sizes: sizes.value,
    color: color.value,
    stock_quantity: stockQuantity.value,
    low_stock_threshold: lowStockThreshold.value,
    images: images.value,
  };

  if (id) {
    if (!existingResult || existingResult.error || !existingResult.data) {
      return actionFail("That product no longer exists.");
    }

    const existing = existingResult.data;

    const { error } = await db.from("products").update(row).eq("id", id);

    if (error) {
      console.error("[admin] could not update the product.", error.message);
      return actionFail("Could not save the product. Please try again.");
    }

    // Only files that are no longer referenced by the saved row are removed, so
    // an image kept in the gallery is never deleted.
    const stillUsed = new Set(images.value);
    await deleteStoredImages(
      db,
      (existing.images ?? []).filter((url) => !stillUsed.has(url)),
    );

    refreshAdminProductScreens();
    // The old slug too: renaming a product changes its URL.
    revalidateStorefront({ productSlugs: [existing.slug, slug] });

    return actionOk(`Saved “${name.value}”.`);
  }

  // `is_featured` is not exposed anywhere yet and defaults to false in the
  // schema; the generated types require it on insert, so it is stated here.
  const { error } = await db
    .from("products")
    .insert({ ...row, is_active: true, is_featured: false });

  if (error) {
    console.error("[admin] could not create the product.", error.message);
    return actionFail("Could not save the product. Please try again.");
  }

  refreshAdminProductScreens();
  revalidateStorefront({ productSlugs: [slug] });

  return actionOk(`Added “${name.value}”.`);
}

/** Deletes a product, its gallery files, and everything that showed it. */
export async function deleteProduct(input: {
  id: string;
}): Promise<ActionResult> {
  await requireAdmin();

  const id = readOptionalId(input?.id);
  if (!id) return actionFail("That product no longer exists.");

  const db = getAdminDb();

  const { data: product, error: readError } = await db
    .from("products")
    .select("id, name, slug, images")
    .eq("id", id)
    .maybeSingle();

  if (readError || !product) {
    return actionFail("That product no longer exists.");
  }

  const { error } = await db.from("products").delete().eq("id", id);

  if (error) {
    // 23503 is a foreign key violation. Order lines keep their own copy of the
    // name, price and quantity, and `order_items.product_id` is `on delete set
    // null`, so this should not happen — but a future schema change that adds a
    // reference has to be reported as a sentence, never as a database error.
    const blocked = error.code === "23503";

    console.error("[admin] could not delete the product.", error.message);

    return actionFail(
      blocked
        ? `“${product.name}” is still referenced elsewhere and cannot be deleted.`
        : "Could not delete the product. Please try again.",
    );
  }

  await deleteStoredImages(db, product.images ?? []);

  refreshAdminProductScreens();
  revalidateStorefront({ productSlugs: [product.slug] });

  return actionOk(`Deleted “${product.name}”.`);
}

/** The two dashboard screens that show a product's stock and list. */
function refreshAdminProductScreens(): void {
  revalidatePath("/admin/products");
  revalidatePath("/admin/inventory");
}
