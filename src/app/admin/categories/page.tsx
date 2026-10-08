import { requireAdmin } from "@/lib/admin/guard";
import { listAdminCategories } from "@/lib/admin/queries";
import CategoriesManager from "@/components/admin/CategoriesManager";

/**
 * Categories, with the sub-categories inside each one.
 *
 * The page fetches on the server — through `requireAdmin()` first, then the
 * service-role reader — and hands the result to a client manager. Every add, edit
 * and delete is a server action that immediately re-renders this page from its
 * response, so the list always arrives with the new rows.
 */
export default async function AdminCategoriesPage() {
  await requireAdmin();

  const categories = await listAdminCategories();

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl tracking-[0.08em] uppercase sm:text-3xl">
          Categories
        </h1>

        <p className="max-w-prose text-sm leading-relaxed text-black/60">
          The top-level categories that become the homepage slides, and the
          sub-categories nested inside them.
        </p>
      </header>

      <CategoriesManager categories={categories} />
    </section>
  );
}