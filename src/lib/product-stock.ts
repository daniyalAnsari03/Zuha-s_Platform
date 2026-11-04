import { createClient } from "@/lib/supabase/client";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Reads the current public stock for cart validation; the order RPC remains authoritative. */
export async function fetchProductStocks(
  productIds: readonly string[],
): Promise<Record<string, number>> {
  const ids = Array.from(new Set(productIds));
  const validIds = ids.filter((id) => UUID_PATTERN.test(id));
  const stockById = Object.fromEntries(ids.map((id) => [id, 0]));

  if (validIds.length === 0) return stockById;

  const { data, error } = await createClient()
    .from("products")
    .select("id, stock_quantity, is_active")
    .in("id", validIds);

  if (error) throw error;

  for (const product of data ?? []) {
    stockById[product.id] = product.is_active
      ? Math.max(0, Number(product.stock_quantity ?? 0))
      : 0;
  }

  return stockById;
}
