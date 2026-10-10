"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import {
  DEFAULT_CURRENCY,
  readStoredCurrency,
  storeCurrency,
  type Currency,
} from "@/lib/currency";

type CurrencyContextValue = {
  /** The currency prices are shown in right now. */
  currency: Currency;
  /** `1 USD = X PKR`, or `null` when the admin has not set one yet. */
  rate: number | null;
  /** True when USD can be offered at all (a positive rate exists). */
  usdAvailable: boolean;
  /**
   * False during hydration, true afterwards. `<Price>` uses it to fade only the
   * switch, never the initial paint.
   */
  hydrated: boolean;
  setCurrency: (currency: Currency) => void;
};

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

/** Same-tab notification: the `storage` event only fires in *other* tabs. */
const CURRENCY_CHANGE_EVENT = "zuhas:currency-change";

/** Never called; the store only answers "has the client mounted yet?". */
const emptySubscribe = () => () => {};

function subscribe(onStoreChange: () => void): () => void {
  window.addEventListener(CURRENCY_CHANGE_EVENT, onStoreChange);
  window.addEventListener("storage", onStoreChange);

  return () => {
    window.removeEventListener(CURRENCY_CHANGE_EVENT, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

/** Reads the saved choice. Returning a primitive keeps the snapshot compare cheap. */
function getCurrencySnapshot(): Currency {
  return readStoredCurrency();
}

/** The server, and the first client render, always show PKR. */
function getServerCurrencySnapshot(): Currency {
  return DEFAULT_CURRENCY;
}

/**
 * Holds the storefront's selected currency.
 *
 * The rate is read server-side and passed in (see `src/lib/currency-rate.ts`),
 * so this stays a thin client provider and statically generated pages keep
 * working. The selected currency is deliberately PKR on the server and on the
 * first client render — the saved choice is read through `useSyncExternalStore`,
 * which React serves with the server snapshot during hydration and only then
 * swaps in the client value, so there is never a hydration mismatch.
 */
export function CurrencyProvider({
  usdRate,
  children,
}: {
  usdRate: number | null;
  children: ReactNode;
}) {
  const usdAvailable = usdRate !== null && usdRate > 0;
  const stored = useSyncExternalStore(
    subscribe,
    getCurrencySnapshot,
    getServerCurrencySnapshot,
  );
  const hydrated = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  // A saved USD choice is only honoured while a rate still exists; otherwise the
  // shopper is left on PKR rather than shown a broken conversion.
  const currency: Currency =
    usdAvailable && stored === "USD" ? "USD" : DEFAULT_CURRENCY;

  const setCurrency = useCallback((next: Currency) => {
    storeCurrency(next);
    window.dispatchEvent(new Event(CURRENCY_CHANGE_EVENT));
  }, []);

  const value = useMemo<CurrencyContextValue>(
    () => ({
      currency,
      rate: usdRate,
      usdAvailable,
      hydrated,
      setCurrency,
    }),
    [currency, usdRate, usdAvailable, hydrated, setCurrency],
  );

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency(): CurrencyContextValue {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error("useCurrency must be used within a CurrencyProvider.");
  }
  return context;
}
