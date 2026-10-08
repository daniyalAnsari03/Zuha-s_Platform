"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import {
  ADMIN_INPUT_CLASS,
  AdminField,
} from "@/components/admin/admin-fields";
import OrderStatusBadge from "@/components/orders/OrderStatusBadge";
import {
  listAdminOrders,
  type AdminOrderListItem,
  type AdminOrdersListParams,
} from "@/lib/admin/queries";
import {
  formatAmount,
  formatOrderDate,
  ORDER_STATUSES,
  type OrderStatus,
} from "@/lib/order-types";
import { cn } from "@/lib/utils";

/**
 * The Orders screen: every order, newest first.
 *
 * The list arrives from the server already sorted; the status filter and the
 * order-number search both run in the browser so typing stays instant, exactly
 * like the Products and Inventory screens. What they match cannot change what an
 * order *is* — the detail screen is the only place a status can be moved, and
 * only through the server action in `lib/admin/orders.ts`.
 *
 * Each row links to its own detail page: the list shows what the spec asks for
 * (number, date, customer, total, status) and nothing that needs a second read.
 */
export default function OrdersManager({ orders, total, totalPages }: {
  orders: AdminOrderListItem[];
  total: number;
  totalPages: number;
}) {
  const [status, setStatus] = useState<OrderStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const matches = useMemo(() => {
    const needle = search.trim().toLowerCase();

    return orders.filter((order) => {
      if (status !== "all" && order.status !== status) return false;
      if (!needle) return true;

      return order.orderNumber.toLowerCase().includes(needle);
    });
  }, [orders, status, search]);

  const filtered = status !== "all" || search.trim() !== "";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <AdminField
          label="Search"
          htmlFor="order-search"
          className="w-full max-w-xs"
          hint={
            filtered
              ? `${matches.length} of ${orders.length}`
              : `${orders.length} ${orders.length === 1 ? "order" : "orders"}`
          }
        >
          <input
            id="order-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Order number"
            className={ADMIN_INPUT_CLASS}
          />
        </AdminField>

        <AdminField
          label="Status"
          htmlFor="order-status-filter"
          className="w-full max-w-[14rem]"
        >
          <select
            id="order-status-filter"
            value={status}
            onChange={(event) => setStatus(event.target.value as OrderStatus | "all")}
            className={cn(ADMIN_INPUT_CLASS, "cursor-pointer")}
          >
            <option value="all">All statuses</option>
            {ORDER_STATUSES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </AdminField>
      </div>

      {orders.length === 0 ? (
        <p className="border border-dashed border-black/15 px-4 py-10 text-center text-sm text-black/50">
          No orders yet. They appear here as soon as a customer checks out.
        </p>
      ) : matches.length === 0 ? (
        <p className="border border-dashed border-black/15 px-4 py-10 text-center text-sm text-black/50">
          Nothing matches those filters.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-black/10 border border-black/10">
          {matches.map((order) => (
            <li
              key={order.id}
              className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:gap-4 sm:p-4"
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

                <Link
                  href={`/admin/orders/${order.id}`}
                  className="inline-flex min-h-11 items-center justify-center px-3 text-xs tracking-[0.16em] text-black/60 uppercase transition-colors hover:text-plum"
                >
                  View
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-black/60">
            Page {page} of {totalPages} {total > 0 ? `(${total} total)` : ""}
          </p>

          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 border border-black/20 text-sm hover:bg-black/5"
            >
              Prev
            </button>

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1 border border-black/20 text-sm hover:bg-black/5"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}