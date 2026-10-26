import Link from "next/link";
import Image from "next/image";

import FooterNewsletterForm from "@/components/layout/FooterNewsletterForm";
import MobileFooterAccordion from "@/components/layout/MobileFooterAccordion";
import SocialLinks from "@/components/layout/SocialLinks";
import { CONTENT_CONTAINER } from "@/lib/content-container";
import { IMAGE_QUALITY } from "@/lib/images";
import { FOOTER_LOGO_CLASS } from "@/lib/logo";
import { STORE_POLICY_LINKS } from "@/lib/policy-types";
import type { SiteSocialLink, StoreDetails } from "@/lib/site-config";
import { cn } from "@/lib/utils";

/**
 * The compact base every footer uses: `PageFooter` takes it as-is (natural
 * height, comfortable-but-not-generous padding), while the homepage slide
 * overrides the spacing through its own `className` so the same markup can
 * fill a viewport without ever gaining a second set of content.
 *
 * No vertical padding here — the normal footer carries it on its own `<footer>`
 * element, and the slide pins the bottom block to the bottom of the viewport,
 * so neither has to fight the other over a shared `py-*`.
 *
 * The width comes from `CONTENT_CONTAINER` — the same shared container as the
 * navbar and the listing grid. The gaps between this block and the top area
 * (and, inside it, between top-area sections) are deliberately tight so the
 * top area reads compact and the payment row follows closely beneath it.
 */
const CONTENT_BASE = cn(
  CONTENT_CONTAINER,
  "flex flex-col items-center gap-5 text-center md:gap-8",
);

/**
 * The block holding everything above the payment row. `flex-1` is what lets
 * the bottom block (payment logos + copyright) sit at the very bottom of a
 * full-screen footer while the columns stay vertically centred; on a
 * normal-height footer there is no free space, so it simply sizes to content.
 */
const MAIN_BLOCK_CLASS =
  "flex w-full flex-1 flex-col items-center justify-center gap-5 md:gap-8";

/**
 * Desktop/tablet top area (from `md` up): two columns. LEFT = wordmark,
 * tagline (lg only), newsletter and the two outlined buttons under it;
 * RIGHT = SHOP, FOLLOW and POLICIES as three sub-columns. Hidden below `md`:
 * phones get the wordmark, the SHOP / FOLLOW / POLICIES accordion, the
 * newsletter (with the same two buttons) as a centred stack instead.
 */
const TOP_GRID_CLASS =
  "hidden w-full text-left md:grid md:grid-cols-2 md:items-start md:gap-x-12 lg:gap-x-16";

/** The three SHOP / FOLLOW / POLICIES sub-columns inside the right column. */
const NAV_COLUMN_GRID_CLASS =
  "grid grid-cols-3 items-start gap-x-6 lg:gap-x-8";

/**
 * SHOP / FOLLOW / POLICIES: the plain sans the links use — the global `h1-h6`
 * rule is serif, so the headings carry an inline `fontFamily: var(--font-sans)`
 * to take the serif back off. Small uppercase, letter-spaced, medium weight.
 */
const COLUMN_HEADING_CLASS =
  "mb-4 font-sans text-[15px] font-medium uppercase tracking-[0.14em] lg:text-[19px]";

/**
 * Links inside the columns: 13px uppercase, with `overflow-wrap: anywhere` so
 * a long label can never push into the neighbouring column.
 */
const COLUMN_BODY_CLASS =
  "space-y-3 text-[13px] uppercase tracking-[0.08em] text-black/70 [overflow-wrap:anywhere]";

const COLUMN_LINK_CLASS =
  "underline-offset-4 transition-colors hover:text-plum hover:underline";

/**
 * The newsletter line reuses the exact body styling of the link columns, plus
 * `leading-relaxed`; `mb-4` is its own bottom space, and the `font-sans`
 * utility alone is not enough here (see the note on the h2 below).
 */
const NEWSLETTER_HEADING_CLASS = cn(
  COLUMN_BODY_CLASS,
  "mb-4 font-sans text-[13px] leading-relaxed",
);

/**
 * The "Contact Us" and "Team Members" buttons under the newsletter box: a
 * solid plum fill with white text, hovering to the darker plum.
 */
