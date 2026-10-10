import Link from "next/link";

import FooterNewsletterForm from "@/components/layout/FooterNewsletterForm";
import MobileFooterAccordion from "@/components/layout/MobileFooterAccordion";
import SocialLinks from "@/components/layout/SocialLinks";
import { CONTENT_CONTAINER } from "@/lib/content-container";
import { FOOTER_LOGO_CLASS } from "@/lib/logo";
import { STORE_POLICY_LINKS } from "@/lib/policy-types";
import {
  mailtoHref,
  telHref,
  type StoreDetails,
} from "@/lib/site-config";
import { cn } from "@/lib/utils";

/**
 * The compact base every footer uses: `PageFooter` takes it as-is (natural
 * height, comfortable-but-not-generous padding), while the homepage slide
 * overrides the spacing through its own `className` so the same markup can
 * fill a viewport without ever gaining a second set of content.
 *
 * No vertical padding here — the normal footer carries it on its own `<footer>`
 * element, and the slide pins its copyright to the bottom of the viewport, so
 * neither has to fight the other over a shared `py-*`.
 *
 * The width comes from `CONTENT_CONTAINER` — the same shared container as the
 * navbar and the listing grid — so the footer columns line up with the
 * hamburger / breadcrumb left edge and the cart-icon right edge on every page.
 */
const CONTENT_BASE = cn(
  CONTENT_CONTAINER,
  "flex flex-col items-center gap-6 text-center md:gap-10",
);

/**
 * The centred block holding the five columns. `flex-1` is what lets the
 * wordmark and the copyright line sit at the very bottom of a full-screen
 * footer while the columns stay vertically centred; on a normal-height footer
 * there is no free space, so it simply sizes to its content.
 */
const MAIN_BLOCK_CLASS =
  "flex w-full flex-1 flex-col items-center justify-center gap-8 md:gap-10";

/**
 * SHOP / CONTACT / FOLLOW / POLICIES / newsletter: five columns from `lg` up,
 * on a fixed gutter and `minmax(0, …)` tracks so no column can be pushed wider
 * than its share and collide with the next one. The tracks are deliberately
 * uneven: the CONTACT column gets the most room so a normal email address fits
 * on one line at `lg` and up, FOLLOW enough for an icon + platform name row (a
 * 36px circle plus the label), POLICIES enough for "Terms of Service", and the
 * newsletter column enough for the signup box plus the two buttons under it.
 *
 * Hidden below `md`: phones get the centred accordion instead. From `md` the
 * columns wrap onto two (`md`) and then five (`lg`), so nothing ever overlaps
 * and nothing scrolls sideways.
 */
const COLUMNS_CLASS =
  "hidden w-full gap-6 text-left md:grid md:grid-cols-2 md:gap-x-8 md:gap-y-10 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.95fr)_minmax(0,1.15fr)_minmax(0,1.3fr)_minmax(0,1.45fr)] lg:gap-x-8 lg:gap-y-10";

/**
 * SHOP / CONTACT / FOLLOW / POLICIES: the plain sans the links use — the global
 * `h1-h6` rule is serif, so the headings below carry an inline
 * `fontFamily: var(--font-sans)` to take the serif back off. The links stay one
 * step smaller than before (13px), still clearly smaller than the headings,
 * medium weight on the headings.
 */
const COLUMN_HEADING_CLASS =
  "mb-5 font-sans text-[15px] font-medium uppercase tracking-[0.14em] lg:text-[19px]";

/**
 * Links and contact text: 13px on both mobile and desktop (one step down from
 * the old 14/15px), uppercase. `overflow-wrap: anywhere` is the safety net for
 * long values (a long email address above all): at a tight width the value
 * breaks inside its own column instead of pushing into — or over — the next one.
 * The mobile accordion rows keep their own 44px tap targets.
 */
const COLUMN_BODY_CLASS =
  "space-y-3 text-[13px] uppercase tracking-[0.08em] text-black/70 [overflow-wrap:anywhere]";

/**
 * The newsletter line is deliberately not styled like the headings: it reuses
 * the exact body styling of the CONTACT column — the address line ("Orangi Town
 * Karachi") and the links — plus `leading-relaxed` so its wrapped lines breathe
 * the same way the address does. `mb-5` is its own bottom space, and the
 * `font-sans` utility alone is not enough here (see the note on the h2 below).
 */
