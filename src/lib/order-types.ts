/**
 * Order domain helpers shared by the browser and the server.
 *
 * Deliberately free of any server-only import (no Supabase, no `next/headers`)
 * so the checkout form, the confirmation page, the account area and the
 * `placeOrder` server action can all rely on exactly one set of statuses,
 * validation rules and formatting.
 */

import type { OrderStatus } from "@/types/database";

export type { OrderStatus };

/** Every status an order can hold, in the order the store moves it through. */
export const ORDER_STATUSES: readonly OrderStatus[] = [
  "Order Placed",
  "Order Confirmed",
  "Processing",
  "Shipped",
  "Delivered",
  "Cancelled",
];

/** Statuses that will not move again. */
export const CLOSED_ORDER_STATUSES: readonly OrderStatus[] = [
  "Delivered",
  "Cancelled",
];

export function isOrderStatus(value: unknown): value is OrderStatus {
  return (
    typeof value === "string" &&
    (ORDER_STATUSES as readonly string[]).includes(value)
  );
}

/** Cash on Delivery is the only payment method, so it is a constant, not a field. */
export const PAYMENT_METHOD = "Cash on Delivery";

/**
 * A single line as the browser sends it.
 *
 * There is deliberately no price: the server re-reads every product and
 * calculates the amounts itself, so a tampered request cannot change a total.
 */
export type PlaceOrderItemInput = {
  productId: string;
  /** Free text, matched against the product's own `sizes` on the server. */
  size: string | null;
  /** Free text, matched against the product's own `colors` on the server. */
  color: string | null;
  quantity: number;
};

export type PlaceOrderPayload = {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  items: PlaceOrderItemInput[];
};

/**
 * Never throws: Next.js replaces the message of a thrown server-action error
 * with a generic digest in production builds, so the checkout form would show
 * "Something went wrong" instead of what actually went wrong. Returning a
 * discriminated union keeps every message the customer needs.
 */
export type PlaceOrderResult =
  | { ok: true; orderNumber: string; token: string }
  | { ok: false; message: string };

/** Guards one order against being a wholesale request by accident. */
export const MAX_LINE_QUANTITY = 50;
export const MAX_ORDER_LINES = 25;

// -----------------------------------------------------------------------------
// Checkout form
// -----------------------------------------------------------------------------

export const CHECKOUT_FIELDS = [
  "name",
  "email",
  "phone",
  "address",
  "city",
] as const;

export type CheckoutField = (typeof CHECKOUT_FIELDS)[number];

export type CheckoutValues = Record<CheckoutField, string>;

/** Labels shown above the inputs, reused by the fields and the error summary. */
export const CHECKOUT_FIELD_LABELS: Record<CheckoutField, string> = {
  name: "Name",
  email: "Email",
  phone: "Phone number",
  address: "Address",
  city: "City",
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Validates one field and returns a message the customer can act on, or `null`
 * when the value is acceptable.
 *
 * Shared by the checkout form (inline, as they type) and the `placeOrder` server
 * action, so a hand-crafted request is held to exactly the same rules as the UI.
 */
export function validateCheckoutField(
  field: CheckoutField,
  value: string,
): string | null {
  const trimmed = value.trim();

  if (!trimmed) return `${CHECKOUT_FIELD_LABELS[field]} is required.`;

  switch (field) {
    case "name":
      return trimmed.length >= 2 ? null : "Please enter your full name.";

    case "email":
      return EMAIL_PATTERN.test(trimmed)
        ? null
        : "Please enter a valid email address.";

    case "phone": {
      // Tolerant of spaces, dashes, brackets and a leading +, but the digit count
      // is what actually matters for a delivery call.
      const digits = trimmed.replace(/\D/g, "");
      if (digits.length < 7) return "Please enter a valid phone number.";
      if (digits.length > 15) return "That phone number is too long.";
      return /^[+\d\s()-]+$/.test(trimmed)
        ? null
        : "Please enter a valid phone number.";
    }

    case "address":
      return trimmed.length >= 5
        ? null
        : "Please enter your full address.";

    case "city":
      return trimmed.length >= 2 ? null : "Please enter your city.";
  }
}

/** First invalid field, so the form can move focus to whatever needs fixing. */
export function firstInvalidField(
  errors: Partial<Record<CheckoutField, string>>,
): CheckoutField | null {
  return CHECKOUT_FIELDS.find((field) => errors[field]) ?? null;
}

// -----------------------------------------------------------------------------
// Formatting
// -----------------------------------------------------------------------------

/** Money the way the rest of the storefront prints it: grouped, no currency. */
export function formatAmount(amount: number): string {
  return amount.toLocaleString("en-PK");
}

export function formatOrderDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString("en-PK", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}