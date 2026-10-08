import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import Breadcrumb from "@/components/layout/Breadcrumb";
import OrderStatusBadge from "@/components/orders/OrderStatusBadge";
import OrderSummaryCard from "@/components/orders/OrderSummaryCard";
import { getCustomerOrderDetail } from "@/lib/order-data";
import { formatOrderDate, PAYMENT_METHOD } from "@/lib/order-types";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Order — ZUHA'S",
  robots: { index: false, follow: false },
};

type OrderPageProps = {
  params: Promise<{ orderNumber: string }>;
};

/**
 * One order from "My Orders", with its lines and the delivery details.
 *
 * This is where the address, phone and email are shown — the confirmation page
 * deliberately withholds them, because that page is reachable by order number
 * alone. Here the query runs as the signed-in shopper and RLS hides every order
 * that is not theirs, so another shopper's number resolves to the same "not
 * found" page as a number that never existed.
 */
export default async function AccountOrderPage({ params }: OrderPageProps) {
  const { orderNumber } = await params;
  const decoded = decodeURIComponent(orderNumber).trim();

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  if (!decoded) notFound();

  const order = await getCustomerOrderDetail(decoded);

  if (!order || !order.isOwner) notFound();

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

  const delivery = [
    order.customerName,
    order.shippingAddress,
    order.shippingCity,
    order.customerPhone,
    order.customerEmail,
  ].filter((value): value is string => Boolean(value && value.trim()));

  return (
    <section className="mx-auto w-full max-w-[1600px] px-4 sm:px-6 lg:px-12 xl:px-24">
      <h1 className="sr-only">Order {order.orderNumber}</h1>

      <Breadcrumb
        items={[
          { label: "Home", href: "/" },
          { label: "My Account", href: "/account" },
          { label: order.orderNumber },
        ]}
      />

      <div className="mt-6 lg:mt-8">
        <Link
          href="/account"
          className="inline-flex items-center text-xs tracking-[0.16em] text-black/50 uppercase transition-colors hover:text-plum focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum"
        >
          Back to my orders
        </Link>
      </div>

      <dl className="mt-4 grid gap-4 border-y border-black/10 py-6 text-sm sm:grid-cols-3 sm:gap-6">
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
          <dd className="mt-1">
            <OrderStatusBadge status={order.status} />
          </dd>
        </div>
      </dl>

      <div className="grid gap-12 py-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-16">
        <div>
          <h2 className="text-sm tracking-[0.16em] uppercase">Items</h2>

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

        <aside className="flex flex-col gap-8">
          <div>
            <h2 className="text-sm tracking-[0.16em] uppercase">
              Delivery details
            </h2>

            <address className="mt-4 text-sm leading-relaxed text-black/70 not-italic">
              {delivery.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </address>
          </div>

          <div>
            <h2 className="text-sm tracking-[0.16em] uppercase">Payment</h2>
            <p className="mt-4 text-sm leading-relaxed text-black/70">
              {PAYMENT_METHOD}. Please keep the exact amount ready for the courier.
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}