const FOOTER_LINK_CLASS =
  "inline-flex h-11 min-w-[6.5rem] flex-1 items-center justify-center whitespace-nowrap rounded-full bg-plum px-4 text-sm font-medium text-white transition-colors hover:bg-plum-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum";

/**
 * The wordmark link, shared by the mobile stack and the desktop column: the
 * navbar logo itself (same font, weight and tracking from `lib/logo`, ~1.3x
 * bigger), black, opening the homepage.
 */
const WORDMARK_CLASS = cn(
  FOOTER_LOGO_CLASS,
  "text-black transition-opacity hover:opacity-70",
);

/**
 * The three payment logos, taken exactly as placed in `public/payments/`:
 * not links, never recoloured, rendered with `object-contain` so the original
 * aspect and transparency are untouched. The logos have very different aspect
 * ratios, so each carries its OWN height (width auto) — that is what makes all
 * three carry the same visual weight, rather than one shared height that
 * shrinks the wide logos. Desktop / mobile heights are tuned per logo.
 */
const PAYMENT_LOGOS = [
  {
    src: "/payments/meezan.png",
    alt: "Meezan Bank",
    width: 244,
    height: 73,
    className: "h-[30px] w-auto md:h-[38px]",
  },
  {
    src: "/payments/jazzcash.png",
    alt: "JazzCash",
    width: 100,
    height: 79,
    className: "h-[38px] w-auto md:h-[48px]",
  },
  {
    src: "/payments/paypal.png",
    alt: "PayPal",
    width: 200,
    height: 51,
    className: "h-[26px] w-auto md:h-[32px]",
  },
] as const;

/**
 * The payment logos row plus the copyright line, the footer's bottom block.
 *
 * The horizontal insets keep roughly 140px free on the left and right from
 * `md` up, so the fixed currency switcher (bottom-left) and WhatsApp button
 * (bottom-right) can never sit on top of the logos or the copyright. It ends
 * with ~72px of extra bottom padding on phones, so the copyright is never
 * hidden behind those same buttons there.
 */
const BOTTOM_BLOCK_CLASS =
  "w-full px-4 pb-[72px] md:px-[140px] md:pb-0";

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
 * The newsletter signup box plus the two outlined links under it — as one
 * section, shared by the desktop column and the mobile stack, so the box, the
 * buttons and their spacing can never drift apart. Contact Us and Team
 * Members live here and only here (they are not in the hamburger menu), so
 * this is the one place they can be reached from.
 *
 * `idSuffix` keeps the heading id unique: both copies are in the DOM at once,
 * one hidden by CSS, so the same id twice would be invalid and would break
 * the `aria-labelledby`.
 */
