import HomeSlidesManager from "@/components/admin/HomeSlidesManager";
import { requireAdmin } from "@/lib/admin/guard";
import { listAdminHomeSlides } from "@/lib/admin/queries";

/**
 * Home Slides: the homepage slider's non-clickable informational slides.
 *
 * One server read for the list; the manager's own add / edit / move / toggle /
 * delete actions follow, each of which revalidates the homepage so the
 * storefront picks the change up immediately.
 */
export default async function AdminHomeSlidesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requireAdmin();

  const params = await searchParams;
  const page = parseInt(params.page ?? "1", 10);

  const { slides, total, totalPages, currentPage } = await listAdminHomeSlides({
    page,
  });

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl tracking-[0.08em] uppercase sm:text-3xl">
          Home Slides
        </h1>

        <p className="max-w-prose text-sm leading-relaxed text-black/60">
          Full-bleed slides without any link or text — “Sale Coming Soon”, “New
          Product Coming Soon”, and anything similar. They sit in the homepage
          slider between the Sale slide, the categories and the footer
          depending on each slide&apos;s placement.
        </p>
      </header>

      <HomeSlidesManager
        slides={slides}
        total={total}
        totalPages={totalPages}
        currentPage={currentPage}
      />
    </section>
  );
}
