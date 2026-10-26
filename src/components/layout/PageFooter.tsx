import SiteFooterContent from "@/components/layout/SiteFooterContent";
import type { StoreDetails } from "@/lib/site-config";

type PageFooterProps = {
  categories: { name: string; slug: string }[];
  details: StoreDetails;
};

/**
 * The footer every page except the homepage ends with: the same content as the
 * homepage footer slide (the Shop / Follow / Policies columns, newsletter, the
 * payment logos row and the copyright) at a natural height, in normal flow. Rendered
 * by the shared page shell so short pages still push it to the bottom of the
 * viewport.
 *
 * The vertical padding lives on this `<footer>` rather than in the shared
 * content, so the homepage slide can size itself to the viewport instead.
 */
export default function PageFooter({ categories, details }: PageFooterProps) {
  return (
    <footer
      aria-label="Site footer"
      className="mt-auto w-full shrink-0 bg-white pt-10 pb-4 md:pt-12 md:pb-6"
      id="page-footer"
    >
      <SiteFooterContent categories={categories} details={details} />
    </footer>
  );
}
