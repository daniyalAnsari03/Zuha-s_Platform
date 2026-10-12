/**
 * The storefront currency layer.
 *
 * Every amount the app stores and reasons about is in **PKR** — products,
 * cart lines, orders and analytics never change. Every other currency is a
 * display-only conversion of the PKR amount, worked out live from the rate the
 * admin sets in Settings ("1 <CUR> = X PKR"). Nothing here is ever sent to the
 * server as a price; only the displayed label changes.
 *
 * Deliberately free of any server-only import (no Supabase, no `next/*`) so the
 * `CurrencyProvider`, the `<Price>` component and the admin form can share the
 * exact same maths. The rates themselves are read on the server in
 * `src/lib/currency-rate.ts` and handed to the provider as a prop.
 */

import { formatAmount } from "@/lib/order-types";

/** PKR is the base; every other code is a display-only conversion. */
export type Currency = "PKR" | "USD" | "EUR" | "GBP" | "AED" | "CAD";

/** The full set, in switcher order. PKR leads. */
export const CURRENCIES: readonly Currency[] = [
  "PKR",
  "USD",
  "EUR",
  "GBP",
  "AED",
  "CAD",
];

/** Everything that needs a rate — i.e. every currency except the PKR base. */
export type ForeignCurrency = Exclude<Currency, "PKR">;

export const FOREIGN_CURRENCIES: readonly ForeignCurrency[] = [
  "USD",
  "EUR",
  "GBP",
  "AED",
  "CAD",
];

/**
 * The admin-set rates, keyed by currency code: "1 <CUR> = X PKR". A currency
 * with no positive rate is simply absent, which is what hides it on the
 * storefront.
 */
export type CurrencyRates = Partial<Record<ForeignCurrency, number>>;

/** What the storefront shows on the server and on the very first client render. */
export const DEFAULT_CURRENCY: Currency = "PKR";

/** Where the shopper's choice is remembered between visits. */
export const CURRENCY_STORAGE_KEY = "zuhas:currency";

const CURRENCY_SET = new Set<string>(CURRENCIES);

export function isCurrency(value: unknown): value is Currency {
  return typeof value === "string" && CURRENCY_SET.has(value);
}

/**
 * PKR -> the given currency at the admin's rate, rounded to whole cents. A
 * non-positive or missing rate has no meaning, so the caller must fall back to
 * PKR instead (see {@link formatPrice}).
 */
export function convertFromPkr(pkr: number, rate: number): number {
  return Math.round((pkr / rate) * 100) / 100;
}

/** Grouped PKR with no currency symbol — the exact store format, unchanged. */
export function formatPkr(amount: number): string {
  return formatAmount(amount);
}

function makeFormatter(code: ForeignCurrency): Intl.NumberFormat {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: code,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * One formatter per currency, built once. The `en-US` locale gives the familiar
 * symbols and placement: `$12.50`, `€12.50`, `£12.50`, `AED 12.50`, `CA$12.50`.
 */
const FORMATTERS: Record<ForeignCurrency, Intl.NumberFormat> = {
  USD: makeFormatter("USD"),
  EUR: makeFormatter("EUR"),
  GBP: makeFormatter("GBP"),
  AED: makeFormatter("AED"),
  CAD: makeFormatter("CAD"),
};

/** A converted amount in its own currency, e.g. `€12.50`. PKR prints grouped. */
export function formatCurrency(amount: number, currency: Currency): string {
  if (currency === "PKR") return formatPkr(amount);
  return FORMATTERS[currency].format(amount);
}

/** True when a currency can be shown at all: PKR always, others need a rate. */
export function isCurrencyAvailable(
  currency: Currency,
  rates: CurrencyRates,
): boolean {
  if (currency === "PKR") return true;

  const rate = rates[currency];
  return typeof rate === "number" && Number.isFinite(rate) && rate > 0;
}

/** PKR plus every currency that has a positive rate, in switcher order. */
export function listAvailableCurrencies(rates: CurrencyRates): Currency[] {
  return CURRENCIES.filter((currency) => isCurrencyAvailable(currency, rates));
}

/**
 * The one place a price is turned into the string a shopper reads.
 *
 * `PKR` prints the original grouped amount. Any other currency converts at its
 * admin-set rate and prints in that currency's own format. A missing or
 * non-positive rate falls back to PKR — which must never happen, because a
 * currency is only offered while a rate exists.
 */
export function formatPrice(
  amount: number,
  currency: Currency,
  rates: CurrencyRates,
): string {
  if (currency === "PKR") return formatPkr(amount);

  const rate = rates[currency];
  if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
    return formatPkr(amount);
  }

  return formatCurrency(convertFromPkr(amount, rate), currency);
}

/** The shopper's saved choice, or PKR. Never throws: storage may be blocked. */
export function readStoredCurrency(): Currency {
  try {
    const stored = window.localStorage.getItem(CURRENCY_STORAGE_KEY);
    return isCurrency(stored) ? stored : DEFAULT_CURRENCY;
  } catch {
    return DEFAULT_CURRENCY;
  }
}

/** Remembers the shopper's choice. Never throws: storage may be blocked. */
export function storeCurrency(currency: Currency): void {
  try {
    window.localStorage.setItem(CURRENCY_STORAGE_KEY, currency);
  } catch {
    // A browser that refuses storage simply forgets the choice; display is
    // unaffected for this session.
  }
}
