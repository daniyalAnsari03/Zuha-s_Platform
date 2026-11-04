"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

import { fetchProductStocks } from "@/lib/product-stock";

type StockSnapshot = {
  key: string;
  stockById: Record<string, number>;
  error: string | null;
  loading: boolean;
};

const EMPTY_SNAPSHOT: StockSnapshot = {
  key: "",
  stockById: {},
  error: null,
  loading: false,
};

class ProductStockStore {
  private snapshot = EMPTY_SNAPSHOT;
  private listeners = new Set<() => void>();
  private request = 0;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = () => this.snapshot;

  getServerSnapshot = () => EMPTY_SNAPSHOT;

  refresh(key: string, ids: string[]) {
    const request = ++this.request;
    this.setSnapshot({ key, stockById: {}, error: null, loading: true });

    void fetchProductStocks(ids)
      .then((stockById) => {
        if (request === this.request) {
          this.setSnapshot({ key, stockById, error: null, loading: false });
        }
      })
      .catch((error: unknown) => {
        console.error("[cart] could not refresh product stock.", error);
        if (request === this.request) {
          this.setSnapshot({
            key,
            stockById: {},
            error: "We couldn't check stock right now. Please try again.",
            loading: false,
          });
        }
      });
  }

  clear() {
    this.request += 1;
    this.setSnapshot(EMPTY_SNAPSHOT);
  }

  private setSnapshot(snapshot: StockSnapshot) {
    this.snapshot = snapshot;
    this.listeners.forEach((listener) => listener());
  }
}

/** Refreshes stock for the products currently being checked out or shown in the cart. */
export function useCartStock(productIds: readonly string[], enabled: boolean) {
  const key = Array.from(new Set(productIds)).sort().join(",");
  const [store] = useState(() => new ProductStockStore());
  const snapshot = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );

  useEffect(() => {
    if (!enabled || !key) {
      store.clear();
      return;
    }

    store.refresh(key, key.split(","));
  }, [enabled, key, store]);

  if (!enabled) {
    return { stockById: {}, error: null, loading: false };
  }

  return {
    stockById: snapshot.key === key ? snapshot.stockById : {},
    error: snapshot.key === key ? snapshot.error : null,
    loading: key.length > 0 && (snapshot.key !== key || snapshot.loading),
  };
}
