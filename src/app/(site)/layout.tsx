import type { CSSProperties } from "react";

import CurrencySwitcher from "@/components/currency/CurrencySwitcher";
import AnnouncementBar from "@/components/layout/AnnouncementBar";
import Navbar from "@/components/layout/Navbar";
import PageFooter from "@/components/layout/PageFooter";
import { QuickViewProvider } from "@/components/products/ProductQuickViewProvider";
import {
  ANNOUNCEMENT_BAR_HEIGHT_PX,
  NAVBAR_HEIGHT_MD_PX,
  NAVBAR_HEIGHT_PX,
} from "@/lib/header-tone";
import { getHomeAnnouncements } from "@/lib/home-data";
import { getMenuCategories } from "@/lib/menu-data";
import { getStoreDetails } from "@/lib/store-details";

/**
 * Shell for every page except the homepage.
 *
 * - `main` is given a minimum height of one full viewport minus the header
 *   (announcement bar + navbar, see `lib/header-tone`), so header + content
 *   always fill the first screen and the normal footer starts *below* the fold
 *   on short pages - never inside the first viewport, never flashing into view
 *   while a page loads. Pages with more content than one screen simply flow past
 *   it and the footer follows, exactly as before. `svh` (not `vh`) keeps it
 *   correct on mobile browsers whose address bar changes the visible height.
 * - The announcement ticker sits first, in normal flow, so it never overlaps
 *   the navbar or the content (and renders nothing at all when the dashboard
 *   has no announcements, so the reserved height drops by the bar's height).
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

  // The ticker renders nothing (no gap) when there are no announcements, so the
  // header only takes the bar's height when the bar is actually on the page.
  const announcementHeight =
    announcements.length > 0 ? ANNOUNCEMENT_BAR_HEIGHT_PX : 0;
  const headerVars = {
    "--site-content-min-h": `calc(100svh - ${
      announcementHeight + NAVBAR_HEIGHT_PX
    }px)`,
    "--site-content-min-h-md": `calc(100svh - ${
      announcementHeight + NAVBAR_HEIGHT_MD_PX
    }px)`,
  } as CSSProperties;

  return (
    <QuickViewProvider>
      <div className="flex flex-col bg-white text-black">
        <AnnouncementBar announcements={announcements} variant="flow" />

        {/* Solid variant: plain black chrome, no border, shadow or background. */}
        <Navbar
          variant="solid"
          hidden={false}
          menuCategories={categories}
        />

        <main
          style={headerVars}
          className="flex flex-col min-h-[var(--site-content-min-h)] md:min-h-[var(--site-content-min-h-md)] pt-6 pb-16 md:pt-9 md:pb-24"
        >
          {children}
        </main>

        <PageFooter
          categories={categories.map(({ name, slug }) => ({ name, slug }))}
          details={details}
        />
      </div>

      {/* Fixed to the viewport, so it floats over every storefront page. */}
      <CurrencySwitcher />
    </QuickViewProvider>
  );
}