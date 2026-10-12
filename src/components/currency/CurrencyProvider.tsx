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
  isCurrencyAvailable,
  listAvailableCurrencies,
  readStoredCurrency,
  storeCurrency,
  type Currency,
  type CurrencyRates,
} from "@/lib/currency";

type CurrencyContextValue = {
  /** The currency prices are shown in right now. */
  currency: Currency;
  /** Every admin-set rate: `1 <CUR> = X PKR`. */
  rates: CurrencyRates;
  /** PKR plus every currency that has a rate, in switcher order. */
  availableCurrencies: Currency[];
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
 * The rates are read server-side and passed in (see `src/lib/currency-rate.ts`),
 * so this stays a thin client provider and statically generated pages keep
 * working. The selected currency is deliberately PKR on the server and on the
 * first client render — the saved choice is read through `useSyncExternalStore`,
 * which React serves with the server snapshot during hydration and only then
 * swaps in the client value, so there is never a hydration mismatch.
 */
export function CurrencyProvider({
  rates,
  children,
}: {
  rates: CurrencyRates;
  children: ReactNode;
}) {
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

  const availableCurrencies = useMemo(
    () => listAvailableCurrencies(rates),
    [rates],
  );

  // A saved choice is only honoured while its rate still exists; if the admin
  // has cleared it, the shopper falls back to PKR rather than a broken
  // conversion.
  const currency: Currency = isCurrencyAvailable(stored, rates)
    ? stored
    : DEFAULT_CURRENCY;

  const setCurrency = useCallback((next: Currency) => {
    storeCurrency(next);
    window.dispatchEvent(new Event(CURRENCY_CHANGE_EVENT));
  }, []);

  const value = useMemo<CurrencyContextValue>(
    () => ({
      currency,
      rates,
      availableCurrencies,
      hydrated,
      setCurrency,
    }),
    [currency, rates, availableCurrencies, hydrated, setCurrency],
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
