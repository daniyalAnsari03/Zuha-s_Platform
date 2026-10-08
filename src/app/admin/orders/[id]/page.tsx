import Link from "next/link";
import { notFound } from "next/navigation";

import OrderStatusControl from "@/components/admin/OrderStatusControl";
import OrderStatusBadge from "@/components/orders/OrderStatusBadge";
import { requireAdmin } from "@/lib/admin/guard";
import { getAdminOrder, type AdminOrderDetail } from "@/lib/admin/queries";
import {
  formatAmount,
  formatOrderDate,
  PAYMENT_METHOD,
} from "@/lib/order-types";

/* Admin list thumbnails are plain <img>, not next/image: the optimizer would
   fetch and re-encode a row of small tiles on every page load. eslint is
   disabled for the one instance below for that reason. */
/* eslint-disable @next/next/no-img-element */

type OrderDetailPageProps = {
  params: Promise<{ id: string }>;
};

/**
 * One order: its items, its totals, the customer's delivery details, and the
 * only control the dashboard has over it — the status dropdown.
 *
 * The delivery details are shown here and nowhere else in the dashboard: the
 * customer's own confirmation page never selects them (it is reachable by order
 * number alone), and "My Orders" reads them through RLS. This read runs behind
 * `requireAdmin()` on the service role, which is the one place allowed to.
 *
 * Cash on Delivery is noted explicitly because it is the store's only payment
 * method — an admin reading an order never has to wonder whether it was paid
 * online.
 */
export default async function AdminOrderDetailPage({
  params,
}: OrderDetailPageProps) {
  await requireAdmin();

  const { id } = await params;
  const order = await getAdminOrder(id);

  if (!order) notFound();

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-4">
        <Link
          href="/admin/orders"
          className="w-fit text-xs tracking-[0.16em] text-black/50 uppercase transition-colors hover:text-plum"
        >
          &larr; All orders
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl tracking-[0.08em] uppercase sm:text-3xl">
              {order.orderNumber}
            </h1>

            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm text-black/60">
                {formatOrderDate(order.createdAt)}
              </span>
              <OrderStatusBadge status={order.status} />
            </div>
          </div>

          <OrderStatusControl
            orderId={order.id}
            currentStatus={order.status}
          />
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex flex-col gap-4">
          <h2 className="text-xs tracking-[0.2em] text-black/50 uppercase">
            Items
          </h2>

          <ul className="flex flex-col divide-y divide-black/10 border border-black/10">
            {order.items.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-3 p-3 sm:gap-4 sm:p-4"
              >
                <div className="relative aspect-[2/3] w-12 shrink-0 overflow-hidden border border-black/10 bg-black/5 sm:w-14">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.productName}
                      width={56}
                      height={84}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {item.productName}
                  </p>

                  <p className="mt-0.5 text-xs text-black/45">
                    {[
                      item.size ? `Size ${item.size}` : null,
                      item.color ? `Color ${item.color}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "One size"}
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  <p className="text-sm font-medium">
                    {formatAmount(item.lineTotal)}
                  </p>
                  <p className="text-xs text-black/45">
                    {formatAmount(item.unitPrice)} × {item.quantity}
                  </p>
                </div>
              </li>
            ))}
          </ul>

          <DeliveryDetails order={order} />
        </div>

        <aside className="flex flex-col gap-4">
          <h2 className="text-xs tracking-[0.2em] text-black/50 uppercase">
            Totals
          </h2>

          <div className="border border-black/10 p-4">
            <dl className="flex flex-col gap-2.5 text-sm">
              <TotalRow label="Subtotal" value={formatAmount(order.subtotal)} />

              <TotalRow
                label="Shipping"
                value={
                  order.shippingFee > 0 ? formatAmount(order.shippingFee) : "Free"
                }
              />

              {order.discount > 0 ? (
                <TotalRow
                  label="Discount"
                  value={`- ${formatAmount(order.discount)}`}
                />
              ) : null}

              <div className="flex items-baseline justify-between gap-3 border-t border-black/10 pt-3">
                <dt className="text-xs font-semibold tracking-[0.16em] uppercase">
                  Total
                </dt>
                <dd className="text-base font-semibold">
                  {formatAmount(order.total)}
                </dd>
              </div>
            </dl>

            <p className="mt-4 border-l-2 border-plum bg-plum/5 py-2 pl-3 text-xs text-black/70">
              Payment: {order.paymentMethod ?? PAYMENT_METHOD} — not paid online.
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-black/60">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

/** Name, phone, address, city and email — the delivery details, and only here. */
function DeliveryDetails({ order }: { order: AdminOrderDetail }) {
  const rows: { label: string; value: string | null; href?: string }[] = [
    { label: "Name", value: order.customerName },
    { label: "Phone", value: order.customerPhone },
    {
      label: "Address",
      value: order.shippingAddress,
    },
    { label: "City", value: order.shippingCity },
    {
      label: "Email",
      value: order.customerEmail,
      href: `mailto:${order.customerEmail}`,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xs tracking-[0.2em] text-black/50 uppercase">
        Delivery details
      </h2>

      <dl className="divide-y divide-black/10 border border-black/10">
        {rows.map((row) => (
          <div
            key={row.label}
            className="grid gap-1 p-3 sm:grid-cols-[7rem_1fr] sm:gap-4 sm:p-4"
          >
            <dt className="text-xs font-semibold tracking-[0.16em] text-black/50 uppercase">
              {row.label}
            </dt>

            <dd className="min-w-0 break-words text-sm">
              {row.href && row.value ? (
                <a
                  href={row.href}
                  className="underline-offset-4 transition-colors hover:text-plum hover:underline"
                >
                  {row.value}
                </a>
              ) : (
                row.value || "—"
              )}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
