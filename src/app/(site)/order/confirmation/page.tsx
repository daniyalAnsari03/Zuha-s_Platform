import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import Breadcrumb from "@/components/layout/Breadcrumb";
import OrderSummaryCard from "@/components/orders/OrderSummaryCard";
import { getOrderConfirmation } from "@/lib/order-data";
import { formatOrderDate, PAYMENT_METHOD } from "@/lib/order-types";

export const metadata: Metadata = {
  title: "Order Confirmed — ZUHA'S",
  robots: { index: false, follow: false },
};

type OrderConfirmationPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * The thank-you page a shopper lands on after placing an order.
 *
 * Privacy is the reason this page looks the way it does. The order number is
 * short and sequential, so on its own it would be guessable; the link therefore
 * also carries a secret `token` minted when the order was placed, and both must
 * be present and match before anything renders. A missing or wrong token is
 * treated exactly like a number that does not exist. The page then shows the
 * order number, the date, the status, the lines and the total — and nothing
 * else. The name, phone, address and email are never selected, and a signed-in
 * shopper sees those on their own order in the account area, where RLS
 * guarantees it is theirs.
 */
export default async function OrderConfirmationPage({
  searchParams,
}: OrderConfirmationPageProps) {
  const params = await searchParams;
  const requestedOrder =
    typeof params.order === "string" ? params.order.trim() : undefined;
  const requestedToken =
    typeof params.token === "string" ? params.token.trim() : undefined;

  if (!requestedOrder || !requestedToken) notFound();

  const order = await getOrderConfirmation(requestedOrder, requestedToken);

  if (!order) notFound();

  const lines = order.items.map((item, index) => ({
    key: `${item.productSlug ?? item.productName}-${index}`,
    name: item.productName,
    image: item.imageUrl,
    variant: item.variant,
    color: item.color,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    lineTotal: item.lineTotal,
  }));

  return (
    <section className="mx-auto w-full max-w-[1600px] px-4 sm:px-6 lg:px-12 xl:px-24">
      <h1 className="sr-only">Order confirmed</h1>

      <Breadcrumb
        items={[{ label: "Home", href: "/" }, { label: "Order Confirmed" }]}
      />

      <div className="mx-auto mt-10 max-w-2xl lg:mt-16">
        <div className="text-center">
          <p className="text-xs tracking-[0.24em] text-plum uppercase">
            {PAYMENT_METHOD}
          </p>

          <h2 className="mt-4 text-3xl tracking-[0.1em] uppercase sm:text-4xl">
            Thank you
          </h2>

          <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-black/70 sm:text-base">
            Your order has been placed, and our team will call you before
            delivery.
          </p>
        </div>

        <dl className="mt-8 grid gap-4 border-y border-black/10 py-6 text-sm sm:grid-cols-3 sm:gap-6">
          <div>
            <dt className="text-xs tracking-[0.16em] text-black/50 uppercase">
              Order number
            </dt>
            <dd className="mt-1 font-medium">{order.orderNumber}</dd>
          </div>

          <div>
            <dt className="text-xs tracking-[0.16em] text-black/50 uppercase">
              Placed on
            </dt>
            <dd className="mt-1">{formatOrderDate(order.createdAt)}</dd>
          </div>

          <div>
            <dt className="text-xs tracking-[0.16em] text-black/50 uppercase">
              Status
            </dt>
            <dd className="mt-1">{order.status}</dd>
          </div>
        </dl>

        <div className="mt-8">
          <h3 className="text-sm tracking-[0.16em] uppercase">Your order</h3>

          {lines.length === 0 ? (
            <p className="mt-4 text-sm text-black/60">
              The items on this order are no longer listed.
            </p>
          ) : (
            <OrderSummaryCard
              className="mt-4"
              lines={lines}
              subtotal={order.subtotal}
              total={order.total}
            />
          )}
        </div>

        <p className="mt-6 text-xs leading-relaxed text-black/50">
          Keep your order number to check on this delivery. Delivery details are
          available after signing in — see{" "}
          <Link
            href="/account"
            className="text-plum underline transition-colors hover:text-plum-dark"
          >
            My Orders
          </Link>
          .
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center justify-center bg-plum px-8 py-3 text-xs tracking-[0.16em] text-white uppercase transition-colors hover:bg-plum-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum"
          >
            Continue shopping
          </Link>

          <Link
            href="/account"
            className="inline-flex min-h-11 items-center justify-center border border-plum px-8 py-3 text-xs tracking-[0.16em] text-plum uppercase transition-colors hover:bg-plum hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum"
          >
            View my orders
          </Link>
        </div>
      </div>
    </section>
  );
}