function FooterNewsletter({ idSuffix }: { idSuffix: string }) {
  const headingId = `footer-newsletter-${idSuffix}`;

  return (
    <section aria-labelledby={headingId} className="w-full min-w-0">
      {/*
        Like the column headings above, this has to beat the unlayered `h1-h6`
        serif rule in globals.css — `font-sans` on its own cannot win — so an
        inline family does it.
      */}
      <h2
        id={headingId}
        className={cn(NEWSLETTER_HEADING_CLASS, "text-center md:text-left")}
        style={{ fontFamily: "var(--font-sans)" }}
      >
        Sign up to discover our latest collections
      </h2>
      {/* UI only: no endpoint, no table, no validation — the button does nothing. */}
      <FooterNewsletterForm idSuffix={idSuffix} />

      <div className="mt-4 flex flex-wrap justify-center gap-3 md:justify-start">
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
 * The single definition of the footer:
 *
 * - From `md` up, one top area in two columns inside the content container:
 *   LEFT carries the black wordmark, a short tagline (lg and up only), the
 *   newsletter signup box and the "Contact Us" / "Team Members" buttons under
 *   it; RIGHT carries the three link columns — SHOP (dynamic from the
 *   categories table), FOLLOW (the social links with an icon + a label, only
 *   for networks whose link is set) and POLICIES (the four policy pages).
 * - Below `md`, everything is centred: the wordmark leads the footer, then
 *   the SHOP / FOLLOW / POLICIES accordion, then the newsletter box with the
 *   same two buttons.
 * - Below the top area, the three payment logos in one centred row at their
 *   per-logo heights — no "We accept" text, no background or border — then
 *   the copyright line.
 *
 * `SiteFooter` wraps this in the homepage's full-screen cover-scroll slide,
 * `PageFooter` renders it as a normal block at the bottom of every other
 * page. Both share this markup, so the content can never drift apart. The
 * social links come from Settings with `site-config.ts` as the fallback, and
 * the /contact page reads the same values.
 */
export default function SiteFooterContent({
  categories,
  details,
  className,
}: SiteFooterContentProps) {
  const socials: SiteSocialLink[] = details.socials.filter(
    (social) => social.href,
  );

  return (
    <div className={cn(CONTENT_BASE, className)}>
      {/*
        Phones (below `md`): the wordmark leads the footer, with the accordion
        and the newsletter following underneath. Hidden from `md` up, where
        the wordmark lives at the top of the left column instead.
      */}
      <Link
        href="/"
        aria-label="ZUHA'S home"
        className={cn(WORDMARK_CLASS, "order-first md:hidden")}
      >
        {details.name}
      </Link>

      <div className={MAIN_BLOCK_CLASS}>
        {/* The centred accordion stack phones get instead of the columns. */}
        <MobileFooterAccordion categories={categories} socials={socials} />

        <div className="flex w-full flex-col items-center gap-5 md:hidden">
          <div className="w-full max-w-md">
            <FooterNewsletter idSuffix="mobile" />
          </div>
        </div>

        {/*
          Desktop/tablet top area: the left column (brand, newsletter, the
          outlined links) and the right column (SHOP, FOLLOW, POLICIES).
        */}
        <div className={TOP_GRID_CLASS}>
          <div className="flex min-w-0 flex-col items-start gap-4">
            <Link href="/" aria-label="ZUHA'S home" className={WORDMARK_CLASS}>
              {details.name}
            </Link>

            <p className="hidden max-w-[34ch] text-[13px] leading-relaxed text-black/60 lg:block">
              Editorial fashion for women, men and kids. Bags and jewellery to
              finish the look.
            </p>

            <div className="mt-1 w-full max-w-[26rem]">
              <FooterNewsletter idSuffix="desktop" />
            </div>
          </div>

          <div className={NAV_COLUMN_GRID_CLASS}>
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

            {/*
              FOLLOW: a vertical icon + label list, not the icon-only row the
              /contact page uses, so the column lines up with SHOP beside it.
              Only networks whose link is set are rendered — a blank entry in
              the list would read as broken.
            */}
            <section aria-labelledby="footer-follow" className="min-w-0">
              <h2
                id="footer-follow"
                className={COLUMN_HEADING_CLASS}
                style={{ fontFamily: "var(--font-sans)" }}
              >
                Follow
              </h2>
              <SocialLinks
                links={socials}
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
          </div>
        </div>
      </div>

      {/*
        Bottom block: the three payment logos in one centred row at their own
        heights (wrap on tight screens), then the copyright. The insets keep
        the fixed currency switcher and WhatsApp button clear of both (see
        `BOTTOM_BLOCK_CLASS`).
      */}
      <div className={BOTTOM_BLOCK_CLASS}>
        <div className="flex flex-wrap items-center justify-center gap-5 md:gap-8">
          {PAYMENT_LOGOS.map((logo) => (
            <Image
              key={logo.alt}
              src={logo.src}
              alt={logo.alt}
              width={logo.width}
              height={logo.height}
              quality={IMAGE_QUALITY}
              className={logo.className}
            />
          ))}
        </div>

        <p className="mt-6 w-full text-center text-[13px] leading-relaxed text-black/45 md:mt-10 lg:text-[14px]">
          © {new Date().getFullYear()}{" "}
          <span className="text-black/70 underline underline-offset-2">
            ZUHA&apos;S
          </span>
          . All Rights Reserved. Design and Developed by{" "}
          <a
            href="https://daniya-portfolio.vercel.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-black/70 underline underline-offset-4 transition-colors hover:text-plum"
          >
            Daniyal Portfolio
          </a>
          .
        </p>
      </div>
    </div>
  );
}
