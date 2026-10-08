import { requireAdmin } from "@/lib/admin/guard";
import { listAdminInventory } from "@/lib/admin/queries";
import InventoryManager from "@/components/admin/InventoryManager";

/**
 * Inventory.
 *
 * One row per product, both numbers edited in place. The low-stock flag comes from
 * `isLowStock()` — the same helper the Dashboard home uses for its low-stock
 * section, so the two screens cannot disagree about what "low" means.
 */
export default async function AdminInventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requireAdmin();

  const params = await searchParams;
  const page = parseInt(params.page ?? "1", 10);

  const { rows, total, totalPages, currentPage } = await listAdminInventory({ page });

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl tracking-[0.08em] uppercase sm:text-3xl">
          Inventory
        </h1>

        <p className="max-w-prose text-sm leading-relaxed text-black/60">
          How many of each product are in stock, and the number at which it is
          flagged as low stock.
        </p>
      </header>

      <InventoryManager rows={rows} total={total} totalPages={totalPages} currentPage={currentPage} />
    </section>
  );
}