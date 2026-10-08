import type { Metadata } from "next";
import { redirect } from "next/navigation";

import AdminAccessDenied from "@/components/admin/AdminAccessDenied";
import AdminShell from "@/components/admin/AdminShell";
import { adminLoginHref, getAdminAccess } from "@/lib/admin/guard";
import { countUnreadContactMessages } from "@/lib/admin/queries";

/**
 * The admin area's shell and its server-side gate.
 *
 * This layout is a Server Component and runs on every request under `/admin`,
 * which is what makes it a gate rather than a suggestion: Next.js renders it
 * before any page below it, so nothing inside the tree can be reached without
 * passing it first.
 *
 * Three outcomes:
 *
 *  - not signed in  -> redirected to `/login?next=/admin`, so signing in brings
 *                      the admin back to the dashboard instead of the storefront;
 *  - signed in, not
 *    on the allowlist -> a plain access-denied page and nothing else. No sidebar,
 *                      no nav list, no admin data;
 *  - on the allowlist -> the shell, with the admin's email for the footer.
 *
 * The layout is one line of defence, not the only one: every admin page, server
 * action and data function calls `requireAdmin()` itself, because a layout cannot
 * protect a server action that is invoked directly.
 *
 * The dashboard has no storefront navbar, footer or announcement bar, and the
 * whole tree is `noindex` — it is reached by typing `/admin`, never by a link.
 */

export const metadata: Metadata = {
  title: "Zuha Admin",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const access = await getAdminAccess();

  if (access.status === "signed-out") {
    redirect(adminLoginHref());
  }

  if (access.status === "denied") {
    return <AdminAccessDenied />;
  }

  return (
    <AdminShell
      email={access.user.email}
      unreadMessages={await unreadMessageCount()}
    >
      {children}
    </AdminShell>
  );
}

/**
 * The sidebar's unread badge: one head count, on the service-role client, that
 * `requireAdmin()` has already cleared for.
 *
 * It is the one admin read that is allowed to fail quietly — a badge is not
 * worth taking the whole dashboard down for, which is what would happen if
 * migration 013 had not been run yet. The Messages screen itself does report
 * that failure, loudly, as every admin screen reports its own.
 */
async function unreadMessageCount(): Promise<number> {
  try {
    return await countUnreadContactMessages();
  } catch (error) {
    console.error(
      "[admin] could not count unread messages.",
      error instanceof Error ? error.message : String(error),
    );
    return 0;
  }
}