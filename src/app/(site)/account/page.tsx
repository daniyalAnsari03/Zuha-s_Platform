import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import SignOutButton from "@/components/auth/SignOutButton";
import Breadcrumb from "@/components/layout/Breadcrumb";
import OrderStatusBadge from "@/components/orders/OrderStatusBadge";
import { getCustomerOrders } from "@/lib/order-data";
import { formatAmount, formatOrderDate } from "@/lib/order-types";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "My Account — ZUHA'S",
  robots: { index: false, follow: false },
};

/**
 * The account area: who is signed in, a way out, and the order history.
 *
 * Requires a session — a guest is sent to the login page instead of being shown
 * an empty shell. Which orders appear is decided on the server by RLS
 * (`user_id = auth.uid() or is_admin()` in migration 001) plus an explicit
 * `user_id` filter, so one shopper can never read another's orders even by
 * guessing an order number.
 */
export default async function AccountPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const orders = await getCustomerOrders();

  return (
    <section className="mx-auto w-full max-w-[1600px] px-4 sm:px-6 lg:px-12 xl:px-24">
      <h1 className="sr-only">My Account</h1>

      <Breadcrumb
        items={[{ label: "Home", href: "/" }, { label: "My Account" }]}
      />

      <div className="mt-6 flex flex-col gap-4 border-b border-black/10 pb-8 sm:flex-row sm:items-end sm:justify-between lg:mt-8">
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl tracking-[0.1em] uppercase sm:text-3xl">
            My Account
          </h2>
          <p className="text-sm break-all text-black/60">{user.email}</p>
        </div>

        <SignOutButton />
      </div>

      <div className="mt-10 lg:mt-12">
        <h3 className="text-sm tracking-[0.16em] uppercase">My Orders</h3>

        {orders.length === 0 ? (
          <div className="mt-6 flex flex-col items-start gap-4">
            <p className="text-sm text-black/60">
              You have not placed an order yet.
            </p>
            <Link
              href="/"
              className="inline-flex min-h-11 items-center justify-center bg-plum px-8 py-3 text-xs tracking-[0.16em] text-white uppercase transition-colors hover:bg-plum-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum"
            >
              Start shopping
            </Link>
          </div>
        ) : (
          <ul className="mt-6 divide-y divide-black/10 border-y border-black/10">
            {orders.map((order) => (
              <li key={order.orderNumber}>
                <Link
                  href={`/account/orders/${encodeURIComponent(order.orderNumber)}`}
                  className="flex min-h-16 flex-col gap-2 py-4 transition-colors hover:bg-black/[0.02] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-plum sm:flex-row sm:items-center sm:justify-between sm:gap-6"
                >
                  <span className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-6">
                    <span className="text-sm font-medium">
                      {order.orderNumber}
                    </span>
                    <span className="text-xs text-black/50">
                      {formatOrderDate(order.createdAt)}
                    </span>
                  </span>

                  <span className="flex items-center justify-between gap-4 sm:justify-end">
                    <OrderStatusBadge status={order.status} />
                    <span className="text-sm font-medium">
                      {formatAmount(order.total)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}