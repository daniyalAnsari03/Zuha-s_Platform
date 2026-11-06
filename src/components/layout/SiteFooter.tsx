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
      className="absolute inset-0 overflow-y-auto overscroll-contain bg-[#f1e7ee]"
      data-scrollable
      id="site-footer"
      style={{ contentVisibility: "auto", containIntrinsicSize: "100svh" }}
    >
      {/*
        Full-screen slide: the shared content keeps its markup and only swaps
        its compact page-footer spacing for viewport-filling spacing. The
        flexible spacer inside the content holds the payment logos and the
        copyright line at the bottom edge of the viewport, while the columns
        stay at the top — the ~96-120px top padding is what clears the fixed
        announcement bar + navbar floating over the slide. The paddings are
        kept tight enough that the top area ends in the gradient's dark upper
        half and the bottom block lands on its white tail.
      */}
      <SiteFooterContent
        categories={categories}
        details={details}
        className="min-h-[max(100%,100svh)] pt-6 pb-4 md:pt-[96px] lg:pt-[120px] md:pb-6"
      />
    </div>
  );
}
