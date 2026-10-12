"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import { useCart } from "@/components/cart/CartProvider";
import { useCurrency } from "@/components/currency/CurrencyProvider";
import OrderSummaryCard, {
  type OrderLineView,
} from "@/components/orders/OrderSummaryCard";
import { cartItemKey } from "@/lib/cart";
import { formatPkr } from "@/lib/currency";
import {
  CHECKOUT_FIELDS,
  CHECKOUT_FIELD_LABELS,
  firstInvalidField,
  PAYMENT_METHOD,
  validateCheckoutField,
  type CheckoutField,
  type CheckoutValues,
  type PlaceOrderPayload,
} from "@/lib/order-types";
import { placeOrder } from "@/lib/orders";
import type { StorePolicySlug } from "@/lib/policy-types";
import { cn } from "@/lib/utils";

/**
 * The single product a "Buy It Now" click brought here, resolved on the server
 * from the slug in the URL so the cart is never touched.
 */
export type BuyNowLine = {
  productId: string;
  name: string;
  image: string | null;
  unitPrice: number;
  size: string | null;
  color: string | null;
  quantity: number;
};

type CheckoutFormProps = {
  /** `cart` checks out the whole cart; `buynow` checks out one product. */
  mode: "cart" | "buynow";
  /** Present only in `buynow` mode; the server passes null otherwise. */
  buyNow: BuyNowLine | null;
  /** Prefilled from the signed-in shopper, empty for a guest. */
  defaultName: string;
  defaultEmail: string;
};

const FIELD_CLASSES =
  "w-full min-h-11 border border-black/20 bg-white px-4 py-2.5 text-sm transition-colors placeholder:text-black/30 focus:border-plum focus:outline-none";

const FIELD_LABEL_CLASSES =
  "block text-xs tracking-[0.16em] uppercase text-black/60";

/**
 * Checkout: the delivery form and the order summary, Cash on Delivery only.
 *
 * Works with no account. When there is one, the name and email the shopper signed
 * up with are pre-filled but stay editable.
 *
 * The form only ever hands the server product ids, sizes, colours and
 * quantities — the `placeOrder` action re-reads every price and works out the
 * total itself, so the amounts shown here are for the customer's benefit only,
 * never the source of truth.
 *
 * The cart lives in localStorage, so this component renders empty on the server
 * and fills in after hydration: until `hydrated` is true it shows a placeholder,
 * then either the form or the empty state.
 */
