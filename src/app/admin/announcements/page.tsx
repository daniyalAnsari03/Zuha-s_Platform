import AnnouncementsManager from "@/components/admin/AnnouncementsManager";
import { requireAdmin } from "@/lib/admin/guard";
import { listAdminAnnouncements } from "@/lib/admin/queries";

/**
 * Announcement Bar: add and remove the lines the homepage ticker scrolls.
 *
 * One server read for the list, then the manager's own add and remove actions,
 * each of which revalidates `/` so the storefront picks the change up
 * immediately.
 */
export default async function AdminAnnouncementsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requireAdmin();

  const params = await searchParams;
  const page = parseInt(params.page ?? "1", 10);

  const { announcements, total, totalPages, currentPage } = await listAdminAnnouncements({ page });

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl tracking-[0.08em] uppercase sm:text-3xl">
          Announcement Bar
        </h1>

        <p className="max-w-prose text-sm leading-relaxed text-black/60">
          The text-only ticker at the very top of the homepage. Add as many
          lines as you like; they scroll in the order below.
        </p>
      </header>

      <AnnouncementsManager
        announcements={announcements}
        total={total}
        totalPages={totalPages}
        currentPage={currentPage}
      />
    </section>
  );
}
