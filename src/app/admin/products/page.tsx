import { requireAdmin } from "@/lib/admin/guard";
import {
  listAdminProducts,
  listAdminTaxonomy,
} from "@/lib/admin/queries";
import ProductsManager from "@/components/admin/ProductsManager";

/**
 * Products.
 *
 * The page fetches on the server — through `requireAdmin()` first, then the
 * service-role readers — and hands the result to a client manager that filters by
 * name. The stock quantity is not here: it lives on `/admin/inventory`, which is
 * where the Dashboard's low-stock list will read it from too.
 */
export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requireAdmin();

  const params = await searchParams;
  const page = parseInt(params.page ?? "1", 10);

  const [productsResult, { categories, subCategories }] = await Promise.all([
    listAdminProducts({ page }),
    listAdminTaxonomy(),
  ]);

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl tracking-[0.08em] uppercase sm:text-3xl">
          Products
        </h1>

        <p className="max-w-prose text-sm leading-relaxed text-black/60">
          Everything the storefront sells, with its gallery, prices and the sizes
          and colours customers choose.
        </p>
      </header>

      <ProductsManager
        products={productsResult.products}
        categories={categories}
        subCategories={subCategories}
        total={productsResult.total}
        totalPages={productsResult.totalPages}
        currentPage={productsResult.currentPage}
      />
    </section>
  );
}