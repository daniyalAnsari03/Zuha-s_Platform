"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";

import {
  cartItemCount,
  cartItemKey,
  cartProductQuantity,
  cartSubtotal,
  isCartItemArray,
  type CartItem,
} from "@/lib/cart";
import { createStoredValue } from "@/lib/local-storage";

const STORAGE_KEY = "zuha.cart.v1";

/** What a caller has to know about a product to put it in the cart. */
export type AddToCartInput = {
  productId: string;
  name: string;
  sku: string | null;
  image: string | null;
  /** Pass the effective (discount) price, not the struck-through one. */
  price: number;
  /** Current stock snapshot shared by all variants of this product. */
  stockQuantity: number;
  size: string | null;
  /** The colour the shopper picked, or null when the product has none. */
  color: string | null;
  quantity?: number;
};

type CartContextValue = {
  items: CartItem[];
  /** Total units, i.e. the navbar badge count. */
  count: number;
  subtotal: number;
  /**
   * False until the saved cart has been read from localStorage. Everything
   * rendered off this context starts empty on the server and fills in right
   * after hydration, so no count ever flashes.
   */
  hydrated: boolean;
  addItem: (input: AddToCartInput) => void;
  increment: (key: string, stockQuantity?: number) => void;
  decrement: (key: string) => void;
  setQuantity: (key: string, quantity: number, stockQuantity?: number) => void;
  removeItem: (key: string) => void;
  clearCart: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

/**
 * Guest cart: works with no account, persisted in localStorage.
 *
 * The saved cart is an external store, so the server renders an empty cart and
 * the browser picks the real one up during hydration without a mismatch, and
 * every mutation writes straight through to storage.
 */
export function CartProvider({ children }: { children: React.ReactNode }) {
  const [store] = useState(() =>
    createStoredValue<CartItem[]>({
      key: STORAGE_KEY,
      createInitial: () => [],
      isValid: isCartItemArray,
    }),
  );

  const items = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );
  const hydrated = useSyncExternalStore(
    store.subscribe,
    store.isHydrated,
    store.isHydratedServerSnapshot,
  );

  const update = useCallback(
    (next: (current: CartItem[]) => CartItem[]) => {
      store.set(next(store.getSnapshot()));
    },
    [store],
  );

  const addItem = useCallback(
    (input: AddToCartInput) => {
      const requestedQuantity = Math.max(1, Math.floor(input.quantity ?? 1));
      const stockQuantity = Number.isFinite(input.stockQuantity)
        ? Math.max(0, Math.floor(input.stockQuantity))
        : 0;
      const key = cartItemKey(input.productId, input.size, input.color);

      update((current) => {
        const available = Math.max(
          0,
          stockQuantity - cartProductQuantity(current, input.productId),
        );
        const quantity = Math.min(requestedQuantity, available);
        if (quantity === 0) return current;

        const existing = current.findIndex(
          (item) => cartItemKey(item.productId, item.size, item.color) === key,
        );

        if (existing === -1) {
          return [
            ...current.map((item) =>
              item.productId === input.productId
                ? { ...item, stockQuantity }
                : item,
            ),
            {
              productId: input.productId,
              name: input.name,
              sku: input.sku,
              image: input.image,
              price: input.price,
              stockQuantity,
              size: input.size,
              color: input.color,
              quantity,
            },
          ];
        }

        return current.map((item, index) => {
          if (item.productId !== input.productId) return item;
          if (index === existing) {
            return {
              ...item,
              sku: item.sku ?? input.sku,
              stockQuantity,
              quantity: item.quantity + quantity,
            };
          }
          return { ...item, stockQuantity };
        });
      });
    },
    [update],
  );

  const changeQuantity = useCallback(
    (key: string, delta: number, latestStock?: number) => {
      update((current) => {
        const target = current.find(
          (item) => cartItemKey(item.productId, item.size, item.color) === key,
        );
        if (!target) return current;

        const stockQuantity =
          typeof latestStock === "number" && Number.isFinite(latestStock)
            ? Math.max(0, Math.floor(latestStock))
            : target.stockQuantity ?? Number.MAX_SAFE_INTEGER;
        const quantityInCart = cartProductQuantity(current, target.productId);
        const increase = delta > 0
          ? Math.min(delta, Math.max(0, stockQuantity - quantityInCart))
          : delta;

        return current.flatMap((item) => {
          if (cartItemKey(item.productId, item.size, item.color) !== key) {
            return item.productId === target.productId &&
              typeof latestStock === "number"
              ? [{ ...item, stockQuantity }]
              : [item];
          }

          const quantity = item.quantity + increase;
          // Dropping to zero removes the line, so there is never an empty row.
          return quantity > 0
            ? [{
                ...item,
                quantity,
                ...(typeof latestStock === "number" ? { stockQuantity } : {}),
              }]
            : [];
        });
      });
    },
    [update],
  );

  const increment = useCallback(
    (key: string, stockQuantity?: number) =>
      changeQuantity(key, 1, stockQuantity),
    [changeQuantity],
  );

  const decrement = useCallback(
    (key: string) => changeQuantity(key, -1),
    [changeQuantity],
  );

  const setQuantity = useCallback(
    (key: string, quantity: number, latestStock?: number) => {
      update((current) => {
        const target = current.find(
          (item) => cartItemKey(item.productId, item.size, item.color) === key,
        );
        if (!target) return current;

        const stockQuantity =
          typeof latestStock === "number" && Number.isFinite(latestStock)
            ? Math.max(0, Math.floor(latestStock))
            : target.stockQuantity ?? Number.MAX_SAFE_INTEGER;
        const otherQuantity =
          cartProductQuantity(current, target.productId) - target.quantity;
        const maximum = stockQuantity - otherQuantity;
        if (maximum < 1) return current;

        const next = Math.min(Math.max(1, Math.floor(quantity)), maximum);
        return current.map((item) =>
          item.productId === target.productId &&
          typeof latestStock === "number"
            ? { ...item, stockQuantity }
            : cartItemKey(item.productId, item.size, item.color) === key
              ? { ...item, quantity: next }
              : item,
        );
      });
    },
    [update],
  );

  const removeItem = useCallback(
    (key: string) => {
      update((current) =>
        current.filter(
          (item) => cartItemKey(item.productId, item.size, item.color) !== key,
        ),
      );
    },
    [update],
  );

  const clearCart = useCallback(() => update(() => []), [update]);

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      count: cartItemCount(items),
      subtotal: cartSubtotal(items),
      hydrated,
      addItem,
      increment,
      decrement,
      setQuantity,
      removeItem,
      clearCart,
    }),
    [
      items,
      hydrated,
      addItem,
      increment,
      decrement,
      setQuantity,
      removeItem,
      clearCart,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within CartProvider");
  }
  return context;
}