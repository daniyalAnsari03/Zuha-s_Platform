import MessagesManager from "@/components/admin/MessagesManager";
import { requireAdmin } from "@/lib/admin/guard";
import { listAdminContactMessages } from "@/lib/admin/queries";

/**
 * Messages: what visitors send from the /contact form (table
 * `contact_messages`, migration 013).
 *
 * The page fetches one page of rows newest first and hands them to the manager,
 * which opens a message in a dialog (marking it read through its own server
 * action) and deletes through the shared confirm dialog. Nothing here is
 * reachable without `requireAdmin()`, and the table itself has no RLS policy,
 * so the rows only ever travel through the service-role client.
 */
export default async function AdminMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requireAdmin();

  const params = await searchParams;
  const page = parseInt(params.page ?? "1", 10);

  const { messages, total, totalPages, currentPage } = await listAdminContactMessages({
    page: Number.isFinite(page) && page > 0 ? page : 1,
  });

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl tracking-[0.08em] uppercase sm:text-3xl">
          Messages
        </h1>

        <p className="max-w-prose text-sm leading-relaxed text-black/60">
          Sent from the contact form on /contact, newest first. Opening one
          marks it as read.
        </p>
      </header>

      <MessagesManager
        messages={messages}
        total={total}
        totalPages={totalPages}
        currentPage={currentPage}
      />
    </section>
  );
}
