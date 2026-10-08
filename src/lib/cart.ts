/**
 * Cart domain helpers, deliberately free of any server-only import so the
 * provider, the navbar popup and the add-to-cart buttons all share one shape.
 */

export type CartItem = {
  productId: string;
  name: string;
  /** First gallery image, used as the thumbnail in the cart popup. */
  image: string | null;
  /**
   * The effective price captured when the item was added (the discount price
   * when the product has one), so the cart total never has to re-read the
   * catalog.
   */
  price: number;
  /** Null for products the admin left without sizes. */
  size: string | null;
  /**
   * Null for products the admin left without colours. Carts saved before the
   * field existed read as `undefined` at runtime, which {@link cartItemKey}
   * treats exactly like null, so an old basket is never dropped.
   */
  color: string | null;
  quantity: number;
};

/**
 * Two rows are the same cart line only when they are the same product, the same
 * size *and* the same colour, so adding "Shirt / M / Black" twice bumps its
 * quantity instead of adding a second line, while "Shirt / M / White" stays a
 * line of its own.
 */
export function cartItemKey(
  productId: string,
  size: string | null,
  color: string | null | undefined,
): string {
  return `${productId}::${size ?? ""}::${color ?? ""}`;
}

/** Total units in the cart; this is what the navbar badge shows. */
export function cartItemCount(items: CartItem[]): number {
  return items.reduce((total, item) => total + item.quantity, 0);
}

/** Sum of `price x quantity` for every line. */
export function cartSubtotal(items: CartItem[]): number {
  return items.reduce((total, item) => total + item.price * item.quantity, 0);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * Guards what comes back out of localStorage. Anything that does not look like
 * a cart line is dropped rather than rendered, so a bad write (or a write from
 * an older shape of this app) degrades to a smaller cart instead of a crash.
 */
export function isCartItemArray(value: unknown): value is CartItem[] {
  if (!Array.isArray(value)) return false;

  return value.every((entry) => {
    if (
      typeof entry !== "object" ||
      entry === null ||
      typeof (entry as CartItem).productId !== "string" ||
      typeof (entry as CartItem).name !== "string" ||
      !isFiniteNumber((entry as CartItem).price) ||
      !isFiniteNumber((entry as CartItem).quantity) ||
      (entry as CartItem).quantity <= 0
    ) {
      return false;
    }

    // `color` was added after the first carts were saved, so its absence is
    // accepted; a colour that is neither text nor null is not.
    const color = (entry as CartItem).color;
    return color === undefined || color === null || typeof color === "string";
  });
}