/**
 * The ZUHA'S wordmark, in one place so the navbar logo and the footer wordmark
 * can never drift apart: same font (Playfair Display via `font-serif`), same
 * semibold weight, same wide letter spacing.
 *
 * The tracking values are `em`-based, so they scale with the font-size — the
 * footer wordmark reuses them unchanged at its own larger sizes and still
 * reads as the same logo, just bigger.
 */

/** Font, weight and shape only — the sizes are chosen by each surface. */
export const LOGO_FONT_CLASS =
  "font-serif font-semibold leading-none whitespace-nowrap";

/**
 * Navbar logo: the compact sizes tuned to the navbar row height (see the
 * header-logo note in AGENTS.md §3). Do not change them here alone.
 */
export const LOGO_CLASS = `${LOGO_FONT_CLASS} text-[28px] tracking-[0.14em] sm:text-[34px] sm:tracking-[0.18em] md:text-[38px] md:tracking-[0.2em] lg:text-[44px]`;

/**
 * Footer wordmark: the same logo at ~1.3x the navbar size (36 / 44 / 50 / 57px
 * against 28 / 34 / 38 / 44px), centred directly above the copyright line and
 * coloured black by the footer itself.
 */
export const FOOTER_LOGO_CLASS = `${LOGO_FONT_CLASS} text-[36px] tracking-[0.14em] sm:text-[44px] sm:tracking-[0.18em] md:text-[50px] md:tracking-[0.2em] lg:text-[57px]`;