const NEWSLETTER_HEADING_CLASS = cn(
  COLUMN_BODY_CLASS,
  "mb-4 font-sans text-[13px] leading-relaxed",
);

const COLUMN_LINK_CLASS =
  "underline-offset-4 transition-colors hover:text-plum hover:underline";

/**
 * The Contact Us and Team buttons under the newsletter box: the same plum
 * border, plum text and hover fill as before, now square-cornered and a touch
 * shorter. `flex-1` makes the two equal and exactly as wide together as the
 * signup box, `whitespace-nowrap` keeps each label on one line, and
 * `flex-wrap` on their row lets them wrap as whole buttons when the column
 * gets narrow.
 */
const FOOTER_LINK_CLASS =
  "inline-flex h-10 min-w-[6.5rem] flex-1 items-center justify-center whitespace-nowrap border border-plum px-4 text-sm font-medium text-plum transition-colors hover:bg-plum hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum";

type SiteFooterContentProps = {
  categories: { name: string; slug: string }[];
  /**
   * The store's name, contact details and social links, merged by
   * `getStoreDetails()` from Settings over `site-config.ts`. Passed down from
   * the server page that renders the footer, because this component sits inside
   * the homepage's client tree.
   */
  details: StoreDetails;
  /**
   * Merged after the shared base classes, so each footer shell (full-screen
   * slide vs. normal page footer) only has to say what is different about it.
   */
  className?: string;
};

/**
 * The newsletter column, shared by the desktop grid and the mobile stack (so
 * the signup box, the two buttons and their spacing can never drift apart).
 *
 * `idSuffix` keeps the heading id unique: both layouts are in the DOM at once,
 * one hidden by CSS, so the same id twice would be invalid and would break the
 * `aria-labelledby`.
 */
function FooterNewsletter({ idSuffix }: { idSuffix: string }) {
  const headingId = `footer-newsletter-${idSuffix}`;

  return (
    <section aria-labelledby={headingId} className="w-full min-w-0">
      {/*
        Like the column headings above, this has to beat the unlayered `h1-h6`
        serif rule in globals.css — `font-sans` on its own cannot win — so an
        inline family does it, exactly as SHOP / CONTACT / FOLLOW / POLICIES do.
      */}
      <h2
        id={headingId}
        className={NEWSLETTER_HEADING_CLASS}
        style={{ fontFamily: "var(--font-sans)" }}
      >
        Sign up to discover our latest collections
      </h2>
      {/* UI only: no endpoint, no table, no validation — the button does nothing. */}
      <FooterNewsletterForm idSuffix={idSuffix} />

      {/*
        Contact lives here and only here: it is deliberately absent from the
        hamburger menu, so this is the one place it can be reached from. One row,
        equal width, exactly as wide as the signup box above them; centred on
        phones, left-aligned in the desktop column.
      */}
      <div className="mt-6 flex flex-wrap justify-center gap-3 md:justify-start">
        <Link href="/contact" className={FOOTER_LINK_CLASS}>
          Contact Us
        </Link>

        <Link href="/team" className={FOOTER_LINK_CLASS}>
          Team Members
        </Link>
      </div>
    </section>
  );
}

/**
 * The single definition of the footer: the Shop / Contact / Follow / Policies /
 * Newsletter columns (with the Contact Us and Team buttons under the signup
 * box), then the black wordmark, then the copyright line.
 *
 * `SiteFooter` wraps this in the homepage's full-screen cover-scroll slide,
 * `PageFooter` renders it as a normal block at the bottom of every other page.
 * Both share this markup, so the content can never drift apart. The contact
 * details and social links come from Settings with `site-config.ts` as the
 * fallback, and the /contact page reads the same values.
 *
 * Layout: everything above the wordmark lives in one `flex-1` block, so the
 * wordmark and the copyright are always the last two lines — bottom of the
 * footer on a normal page, bottom of the viewport on the homepage slide.
 * The wordmark is the navbar logo itself (same font, weight and tracking from
 * `lib/logo`, ~1.3x bigger, black), centred directly above the copyright.
 */
