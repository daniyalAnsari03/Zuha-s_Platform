"use client";

import { motion } from "framer-motion";

import { useCurrency } from "@/components/currency/CurrencyProvider";
import { formatPrice } from "@/lib/currency";
import { TRANSITION_POPOVER } from "@/lib/motion";

/**
 * One amount, rendered in the shopper's selected currency.
 *
 * The server and the first client render both show PKR (the provider's default),
 * so there is no hydration mismatch; the switch to a saved currency happens after
 * mount and fades in with a quick shared-motion transition. `hydrated` gates the
 * fade so the very first paint — and every price on it — appears instantly
 * instead of flashing from transparent.
 */
export default function Price({
  amount,
  className,
}: {
  amount: number;
  className?: string;
}) {
  const { currency, rate, hydrated } = useCurrency();

  return (
    <motion.span
      key={currency}
      initial={hydrated ? { opacity: 0 } : false}
      animate={{ opacity: 1 }}
      transition={TRANSITION_POPOVER}
      className={className}
    >
      {formatPrice(amount, currency, rate)}
    </motion.span>
  );
}

/**
 * `formatPrice` bound to the current currency, for the few places that need the
 * string rather than an element (e.g. an aria-label or a plain text node).
 */
export function useFormatPrice(): (amount: number) => string {
  const { currency, rate } = useCurrency();
  return (amount: number) => formatPrice(amount, currency, rate);
}
