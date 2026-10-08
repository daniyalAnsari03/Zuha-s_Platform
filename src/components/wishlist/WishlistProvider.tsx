"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";

import { createStoredValue } from "@/lib/local-storage";

const STORAGE_KEY = "zuha.wishlist.v1";

function isProductIdArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.every((entry) => typeof entry === "string" && entry.length > 0)
  );
}

type WishlistContextValue = {
  /** Saved product ids, in the order they were added. */
  ids: string[];
  count: number;
  /** False until the saved wishlist has been read from localStorage. */
  hydrated: boolean;
  isSaved: (productId: string) => boolean;
  toggle: (productId: string) => void;
  remove: (productId: string) => void;
  clear: () => void;
};

const WishlistContext = createContext<WishlistContextValue | null>(null);

/**
 * Guest wishlist: works with no account, persisted in localStorage.
 *
 * Only ids are stored, so the page can re-read live prices and images from the
 * catalog later instead of showing a stale snapshot. The store is the same
 * hydration-safe localStorage wrapper the cart uses.
 */
export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const [store] = useState(() =>
    createStoredValue<string[]>({
      key: STORAGE_KEY,
      createInitial: () => [],
      isValid: isProductIdArray,
    }),
  );

  const ids = useSyncExternalStore(
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
    (next: (current: string[]) => string[]) => {
      store.set(next(store.getSnapshot()));
    },
    [store],
  );

  const isSaved = useCallback(
    (productId: string) => ids.includes(productId),
    [ids],
  );

  const toggle = useCallback(
    (productId: string) => {
      update((current) =>
        current.includes(productId)
          ? current.filter((id) => id !== productId)
          : [...current, productId],
      );
    },
    [update],
  );

  const remove = useCallback(
    (productId: string) => {
      update((current) => current.filter((id) => id !== productId));
    },
    [update],
  );

  const clear = useCallback(() => update(() => []), [update]);

  const value = useMemo<WishlistContextValue>(
    () => ({ ids, count: ids.length, hydrated, isSaved, toggle, remove, clear }),
    [ids, hydrated, isSaved, toggle, remove, clear],
  );

  return (
    <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>
  );
}

export function useWishlist() {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error("useWishlist must be used within WishlistProvider");
  }
  return context;
}