export default function SiteFooterContent({
  categories,
  details,
  className,
}: SiteFooterContentProps) {
  return (
    <div className={cn(CONTENT_BASE, className)}>
      <div className={MAIN_BLOCK_CLASS}>
        <div className={COLUMNS_CLASS}>
          <section aria-labelledby="footer-shop" className="min-w-0">
            <h2
              id="footer-shop"
              className={COLUMN_HEADING_CLASS}
              style={{ fontFamily: "var(--font-sans)" }}
            >
              Shop
            </h2>
            <ul className={COLUMN_BODY_CLASS}>
              {categories.map((category) => (
                <li key={category.slug}>
                  <Link
                    href={`/category/${category.slug}`}
                    className={COLUMN_LINK_CLASS}
                  >
                    {category.name}
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="footer-contact" className="min-w-0">
            <h2
              id="footer-contact"
              className={COLUMN_HEADING_CLASS}
              style={{ fontFamily: "var(--font-sans)" }}
            >
              Contact
            </h2>
            <ul className={COLUMN_BODY_CLASS}>
              <li>
                <a
                  href={mailtoHref(details.contact.email)}
                  className={COLUMN_LINK_CLASS}
                >
                  {details.contact.email}
                </a>
              </li>
              <li>
                <a
                  href={telHref(details.contact.phone)}
                  className={COLUMN_LINK_CLASS}
                >
                  {details.contact.phone}
                </a>
              </li>
              <li className="max-w-[28ch] leading-relaxed">
                {details.contact.address}
              </li>
            </ul>
          </section>

          <section aria-labelledby="footer-social" className="min-w-0">
            <h2
              id="footer-social"
              className={COLUMN_HEADING_CLASS}
              style={{ fontFamily: "var(--font-sans)" }}
            >
              Follow
            </h2>
            {/*
              A vertical list, not the icon row the contact page uses: one link
              per platform, icon + name, so the column lines up with SHOP and
              CONTACT. `COLUMN_BODY_CLASS` carries the row rhythm (`space-y-3`)
              and the link typography; `COLUMN_LINK_CLASS` carries the hover
              state, so a row behaves exactly like the links beside it.
            */}
            <SocialLinks
              links={details.socials}
              variant="list"
              className={COLUMN_BODY_CLASS}
              linkClassName={COLUMN_LINK_CLASS}
            />
          </section>

          <section aria-labelledby="footer-policies" className="min-w-0">
            <h2
              id="footer-policies"
              className={COLUMN_HEADING_CLASS}
              style={{ fontFamily: "var(--font-sans)" }}
            >
              Policies
            </h2>
            <ul className={COLUMN_BODY_CLASS}>
              {STORE_POLICY_LINKS.map(({ slug, label }) => (
                <li key={slug}>
                  <Link
                    href={`/policies/${slug}`}
                    className={COLUMN_LINK_CLASS}
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <FooterNewsletter idSuffix="desktop" />
        </div>

        {/*
          Phones (below `md`) get the centred accordion instead of the columns:
          same content, tap to open, one section at a time. Its own newsletter
          block follows underneath so the signup box, buttons and wordmark stay
          in the one expected order.
        */}
        <MobileFooterAccordion categories={categories} details={details} />

        <div className="w-full md:hidden">
          <FooterNewsletter idSuffix="mobile" />
        </div>
      </div>

      {/*
        Below `md` the wordmark leads the footer: it is flex-ordered to the top
        of the stack (the accordion, newsletter and buttons follow it), with a
        comfortable ~32px gap into the first section. From `md` up it drops back
        to its normal spot, bottom-centre directly above the copyright line.
      */}
      <Link
        href="/"
        aria-label="ZUHA'S home"
        className={cn(
          FOOTER_LOGO_CLASS,
          "text-black transition-opacity hover:opacity-70",
          "order-first mb-2 md:order-none md:mb-0",
        )}
      >
        {details.name}
      </Link>

      <p className="w-full text-center text-[13px] leading-relaxed text-black/45 lg:text-[14px]">
        © {new Date().getFullYear()}{" "}
        <span className="text-black/70 underline underline-offset-2">
          ZUHA&apos;S
        </span>
        . All Rights Reserved. Design and Developed by{" "}
        <span className="text-black/70 underline underline-offset-2">
          Daniyal Ansari
        </span>
        .
      </p>
    </div>
  );
}
