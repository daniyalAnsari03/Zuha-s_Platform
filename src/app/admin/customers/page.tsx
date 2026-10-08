import { requireAdmin } from "@/lib/admin/guard";
import { listAdminCustomers } from "@/lib/admin/queries";
import CustomersManager from "@/components/admin/CustomersManager";

/**
 * Customers: signed-up accounts only.
 *
 * The list comes from Supabase Auth (joined with the shopper's profile row for
 * a name and phone number), so a guest checkout — which never creates an
 * account — cannot appear here. Read-only: there is nothing to save and no
 * action to call.
 */
export default async function AdminCustomersPage() {
  await requireAdmin();

  const { customers, total, totalPages } = await listAdminCustomers();

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl tracking-[0.08em] uppercase sm:text-3xl">
          Customers
        </h1>

        <p className="max-w-prose text-sm leading-relaxed text-black/60">
          Everyone who has created an account. Guest checkouts are deliberately
          not listed — they have no account to show.
        </p>
      </header>

      <CustomersManager customers={customers} total={total} totalPages={totalPages} />
    </section>
  );
}