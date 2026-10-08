"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import ProductGrid from "@/components/products/ProductGrid";
import { useWishlist } from "@/components/wishlist/WishlistProvider";
import { fetchProductsByIds } from "@/lib/product-cards";
import type { ProductListItem } from "@/lib/products";

type Loaded = {
  /** The wishlist the rows belong to, so stale rows are never shown. */
  key: string;
  items: ProductListItem[];
};

/**
 * The saved products, in the exact grid the listing pages use - same columns,
 * same cards, same hover icons and the same filter/sort toolbar.
 *
 * Only ids live in localStorage, so the products themselves are read from the
 * catalog on the client whenever the list changes. That keeps prices, images and
 * sizes current instead of showing whatever was cached when the heart was
 * clicked.
 */
export default function WishlistGrid() {
  const { ids, hydrated } = useWishlist();
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  // The serialised id list is the dependency, so one lookup runs per change to
  // the wishlist rather than one per new array identity. `null` until the
  // wishlist has actually been read from storage.
  const key = hydrated ? ids.join(",") : null;

  useEffect(() => {
    if (key === null) return;

    let active = true;

    void (async () => {
      const items = await (key === ""
        ? Promise.resolve<ProductListItem[]>([])
        : fetchProductsByIds(key.split(",")));

      if (active) setLoaded({ key, items });
    })();

    return () => {
      active = false;
    };
  }, [key]);

  if (key === null || (loaded !== null && loaded.key !== key)) {
    return (
      <p className="py-16 text-center text-sm text-black/50">
        Loading your wishlist...
      </p>
    );
  }

  if (loaded === null || loaded.items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-5 py-20 text-center">
        <p className="text-sm text-black/60">
          Your wishlist is empty. Tap the heart on any product to save it here.
        </p>
        <Link
          href="/"
          className="inline-flex min-h-11 items-center justify-center border border-plum px-8 text-xs tracking-[0.16em] text-plum uppercase transition-colors hover:bg-plum hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum"
        >
          Continue shopping
        </Link>
      </div>
    );
  }

  return <ProductGrid products={loaded.items} />;
}