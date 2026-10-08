import { requireAdmin } from "@/lib/admin/guard";
import { listAdminOrders } from "@/lib/admin/queries";
import OrdersManager from "@/components/admin/OrdersManager";

/**
 * Orders: the list view.
 *
 * The page fetches and the manager filters — every row comes from one
 * service-role read behind `requireAdmin()`, and the status filter and search
 * run in the browser over that list. Status *changes* happen on the detail
 * page, never here.
 */
export default async function AdminOrdersPage() {
  await requireAdmin();

  const { orders, total, totalPages } = await listAdminOrders();

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl tracking-[0.08em] uppercase sm:text-3xl">
          Orders
        </h1>

        <p className="max-w-prose text-sm leading-relaxed text-black/60">
          Every order, newest first. Open one to see its items, the delivery
          details and to move its status.
        </p>
      </header>

      <OrdersManager orders={orders} total={total} totalPages={totalPages} />
    </section>
  );
}