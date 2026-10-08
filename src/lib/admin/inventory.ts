"use server";

import { revalidatePath } from "next/cache";

import { getAdminDb } from "@/lib/admin/db";
import { requireAdmin } from "@/lib/admin/guard";
import { revalidateStorefront } from "@/lib/admin/revalidate";
import { actionFail, actionOk, readCount, readOptionalId, type ActionResult } from "@/lib/admin/validation";

export type InventoryUpdateInput = {
  id: string;
  stockQuantity: number | string;
  lowStockThreshold: number | string;
};

export async function updateInventoryRow(
  input: InventoryUpdateInput,
): Promise<ActionResult> {
  await requireAdmin();

  const id = readOptionalId(input?.id);
  if (!id) return actionFail("That product no longer exists.");

  const stockQuantity = readCount(input?.stockQuantity, "Stock quantity");
  if (!stockQuantity.ok) return stockQuantity;

  const lowStockThreshold = readCount(input?.lowStockThreshold, "Low-stock threshold");
  if (!lowStockThreshold.ok) return lowStockThreshold;

  const db = getAdminDb();

  // One hop instead of two: a single returning update reads the product with the
  // write itself, so the slug the revalidation needs never costs a separate round
  // trip. An update that matched nothing means the product was deleted.
  const { data: updated, error } = await db
    .from("products")
    .update({
      stock_quantity: stockQuantity.value,
      low_stock_threshold: lowStockThreshold.value,
    })
    .eq("id", id)
    .select("id, name, slug")
    .maybeSingle();

  if (error) {
    console.error("[admin] could not update the stock levels.", error.message);
    return actionFail("Could not save. Please try again.");
  }

  if (!updated) return actionFail("That product no longer exists.");

  revalidatePath("/admin/products");
  revalidatePath("/admin/inventory");
  revalidateStorefront({
    productSlugs: [updated.slug],
  });

  return actionOk(
    `Saved “${updated.name}” — ${stockQuantity.value} in stock, low stock at ${lowStockThreshold.value}.`,
  );
}
