import TeamMembersManager from "@/components/admin/TeamMembersManager";
import { requireAdmin } from "@/lib/admin/guard";
import { listAdminTeamMembers } from "@/lib/admin/queries";

/**
 * Team Members: add, edit and delete the people behind the footer's Team page.
 *
 * The list arrives in carousel order, so what is on screen is the order the
 * storefront will show. Saving and deleting run through `lib/admin/team.ts`,
 * which revalidates `/team`.
 */
export default async function AdminTeamPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requireAdmin();

  const params = await searchParams;
  const page = parseInt(params.page ?? "1", 10);

  const { members, total, totalPages, currentPage } = await listAdminTeamMembers({ page });

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl tracking-[0.08em] uppercase sm:text-3xl">
          Team Members
        </h1>

        <p className="max-w-prose text-sm leading-relaxed text-black/60">
          The circles on the Team page, in carousel order. New members are added
          to the end of the carousel.
        </p>
      </header>

      <TeamMembersManager
        members={members}
        total={total}
        totalPages={totalPages}
        currentPage={currentPage}
      />
    </section>
  );
}