export default function CheckoutForm({
  mode,
  buyNow,
  defaultName,
  defaultEmail,
}: CheckoutFormProps) {
  const router = useRouter();
  const { items, hydrated, clearCart } = useCart();
  const { currency } = useCurrency();
  const formRef = useRef<HTMLFormElement>(null);

  const [values, setValues] = useState<CheckoutValues>({
    name: defaultName,
    email: defaultEmail,
    phone: "",
    address: "",
    city: "",
  });
  const [errors, setErrors] = useState<Partial<Record<CheckoutField, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const isBuyNow = mode === "buynow";

  /*
   * Two views of the same thing, built side by side: `lines` is what the customer
   * reads, `orderItems` is what the server is asked to price. They are kept apart
   * on purpose — nothing derived from `lines` is ever sent.
   */
  const { lines, orderItems } = isBuyNow
    ? buyNow
      ? {
          lines: [
            {
              key: cartItemKey(buyNow.productId, buyNow.size, buyNow.color),
              name: buyNow.name,
              image: buyNow.image,
              variant: buyNow.size,
              color: buyNow.color,
              quantity: buyNow.quantity,
              unitPrice: buyNow.unitPrice,
              lineTotal: buyNow.unitPrice * buyNow.quantity,
            },
          ] satisfies OrderLineView[],
          orderItems: [
            {
              productId: buyNow.productId,
              size: buyNow.size,
              color: buyNow.color,
              quantity: buyNow.quantity,
            },
          ],
        }
      : { lines: [], orderItems: [] }
    : {
        lines: items.map((item) => ({
          key: cartItemKey(item.productId, item.size, item.color),
          name: item.name,
          image: item.image,
          variant: item.size,
          color: item.color,
          quantity: item.quantity,
          unitPrice: item.price,
          lineTotal: item.price * item.quantity,
        })),
        orderItems: items.map((item) => ({
          productId: item.productId,
          size: item.size,
          color: item.color,
          quantity: item.quantity,
        })),
      };

  const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);

  const update = (field: CheckoutField, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));

    // Once a field has been called out, re-check it as they fix it instead of
    // waiting for the next submit.
    setErrors((current) => {
      if (!current[field]) return current;

      const problem = validateCheckoutField(field, value);
      const next = { ...current };
      if (problem) next[field] = problem;
      else delete next[field];
      return next;
    });
  };

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;

    const nextErrors: Partial<Record<CheckoutField, string>> = {};
    for (const field of CHECKOUT_FIELDS) {
      const problem = validateCheckoutField(field, values[field]);
      if (problem) nextErrors[field] = problem;
    }

    setErrors(nextErrors);

    const firstBad = firstInvalidField(nextErrors);
    if (firstBad) {
      setFormError("Please correct the highlighted fields.");
      formRef.current
        ?.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name="${firstBad}"]`)
        ?.focus();
      return;
    }

    if (lines.length === 0) {
      setFormError("There is nothing to order.");
      return;
    }

    setFormError(null);

    const payload: PlaceOrderPayload = { ...values, items: orderItems };

    startTransition(async () => {
      const result = await placeOrder(payload);

      if (!result.ok) {
        setFormError(result.message);
        return;
      }

      // Only a cart checkout empties the cart: a "Buy It Now" order leaves the
      // basket exactly as the customer left it.
      if (!isBuyNow) clearCart();

      router.replace(
        `/order/confirmation?order=${encodeURIComponent(result.orderNumber)}&token=${encodeURIComponent(result.token)}`,
      );
    });
  };

  // The saved cart has not been read yet: showing the form now would flash an
  // empty summary at a shopper who has items.
  if (!isBuyNow && !hydrated) {
    return (
      <p className="py-16 text-center text-sm text-black/50" aria-live="polite">
        Loading your cart...
      </p>
    );
  }

  if (lines.length === 0) {
    return (
      <EmptyCheckout
        title="Your cart is empty"
        message="Add something you love and it will show up here."
      />
    );
  }

  return (
    <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
      <form
        ref={formRef}
        onSubmit={submit}
        noValidate
        className="flex flex-col gap-8 lg:order-2"
      >
        <div className="flex flex-col gap-4">
          <h2 className="text-lg tracking-[0.08em] uppercase">Delivery details</h2>

          <TextField
            field="name"
            label={CHECKOUT_FIELD_LABELS.name}
            autoComplete="name"
            value={values.name}
            error={errors.name}
            onChange={(value) => update("name", value)}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              field="email"
              label={CHECKOUT_FIELD_LABELS.email}
              type="email"
              inputMode="email"
              autoComplete="email"
              value={values.email}
              error={errors.email}
              onChange={(value) => update("email", value)}
            />

            <TextField
              field="phone"
              label={CHECKOUT_FIELD_LABELS.phone}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="+92 300 0000000"
              value={values.phone}
              error={errors.phone}
              onChange={(value) => update("phone", value)}
            />
          </div>

          <TextField
            field="address"
            label={CHECKOUT_FIELD_LABELS.address}
            autoComplete="street-address"
            value={values.address}
            error={errors.address}
            onChange={(value) => update("address", value)}
          />

          <TextField
            field="city"
            label={CHECKOUT_FIELD_LABELS.city}
            autoComplete="address-level2"
            value={values.city}
            error={errors.city}
            onChange={(value) => update("city", value)}
          />
        </div>

        <p className="border border-black/10 bg-black/[0.02] px-4 py-3 text-xs leading-relaxed text-black/70">
          <span className="font-medium tracking-[0.16em] uppercase">
            {PAYMENT_METHOD}.
          </span>{" "}
          This store does not take online payments. Pay the courier in cash when
          your order arrives.
        </p>

        {formError ? (
          <p role="alert" className="text-sm text-plum">
            {formError}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="min-h-12 w-full bg-plum px-6 py-3 text-sm font-medium tracking-[0.08em] text-white uppercase transition-colors hover:bg-plum-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum disabled:opacity-60 sm:w-auto sm:self-start sm:px-12"
        >
          {pending ? "Placing order..." : "Place Order"}
        </button>

        {/*
          Plain acknowledgment, not a checkbox and not a gate: the links open in
          a new tab so an unfinished checkout is never lost.
        */}
        <p className="text-xs leading-relaxed text-black/50">
          By placing your order you agree to our{" "}
          <PolicyLink slug="terms-of-service" label="Terms of Service" />,{" "}
          <PolicyLink slug="refund-policy" label="Refund Policy" />,{" "}
          <PolicyLink slug="shipping-policy" label="Shipping Policy" /> and{" "}
          <PolicyLink slug="privacy-policy" label="Privacy Policy" />.
        </p>
      </form>

      <aside className="lg:order-1">
        <h2 className="mb-4 text-lg tracking-[0.08em] uppercase lg:mb-6">
          Order summary
        </h2>

        <OrderSummaryCard
          lines={lines}
          subtotal={subtotal}
          total={subtotal}
          displayCurrency
        />

        {/*
          The order is always placed and saved in PKR; only the display changes.
          The real PKR total is repeated here so a shopper paying in any other
          currency is never confused about what the courier will collect.
        */}
        {currency !== "PKR" ? (
          <p className="mt-3 text-xs leading-relaxed text-black/50">
            Order will be placed and charged in PKR (Rs {formatPkr(subtotal)})
          </p>
        ) : null}
      </aside>
    </div>
  );
}

/**
 * One policy name in the checkout acknowledgment line, opened in a new tab so
 * the shopper keeps their checkout data.
 */
function PolicyLink({ slug, label }: { slug: StorePolicySlug; label: string }) {
  return (
    <Link
      href={`/policies/${slug}`}
      target="_blank"
      rel="noopener noreferrer"
      className="underline underline-offset-2 transition-colors hover:text-plum"
    >
      {label}
    </Link>
  );
}

type TextFieldProps = {
  field: CheckoutField;
  label: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  type?: string;
  inputMode?: "text" | "email" | "tel";
  autoComplete?: string;
  placeholder?: string;
};

/**
 * One labelled input with its inline error.
 *
 * The error is wired up with `aria-invalid` and `aria-describedby` rather than
 * `required`, so the browser's own bubble never competes with the message the
 * shopper needs to read.
 */
function TextField({
  field,
  label,
  value,
  error,
  onChange,
  type = "text",
  inputMode,
  autoComplete,
  placeholder,
}: TextFieldProps) {
  const errorId = `${field}-error`;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={field} className={FIELD_LABEL_CLASSES}>
        {label}
      </label>

      <input
        id={field}
        name={field}
        type={type}
        inputMode={inputMode}
        autoComplete={autoComplete}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={cn(FIELD_CLASSES, error && "border-plum")}
      />

      {error ? (
        <p id={errorId} className="text-xs text-plum">
          {error}
        </p>
      ) : null}
    </div>
  );
}

type EmptyCheckoutProps = {
  title: string;
  message: string;
};

/**
 * Nothing to check out: an empty cart, or a "Buy It Now" link whose product or
 * size no longer resolves. Always offers a way back into the store.
 */
export function EmptyCheckout({ title, message }: EmptyCheckoutProps) {
  return (
    <div className="flex flex-col items-center gap-5 py-16 text-center sm:py-24">
      <h2 className="text-2xl tracking-[0.1em] uppercase sm:text-3xl">{title}</h2>
      <p className="max-w-sm text-sm text-black/60">{message}</p>

      <Link
        href="/"
        className="inline-flex min-h-11 items-center justify-center bg-plum px-8 py-3 text-xs tracking-[0.16em] text-white uppercase transition-colors hover:bg-plum-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum"
      >
        Continue shopping
      </Link>
    </div>
  );
}