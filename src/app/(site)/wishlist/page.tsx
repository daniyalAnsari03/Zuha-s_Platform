import type { Metadata } from "next";

import Breadcrumb from "@/components/layout/Breadcrumb";
import WishlistGrid from "@/components/wishlist/WishlistGrid";

export const metadata: Metadata = {
  title: "Wishlist — ZUHA'S",
  description: "The products you have saved at ZUHA'S.",
};

/**
 * The wishlist page: breadcrumb, then the listing grid (shared component) so a
 * saved product looks exactly like it does anywhere else on the site. The
 * navbar, the page spacing and the normal footer all come from the `(site)`
 * layout, and no login is required.
 */
export default function WishlistPage() {
  return (
    <section className="mx-auto w-full max-w-[1600px] px-4 sm:px-6 lg:px-12 xl:px-24">
      <h1 className="sr-only">Wishlist</h1>

      <Breadcrumb
        items={[{ label: "Home", href: "/" }, { label: "Wishlist" }]}
      />

      <div className="mt-6 lg:mt-8">
        <WishlistGrid />
      </div>
    </section>
  );
}