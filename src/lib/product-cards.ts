/**
 * Client-side product lookups: everything a browser component needs to turn
 * stored ids (wishlist) or a typed query (search) into real `ProductListItem`
 * rows.
 *
 * The browser Supabase client is used directly, so the results are always the
 * live catalog - no API route and no server round trip per keystroke. When the
 * catalog has no matching rows the lookup returns nothing and the caller renders
 * its own empty state; a failing query is logged and rethrown so the error
 * boundary shows.
 */

import {
  parseOptionList,
  type ProductListItem,
} from "@/lib/products";
import { createClient } from "@/lib/supabase/client";

/**
 * Columns a product card needs: the first gallery image, both prices, the free
 * text sizes (the card's add-to-cart has to know whether a size is required)
 * and `created_at` for the "Newest" sort.
 *
 * `color` was added by migration 004, so the query asks for it but retries
 * without it when the column is not there yet - the same approach the
 * server-side loader takes.
 */
const PRODUCT_CARD_COLUMNS =
  "id, name, slug, price, discount_price, sizes, color, images, created_at";

const PRODUCT_CARD_COLUMNS_WITHOUT_COLOR =
  "id, name, slug, price, discount_price, sizes, images, created_at";

type ProductRow = {
  id: string;
  name: string;
  slug: string;
  price: number;
  discount_price: number | null;
  sizes: string | null;
  color?: string | null;
  images: string[] | null;
  created_at: string;
};

function toListItem(row: ProductRow): ProductListItem {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    imageUrl: row.images?.[0] ?? null,
    secondImageUrl: row.images?.[1] ?? null,
    price: Number(row.price),
    discountPrice: row.discount_price === null ? null : Number(row.discount_price),
    sizes: parseOptionList(row.sizes),
    colors: parseOptionList(row.color),
    createdAt: row.created_at,
  };
}

/**
 * Products for a set of ids, in the order the ids were given (the order the
 * customer saved them in).
 *
 * Anything the catalog no longer returns (deleted or deactivated) is simply
 * left out, so a saved item whose product is gone drops off rather than being
 * replaced with fabricated data.
 */
export async function fetchProductsByIds(
  ids: string[],
): Promise<ProductListItem[]> {
  if (ids.length === 0) return [];

  let supabase;
  try {
    supabase = createClient();
  } catch (error) {
    console.error("[product-cards] could not create the Supabase client.", error);
    throw error;
  }

  const withColor = await supabase
    .from("products")
    .select(PRODUCT_CARD_COLUMNS)
    .in("id", ids)
    .eq("is_active", true);

  let rows: ProductRow[];

  if (withColor.error && isMissingColumnError(withColor.error)) {
    const withoutColor = await supabase
      .from("products")
      .select(PRODUCT_CARD_COLUMNS_WITHOUT_COLOR)
      .in("id", ids)
      .eq("is_active", true);

    if (withoutColor.error) {
      console.error(
        "[product-cards] products query without the color column failed too; apply supabase/migrations/004_add_product_color.sql.",
        withoutColor.error,
      );
      throw withoutColor.error;
    }

    console.warn(
      "[product-cards] products.color is missing; apply supabase/migrations/004_add_product_color.sql to enable colour filters.",
    );

    rows = withoutColor.data ?? [];
  } else if (withColor.error) {
    console.error("[product-cards] products query failed.", withColor.error);
    throw withColor.error;
  } else {
    rows = withColor.data ?? [];
  }

  const byId = new Map(rows.map((row) => [row.id, toListItem(row)]));

  return ids.flatMap((id) => {
    const product = byId.get(id);
    return product ? [product] : [];
  });
}

/**
 * PostgREST reports an unknown column as `42703` (undefined_column) or
 * `PGRST204` when it is missing from the schema cache.
 */
function isMissingColumnError(error: { code?: string; message?: string }) {
  if (error.code === "42703" || error.code === "PGRST204") return true;

  const message = error.message ?? "";
  return /color/i.test(message) && /(column|does not exist|not found)/i.test(message);
}
