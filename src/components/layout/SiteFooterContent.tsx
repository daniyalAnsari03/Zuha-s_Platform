import Link from "next/link";

import FooterNewsletterForm from "@/components/layout/FooterNewsletterForm";
import SocialLinks from "@/components/layout/SocialLinks";
import { FOOTER_LOGO_CLASS } from "@/lib/logo";
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
 */
const CONTENT_BASE =
  "mx-auto flex w-full max-w-6xl flex-col items-center gap-6 px-6 text-center sm:px-8 md:gap-10";

/**
 * The centred block holding the four columns. `flex-1` is what lets the
 * wordmark and the copyright line sit at the very bottom of a full-screen
 * footer while the columns stay vertically centred; on a normal-height footer
 * there is no free space, so it simply sizes to its content.
 */
const MAIN_BLOCK_CLASS =
  "flex w-full flex-1 flex-col items-center justify-center gap-8 md:gap-10";

/**
 * SHOP / CONTACT / FOLLOW / newsletter: four columns from `lg` up, on a fixed
 * 48px gutter and `minmax(0, …)` tracks so no column can be pushed wider than
 * its share and collide with the next one. The tracks are deliberately uneven:
 * the CONTACT column gets room for a long email, FOLLOW enough for an
 * icon + platform name row (a 36px circle plus the label) without the name
 * wrapping, and the newsletter column enough for the signup box plus the two
 * buttons under it. Below `lg` the columns wrap onto two columns (`sm`) and
 * then one (mobile), so nothing ever overlaps and nothing scrolls sideways.
 */
const COLUMNS_CLASS =
  "grid w-full gap-6 text-left sm:grid-cols-2 sm:gap-x-8 sm:gap-y-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1.45fr)_minmax(0,1.55fr)] lg:gap-x-12 lg:gap-y-10";

/**
 * SHOP / CONTACT / FOLLOW: the plain sans the links use (the global `h1-h6`
 * rule is serif, so `font-sans` is what takes the serif back off), medium
 * weight, 15px mobile / 19px desktop — still clearly bigger than the links.
 * The three headings still render serif: the unlayered heading rule in
 * `globals.css` outranks the utility, and that is the intended look for them.
 */
const COLUMN_HEADING_CLASS =
  "mb-5 font-sans text-[15px] font-medium uppercase tracking-[0.14em] lg:text-[19px]";

/**
 * Links and contact text: 14px on mobile, 15px from `lg` up, uppercase.
 * `overflow-wrap: anywhere` is the safety net for long values (a long email
 * address above all): at a tight width the value breaks inside its own column
 * instead of pushing into — or over — the next one.
 */
const COLUMN_BODY_CLASS =
  "space-y-3 text-sm uppercase tracking-[0.08em] text-black/70 [overflow-wrap:anywhere] lg:text-[15px]";

/**
 * The newsletter line is deliberately not styled like the headings: it reuses
 * the exact body styling of the CONTACT column — the address line ("Orangi Town
 * Karachi") and the links — plus `leading-relaxed` so its wrapped lines breathe
 * the same way the address does. `mb-5` is its own bottom space, and the
 * `font-sans` utility alone is not enough here (see the note on the h2 below).
 */
const NEWSLETTER_HEADING_CLASS = cn(
  COLUMN_BODY_CLASS,
  "mb-5 font-sans leading-relaxed",
);

const COLUMN_LINK_CLASS =
  "underline-offset-4 transition-colors hover:text-plum hover:underline";

/**
 * The Contact Us and Team buttons under the newsletter box: the same plum
 * border, plum text, pill shape and hover fill as before, minus the fixed
 * `min-width` so two of them share one row — `flex-1` makes them equal and
 * exactly as wide together as the signup box, and `min-w` is only there to
 * make them fall back to a full-width stack if the column ever gets narrower
 * than two of them can be.
 */
const FOOTER_LINK_CLASS =
  "inline-flex h-11 min-w-[6.5rem] flex-1 items-center justify-center rounded-full border border-plum px-4 text-sm font-medium text-plum transition-colors hover:bg-plum hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum";

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
 * The single definition of the footer: the Shop / Contact / Follow /
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
            <h2 id="footer-shop" className={COLUMN_HEADING_CLASS}>
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
            <h2 id="footer-contact" className={COLUMN_HEADING_CLASS}>
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
            <h2 id="footer-social" className={COLUMN_HEADING_CLASS}>
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

          <section aria-labelledby="footer-newsletter" className="min-w-0">
            {/*
              The only sans heading in the footer: it has to match the links
              below it, and `font-sans` on its own cannot win — the unlayered
              `h1-h6` rule in globals.css outranks every Tailwind utility, which
              is exactly why SHOP / CONTACT / FOLLOW still render serif. An
              inline family is the one thing that beats it.
            */}
            <h2
              id="footer-newsletter"
              className={NEWSLETTER_HEADING_CLASS}
              style={{ fontFamily: "var(--font-sans)" }}
            >
              Sign up to discover our latest collections
            </h2>
            {/* UI only: no endpoint, no table, no validation — the button does nothing. */}
            <FooterNewsletterForm />

            {/*
              Contact lives here and only here: it is deliberately absent from
              the hamburger menu, so this is the one place it can be reached
              from. One row, equal width, exactly as wide as the signup box
              above them.
            */}
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/contact" className={FOOTER_LINK_CLASS}>
                Contact Us
              </Link>

              <Link href="/team" className={FOOTER_LINK_CLASS}>
                Team
              </Link>
            </div>
          </section>
        </div>
      </div>

      <Link
        href="/"
        aria-label="ZUHA'S home"
        className={cn(
          FOOTER_LOGO_CLASS,
          "text-black transition-opacity hover:opacity-70",
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
