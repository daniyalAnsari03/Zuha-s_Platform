/**
 * The storefront currency layer.
 *
 * Every amount the app stores and reasons about is in **PKR** — products,
 * cart lines, orders and analytics never change. USD is a display-only
 * conversion of the PKR amount, worked out live from the rate the admin sets
 * in Settings ("1 USD = X PKR"). Nothing here is ever sent to the server as a
 * price; only the displayed label changes.
 *
 * Deliberately free of any server-only import (no Supabase, no `next/*`) so the
 * `CurrencyProvider`, the `<Price>` component and the admin form can share the
 * exact same maths. The rate itself is read on the server in
 * `src/lib/currency-rate.ts` and handed to the provider as a prop.
 */

import { formatAmount } from "@/lib/order-types";

/** The two currencies the storefront can display. Base storage is always PKR. */
export type Currency = "PKR" | "USD";

/** What the storefront shows on the server and on the very first client render. */
export const DEFAULT_CURRENCY: Currency = "PKR";

/** Where the shopper's choice is remembered between visits. */
export const CURRENCY_STORAGE_KEY = "zuhas:currency";

export function isCurrency(value: unknown): value is Currency {
  return value === "PKR" || value === "USD";
}

/**
 * PKR -> USD at the admin's rate, rounded to whole cents. A non-positive or
 * missing rate has no meaning, so the caller must fall back to PKR instead.
 */
export function convertToUsd(pkr: number, rate: number): number {
  return Math.round((pkr / rate) * 100) / 100;
}

/** Grouped PKR with no currency symbol — the exact store format, unchanged. */
export function formatPkr(amount: number): string {
  return formatAmount(amount);
}

const USD_FORMATTER = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** USD the way the switcher shows it, e.g. `$12.50`. */
export function formatUsd(amount: number): string {
  return USD_FORMATTER.format(amount);
}

/**
 * The one place a price is turned into the string a shopper reads.
 *
 * `PKR` (or a missing rate, which must never happen because USD is only offered
 * when a rate exists) prints the original grouped PKR amount; `USD` converts and
 * prints `$`-formatted dollars.
 */
export function formatPrice(
  amount: number,
  currency: Currency,
  rate: number | null,
): string {
  if (currency === "USD" && rate !== null && rate > 0) {
    return formatUsd(convertToUsd(amount, rate));
  }

  return formatPkr(amount);
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
