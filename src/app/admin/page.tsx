import Link from "next/link";

import OrderStatusBadge from "@/components/orders/OrderStatusBadge";
import { requireAdmin } from "@/lib/admin/guard";
import { getAdminDashboard } from "@/lib/admin/queries";
import { formatAmount, formatOrderDate } from "@/lib/order-types";

/* Admin list thumbnails are plain <img>, not next/image: the optimizer would
   fetch and re-encode a row of small tiles on every dashboard load. eslint is
   disabled for the one instance below for that reason. */
/* eslint-disable @next/next/no-img-element */

/**
 * Dashboard home: where the admin lands.
 *
 * Three things and nothing else, as the spec asks — how many orders sit in each
 * status, the orders that arrived most recently, and the products that are at
 * or below their own low-stock threshold (the same `isLowStock()` rule the
 * Inventory screen uses, so the two never disagree).
 *
 * Everything is a link to the screen that acts on it: counts and recent orders
 * go to Orders, low stock goes to Inventory. This page reports; it never writes.
 */
export default async function AdminDashboardPage() {
  await requireAdmin();

  const { statusCounts, recentOrders, lowStock } = await getAdminDashboard();

  const totalOrders = statusCounts.reduce((sum, row) => sum + row.count, 0);

  return (
    <section className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl tracking-[0.08em] uppercase sm:text-3xl">
          Dashboard
        </h1>

        <p className="max-w-prose text-sm leading-relaxed text-black/60">
          {totalOrders === 0
            ? "No orders yet. The first one will appear here as soon as a customer checks out."
            : `${totalOrders} ${totalOrders === 1 ? "order" : "orders"} in total.`}
        </p>
      </header>

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xs tracking-[0.2em] text-black/50 uppercase">
            Orders by status
          </h2>

          <Link
            href="/admin/orders"
            className="text-xs tracking-[0.16em] text-black/60 uppercase transition-colors hover:text-plum"
          >
            View all orders &rarr;
          </Link>
        </div>

        <ul className="grid grid-cols-2 gap-3 lg:grid-cols-3 lg:gap-4">
          {statusCounts.map((row) => (
            <li key={row.status} className="min-w-0 border border-black/10 p-4">
              <p className="truncate text-[0.625rem] leading-relaxed tracking-[0.1em] text-black/50 uppercase sm:text-[0.6875rem] sm:tracking-[0.14em]">
                {row.status}
              </p>
              <p className="mt-2 text-2xl font-semibold">{row.count}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xs tracking-[0.2em] text-black/50 uppercase">
            Recent orders
          </h2>

          <Link
            href="/admin/orders"
            className="text-xs tracking-[0.16em] text-black/60 uppercase transition-colors hover:text-plum"
          >
            View all orders &rarr;
          </Link>
        </div>

        {recentOrders.length === 0 ? (
          <p className="border border-dashed border-black/15 px-4 py-10 text-center text-sm text-black/50">
            Nothing here yet.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-black/10 border border-black/10">
            {recentOrders.map((order) => (
              <li
                key={order.id}
                className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:gap-4 sm:p-4"
              >
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/admin/orders/${order.id}`}
                    className="text-sm font-medium underline-offset-4 hover:text-plum hover:underline"
                  >
                    {order.orderNumber}
                  </Link>

                  <p className="mt-0.5 truncate text-xs text-black/45">
                    {formatOrderDate(order.createdAt)} ·{" "}
                    {order.customerName || order.customerEmail}
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end">
                  <span className="text-sm font-medium">
                    {formatAmount(order.total)}
                  </span>
                  <OrderStatusBadge status={order.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xs tracking-[0.2em] text-black/50 uppercase">
            Low stock
          </h2>

          <Link
            href="/admin/inventory"
            className="text-xs tracking-[0.16em] text-black/60 uppercase transition-colors hover:text-plum"
          >
            Open inventory &rarr;
          </Link>
        </div>

        {lowStock.length === 0 ? (
          <p className="border border-dashed border-black/15 px-4 py-10 text-center text-sm text-black/50">
            Every product is above its low-stock threshold.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-black/10 border border-black/10">
            {lowStock.map((product) => (
              <li key={product.id}>
                <Link
                  href="/admin/inventory"
                  className="flex items-center gap-3 p-3 transition-colors hover:bg-black/[0.02] sm:gap-4 sm:p-4"
                >
                  <div className="relative aspect-[2/3] w-10 shrink-0 overflow-hidden border border-black/10 bg-black/5 sm:w-12">
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        width={48}
                        height={72}
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>

                  <p className="min-w-0 flex-1 truncate text-sm">
                    {product.name}
                  </p>

                  <p className="shrink-0 text-sm text-plum">
                    {product.stockQuantity} left
                    <span className="text-black/45">
                      {" "}
                      · below {product.lowStockThreshold}
                    </span>
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
