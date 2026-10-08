/**
 * The admin sidebar, in the order the dashboard is specified in.
 *
 * One list, so the desktop sidebar and the mobile drawer can never disagree, and
 * a later part of Phase 9 only has to fill in the page each href points at. The
 * `href`s are also the routes that exist under `/admin` today, which is what the
 * layout's guard protects.
 *
 * There is deliberately no link to any of this from the storefront: the admin
 * area is reached by typing `/admin`.
 */

export type AdminNavItem = {
  label: string;
  href: string;
};

export const ADMIN_NAV_ITEMS: readonly AdminNavItem[] = [
  { label: "Dashboard", href: "/admin" },
  { label: "Categories", href: "/admin/categories" },
  { label: "Products", href: "/admin/products" },
  { label: "Inventory", href: "/admin/inventory" },
  { label: "Orders", href: "/admin/orders" },
  { label: "Customers", href: "/admin/customers" },
  { label: "Messages", href: "/admin/messages" },
  { label: "Analytics", href: "/admin/analytics" },
  { label: "Announcement Bar", href: "/admin/announcements" },
  { label: "Team Members", href: "/admin/team" },
  { label: "Settings", href: "/admin/settings" },
] as const;

/**
 * Whether a sidebar item is the page currently open.
 *
 * `/admin` has to match exactly, or "Dashboard" would stay lit on every screen;
 * the rest match on a path segment, so `/admin/orders/1234` keeps "Orders" lit.
 */
export function isActiveAdminPath(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}