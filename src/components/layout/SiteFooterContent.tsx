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
 * The shared footer content. The gradient itself lives on the full-width root
 * (`.site-footer` in globals.css), so it stretches edge to edge and grows with
 * the footer when a mobile accordion opens; this inner block only supplies the
 * shared container and the vertical rhythm.
 */
const CONTENT_BASE = cn(
  CONTENT_CONTAINER,
  "flex flex-1 flex-col items-center gap-5 text-center text-white md:gap-0",
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
 * Desktop/tablet top area (from `md` up): a four-column grid — the wider brand
 * column (wordmark, tagline, newsletter, text links) then SHOP, FOLLOW and
 * POLICIES. Hidden below `md`: phones get the wordmark, the SHOP / FOLLOW /
 * POLICIES accordion and the newsletter as a centred stack instead.
 */
const TOP_GRID_CLASS =
  "hidden w-full text-left md:grid md:grid-cols-[1.2fr_1fr_1fr_1fr] md:items-start md:gap-x-[26px]";

/**
 * SHOP / FOLLOW / POLICIES: the plain sans the links use — the global `h1-h6`
 * rule is serif, so the headings carry an inline `fontFamily: var(--font-sans)`
 * to take the serif back off. Small uppercase, letter-spaced, medium weight.
 */
const COLUMN_HEADING_CLASS =
  "mb-4 font-sans text-[11px] font-medium uppercase tracking-[0.2em] text-white";

/**
 * Links inside the columns: 11px uppercase, with `overflow-wrap: anywhere` so
 * a long label can never push into the neighbouring column.
 */
const COLUMN_BODY_CLASS =
  "space-y-[11px] text-[11px] uppercase tracking-[0.1em] text-white/90 [overflow-wrap:anywhere]";

const COLUMN_LINK_CLASS =
  "opacity-90 transition-opacity duration-200 hover:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80";

/**
 * The newsletter line reuses the exact body styling of the link columns, plus
 * `leading-relaxed`; `mb-4` is its own bottom space, and the `font-sans`
 * utility alone is not enough here (see the note on the h2 below).
 */
const NEWSLETTER_HEADING_CLASS = cn(
  COLUMN_BODY_CLASS,
  "mb-4 font-sans text-[11px] leading-relaxed text-white/80",
);

/**
 * Footer text links under the newsletter: no buttons, no filled backgrounds.
 */
const FOOTER_LINK_CLASS =
  "inline-flex items-center justify-center gap-1 whitespace-nowrap text-[11px] uppercase tracking-[0.14em] text-white opacity-90 transition-opacity hover:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80";

/**
 * The wordmark link, shared by the mobile stack and the desktop column: the
 * navbar logo itself (same font, weight and tracking from `lib/logo`, ~1.3x
 * bigger), white, opening the homepage.
 */
const WORDMARK_CLASS = cn(
  FOOTER_LOGO_CLASS,
  "text-white transition-opacity hover:opacity-70",
);

/**
 * The four payment logos, taken exactly as placed in `public/payments/`:
 * not links, never recoloured, rendered with `object-contain` so the original
 * aspect and transparency are untouched. The logos have very different aspect
 * ratios, so each carries its OWN height (width auto) — that is what makes all
 * four carry the same visual weight, rather than one shared height that
 * shrinks the wider logos. Desktop / mobile heights are tuned per logo.
 */
const PAYMENT_LOGOS = [
  {
    src: "/payments/meezan.png",
    alt: "Meezan Bank",
    width: 334,
    height: 100,
    className: "h-[30px] w-auto md:h-[36px]",
  },
  {
    src: "/payments/jazzcash.png",
    alt: "JazzCash",
    width: 127,
    height: 100,
    className: "h-[36px] w-auto md:h-[44px]",
  },
  {
    src: "/payments/nayapay.png",
    alt: "NayaPay",
    width: 578,
    height: 100,
    className: "h-[18px] w-auto md:h-[22px]",
  },
  {
    src: "/payments/easypaisa.png",
    alt: "Easypaisa",
    width: 358,
    height: 100,
    className: "h-[30px] w-auto md:h-[36px]",
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
  "w-full px-4 pb-[72px] md:px-[140px] md:pt-[34px] md:pb-0";

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
 * The newsletter signup line plus the two text links under it — as one
 * section, shared by the desktop column and the mobile stack, so the input,
 * the links and their spacing can never drift apart. Contact Us and Team live
 * here and only here (they are not in the hamburger menu), so this is the one
 * place they can be reached from.
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

      <div className="mt-5 flex flex-nowrap items-center justify-center gap-[22px] md:justify-start">
        <Link href="/contact" className={FOOTER_LINK_CLASS}>
          Contact Us <span aria-hidden="true">→</span>
        </Link>

        <Link href="/team" className={FOOTER_LINK_CLASS}>
          Team <span aria-hidden="true">→</span>
        </Link>
      </div>
    </section>
  );
}

/**
 * The single definition of the footer:
 *
 * - From `md` up, one top area in a four-column grid inside the content
 *   container: the brand column (white wordmark, a short tagline on `lg` and
 *   up, the newsletter and the two text links) followed by SHOP (dynamic from
 *   the categories table), FOLLOW (social links with a small icon + a label,
 *   only for networks whose link is set) and POLICIES.
 * - Below `md`, everything is centred: the wordmark leads the footer, then
 *   the SHOP / FOLLOW / POLICIES accordion, then the newsletter with the same
 *   two text links.
 * - Below the top area, the four payment logos in one centred row at their
 *   per-logo heights — no "We accept" text, no background or border — then
 *   the copyright line.
 *
 * The whole footer carries one continuous plum-to-light vertical gradient
 * (`.site-footer`), with no borders, boxes or filled buttons anywhere.
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
    <div className={cn("site-footer flex w-full flex-col", className)}>
      <div className={CONTENT_BASE}>
        {/*
          Phones (below `md`): the wordmark leads the footer, with the accordion
          and the newsletter following underneath. Hidden from `md` up, where
          the wordmark lives at the top of the brand column instead.
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

          <div className="mt-[6px] flex w-full flex-col items-center md:hidden">
            <div className="w-full max-w-[280px]">
              <FooterNewsletter idSuffix="mobile" />
            </div>
          </div>

          {/*
            Desktop/tablet top area: the brand column plus SHOP, FOLLOW and
            POLICIES as direct grid children.
          */}
          <div className={TOP_GRID_CLASS}>
            <div className="flex min-w-0 flex-col items-start gap-4">
              <Link href="/" aria-label="ZUHA'S home" className={WORDMARK_CLASS}>
                {details.name}
              </Link>

              <p className="hidden max-w-[230px] text-[11px] leading-[1.7] text-white/[0.88] lg:block">
                Editorial fashion for women, men and kids. Bags and jewellery to
                finish the look.
              </p>

              <div className="mt-1 w-full max-w-[250px]">
                <FooterNewsletter idSuffix="desktop" />
              </div>
            </div>

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

        {/*
          Bottom block: the four payment logos in one centred row at their own
          heights (wrap on tight screens), then the copyright. The insets keep
          the fixed currency switcher and WhatsApp button clear of both (see
          `BOTTOM_BLOCK_CLASS`).
        */}
        <div className={BOTTOM_BLOCK_CLASS}>
          <div className="flex flex-wrap items-center justify-center gap-4 md:gap-7">
            {PAYMENT_LOGOS.map((logo) => (
              <Image
                key={logo.alt}
                src={logo.src}
                alt={logo.alt}
                width={logo.width}
                height={logo.height}
                quality={IMAGE_QUALITY}
                className={cn("object-contain", logo.className)}
              />
            ))}
          </div>

          <p className="mt-6 w-full text-center text-[10px] leading-relaxed text-[color:var(--site-footer-copyright)] md:mt-10">
            © {new Date().getFullYear()}{" "}
            <span className="underline underline-offset-2">ZUHA&apos;S</span>.
            All Rights Reserved. Design and Developed by{" "}
            <a
              href="https://daniya-portfolio.vercel.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4 transition-colors hover:text-plum"
            >
              Daniyal Portfolio
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
