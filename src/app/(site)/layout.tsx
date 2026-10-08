import AnnouncementBar from "@/components/layout/AnnouncementBar";
import Navbar from "@/components/layout/Navbar";
import PageFooter from "@/components/layout/PageFooter";
import { QuickViewProvider } from "@/components/products/ProductQuickViewProvider";
import { getHomeAnnouncements } from "@/lib/home-data";
import { getMenuCategories } from "@/lib/menu-data";
import { getStoreDetails } from "@/lib/store-details";

/**
 * Shell for every page except the homepage.
 *
 * - `min-h-dvh` + flex column keeps the normal footer pinned to the bottom of
 *   the screen on short pages and lets it flow naturally after long ones.
 * - The announcement ticker sits first, in normal flow, so it never overlaps
 *   the navbar or the content (and renders nothing at all when the dashboard
 *   has no announcements).
 * - The navbar sits in normal flow below it (plain black on white, no border,
 *   shadow or background), so `main` only has to add the gap between the
 *   navbar and the page content: 24px on mobile, 36px from tablet up. Those
 *   numbers are what keep the logo-to-breadcrumb spacing in spec (see
 *   AGENTS.md) - the navbar row height and this padding are tuned together.
 *
 * The same category tree feeds the hamburger menu and the footer's shop links,
 * so the two can never disagree about what exists.
 *
 * The homepage stays outside this group: it owns its own fixed full-screen
 * stack with the footer as the last slide.
 */
export default async function SiteLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [categories, details, announcements] = await Promise.all([
    getMenuCategories(),
    getStoreDetails(),
    getHomeAnnouncements(),
  ]);

  return (
    <QuickViewProvider>
      <div className="flex min-h-dvh flex-col bg-white text-black">
        <AnnouncementBar announcements={announcements} variant="flow" />

        {/* Solid variant: plain black chrome, no border, shadow or background. */}
        <Navbar
          variant="solid"
          hidden={false}
          menuCategories={categories}
        />

        <main className="flex flex-1 flex-col pt-6 pb-16 md:pt-9 md:pb-24">
          {children}
        </main>

        <PageFooter
          categories={categories.map(({ name, slug }) => ({ name, slug }))}
          details={details}
        />
      </div>
    </QuickViewProvider>
  );
}