import SettingsForm from "@/components/admin/SettingsForm";
import StorePoliciesManager from "@/components/admin/StorePoliciesManager";
import { requireAdmin } from "@/lib/admin/guard";
import {
  getAdminStoreDetails,
  listAdminStorePolicies,
} from "@/lib/admin/queries";

/**
 * Settings: the public contact details and social links the footer and the
 * contact page render, plus the four public policy pages.
 *
 * The contact details come from the single `store_details` row — never the
 * `settings` table, which holds the admin allowlist and is admin-only readable
 * by design. The policies come from `store_policies` (migration 014).
 */
export default async function AdminSettingsPage() {
  await requireAdmin();

  const [details, policies] = await Promise.all([
    getAdminStoreDetails(),
    listAdminStorePolicies(),
  ]);

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl tracking-[0.08em] uppercase sm:text-3xl">
          Settings
        </h1>

        <p className="max-w-prose text-sm leading-relaxed text-black/60">
          The store&apos;s contact details and social links, shown in the footer
          and on the contact page. Anything you leave blank falls back to the
          site&apos;s default.
        </p>
      </header>

      <SettingsForm initial={details} />

      <StorePoliciesManager policies={policies} />
    </section>
  );
}
