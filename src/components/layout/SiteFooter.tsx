import SiteFooterContent from "@/components/layout/SiteFooterContent";
import type { StoreDetails } from "@/lib/site-config";

type SiteFooterProps = {
  categories: { name: string; slug: string }[];
  details: StoreDetails;
};

/**
 * Homepage footer: the last slide of the category slider, so it fills the
 * viewport and scrolls on its own. The markup itself lives in
 * `SiteFooterContent`, shared with the normal footer on every other page.
 *
 * `details` arrives from the homepage's server component through the slider —
 * this sits inside the client tree, so it cannot read the database itself.
 */
export default function SiteFooter({ categories, details }: SiteFooterProps) {
  return (
    <div
      className="absolute inset-0 overflow-y-auto overscroll-contain bg-white"
      data-scrollable
      id="site-footer"
      style={{ contentVisibility: "auto", containIntrinsicSize: "100svh" }}
    >
      {/*
        Full-screen slide: the shared content keeps its markup and only swaps
        its compact page-footer spacing for viewport-filling spacing. The block
        above the wordmark is `flex-1`, so it centres itself and the wordmark
        plus the copyright line land on the bottom edge of the viewport. The
        paddings are kept tight enough that columns, buttons, wordmark and
        copyright all fit one slide — no internal scrolling — at the common
        desktop heights, with room to spare on tablet.
      */}
      <SiteFooterContent
        categories={categories}
        details={details}
        className="min-h-[max(100%,100svh)] pt-12 pb-4 md:pt-20 md:pb-6"
      />
    </div>
  );
}
