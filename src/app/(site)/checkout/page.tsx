import type { Metadata } from "next";

import Breadcrumb from "@/components/layout/Breadcrumb";
import CheckoutForm, {
  EmptyCheckout,
  type BuyNowLine,
} from "@/components/checkout/CheckoutForm";
import {
  MAX_LINE_QUANTITY,
  PAYMENT_METHOD,
} from "@/lib/order-types";
import { effectivePrice } from "@/lib/products";
import { getProductBySlug } from "@/lib/product-data";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Checkout — ZUHA'S",
  description: "Complete your ZUHA'S order. Cash on Delivery.",
};

type CheckoutPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** Only ever a single value: a repeated param is treated as absent. */
function singleParam(
  value: string | string[] | undefined,
): string | undefined {
  return typeof value === "string" ? value : undefined;
}

/**
 * Checkout: the whole cart, or one product bought with "Buy It Now".
 *
 * Both entries end up on the same page. The cart version is entirely a client
 * concern (the cart lives in localStorage), while "Buy It Now" arrives as
 * `?product=<slug>&qty=<n>&size=<s>&color=<c>` and is resolved here, on the
 * server — so buying one product never reads or clears the cart, and the summary
 * is built from the live catalog rather than from anything the browser claims.
 *
 * Login is optional: when there is a session the name and email are pre-filled,
 * and a guest can order with nothing but the form. Only the server action
 * (`placeOrder`) writes the order.
 */
export default async function CheckoutPage({ searchParams }: CheckoutPageProps) {
  const params = await searchParams;
  const slug = singleParam(params.product)?.trim();

  const supabase = await createClient();
  const [authResult, buyNow] = await Promise.all([
    supabase.auth.getUser(),
    slug ? resolveBuyNowLine(slug, params) : null,
  ]);
  const {
    data: { user },
  } = authResult;

  const prefill = {
    defaultName: typeof user?.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : "",
    defaultEmail: user?.email ?? "",
  };

  return (
    <section className="mx-auto w-full max-w-[1600px] px-4 sm:px-6 lg:px-12 xl:px-24">
      <h1 className="sr-only">Checkout</h1>

      <Breadcrumb
        items={[{ label: "Home", href: "/" }, { label: "Checkout" }]}
      />

      <div className="mt-6 flex items-baseline justify-between gap-4 lg:mt-8">
        <p className="text-xl tracking-[0.1em] uppercase sm:text-2xl">
          Checkout
        </p>
        <p className="text-xs tracking-[0.16em] text-black/50 uppercase">
          {PAYMENT_METHOD}
        </p>
      </div>

      <div className="mt-8 lg:mt-12">
        {slug && !buyNow ? (
          <EmptyCheckout
            title="We couldn't find that item"
            message="The product, size or quantity in the link is no longer available."
          />
        ) : (
          <CheckoutForm
            mode={buyNow ? "buynow" : "cart"}
            buyNow={buyNow}
            {...prefill}
          />
        )}
      </div>
    </section>
  );
}

/**
 * Turns the "Buy It Now" query string into a single line, or null when any part of
 * it is unusable.
 *
 * The quantity, the size and the colour are checked here as well as on the
 * server action: a hand-edited or truncated link should land on the empty state,
 * not on an order the server is going to reject.
 */
async function resolveBuyNowLine(
  slug: string,
  params: Record<string, string | string[] | undefined>,
): Promise<BuyNowLine | null> {
  const product = await getProductBySlug(slug);
  if (!product) return null;

  const rawQty = singleParam(params.qty);
  const quantity = rawQty === undefined ? 1 : Number(rawQty);

  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_LINE_QUANTITY) {
    return null;
  }

  // A product the admin gave sizes to cannot be bought without choosing one.
  const size = singleParam(params.size)?.trim();
  if (product.sizes.length > 0) {
    const chosen =
      size !== undefined &&
      product.sizes.some(
        (option) => option.toLowerCase() === size.toLowerCase(),
      );

    if (!chosen) return null;
  }

  // Same rule for colours: a product with colour options must arrive with one.
  const color = singleParam(params.color)?.trim();
  if (product.colors.length > 0) {
    const chosen =
      color !== undefined &&
      product.colors.some(
        (option) => option.toLowerCase() === color.toLowerCase(),
      );

    if (!chosen) return null;
  }

  return {
    productId: product.id,
    name: product.name,
    image: product.images[0] ?? null,
    unitPrice: effectivePrice(product),
    size: size || null,
    color: color || null,
    quantity,
  };
}