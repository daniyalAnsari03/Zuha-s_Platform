/**
 * Product listing domain helpers.
 *
 * Deliberately free of any server-only import (no Supabase, no `next/headers`)
 * so the client-side grid can share the exact same types and maths as the
 * server-side data loader in `product-data.ts`.
 */

/** A single product as the listing grid needs it. */
export type ProductListItem = {
  id: string;
  name: string;
  slug: string;
  /** First gallery image, used as the card thumbnail. */
  imageUrl: string | null;
  /**
   * Second gallery image, if any. The listing card swaps to it on desktop
   * hover; a product with only one image leaves it `null`.
   */
  secondImageUrl: string | null;
  price: number;
  discountPrice: number | null;
  /** Parsed, de-duplicated sizes in display order. */
  sizes: string[];
  /** Parsed, de-duplicated colours in display order. */
  colors: string[];
  createdAt: string;
};

export type ProductListingData = {
  /** Heading shown above the grid. */
  title: string;
  items: ProductListItem[];
};

/**
 * The two stock numbers the admin edits side by side.
 *
 * `isLowStock` below is the single definition of "low stock" for the whole app:
 * the inventory table, the dashboard's low-stock section and anything added later
 * all call it, so the flag can never disagree between screens.
 */
export type StockLevels = {
  stockQuantity: number;
  lowStockThreshold: number;
};

/**
 * A product is low stock when its quantity has reached its threshold — `0 <= 5`
 * counts, because a product that has run out is the most urgent row in the list.
 */
export function isLowStock(item: StockLevels): boolean {
  return item.stockQuantity <= item.lowStockThreshold;
}

/**
 * Splits an admin free-text list such as "S, M, L" or " Black ,  Red ,Black"
 * into trimmed, de-duplicated values, preserving the order they were typed in.
 */
export function parseOptionList(value: string | null | undefined): string[] {
  if (!value) return [];

  const seen = new Set<string>();
  const options: string[] = [];

  for (const raw of value.split(",")) {
    const option = raw.trim();
    if (!option) continue;

    const key = option.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    options.push(option);
  }

  return options;
}

/**
 * Pairs a gallery's URLs with their per-image colour tags (migration 017).
 *
 * `products.image_colors` is index-aligned with `products.images`, but a NULL
 * column, a NULL element, or one that is shorter than the gallery has to keep
 * working: every missing entry becomes "" ("no tag"), and empty URLs are
 * dropped **with their tag in the same pass**, so a colour can never shift
 * from one image onto another.
 */
export function pairImagesWithColors(
  images: readonly (string | null)[] | null | undefined,
  colors: readonly (string | null)[] | null | undefined,
): { url: string; color: string }[] {
  const pairs: { url: string; color: string }[] = [];

  (images ?? []).forEach((url, index) => {
    if (!url) return;

    const tag = colors?.[index];
    pairs.push({ url, color: typeof tag === "string" ? tag : "" });
  });

  return pairs;
}

/**
 * The price a product is actually sold at: the discount price when the admin
 * set one, otherwise the regular price. Filters and sorting both use this, so
 * a discounted product sorts by what the customer pays.
 */
export function effectivePrice(
  item: Pick<ProductListItem, "price" | "discountPrice">,
): number {
  const { price, discountPrice } = item;
  if (
    discountPrice !== null &&
    Number.isFinite(discountPrice) &&
    discountPrice > 0 &&
    price > 0 &&
    discountPrice < price
  ) {
    return discountPrice;
  }
  return price;
}

/**
 * Whole-percent discount for two raw amounts, rounded (e.g. price 3999 /
 * discount 2799 -> 30). Returns null when the pair is not an actual discount
 * (no discount price, a non-positive price or a discount that is not lower).
 * The one shared formula: the storefront badge and the admin form both call
 * this, so the percentage can never disagree between screens.
 */
export function discountPercentFor(
  price: number,
  discountPrice: number | null,
): number | null {
  if (discountPrice === null || price <= 0 || discountPrice <= 0 || discountPrice >= price) {
    return null;
  }

  const percent = Math.round(((price - discountPrice) / price) * 100);
  return percent > 0 ? percent : null;
}

/** {@link discountPercentFor} for a product-like row. */
export function discountPercent(
  item: Pick<ProductListItem, "price" | "discountPrice">,
): number | null {
  return discountPercentFor(item.price, item.discountPrice ?? null);
}