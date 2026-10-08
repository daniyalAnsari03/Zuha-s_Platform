/**
 * The one image-quality rule for the storefront.
 *
 * `next.config.ts` lists the qualities Next.js is allowed to produce
 * (`images.qualities`); anything outside that list is silently snapped to the
 * nearest allowed value, so a `quality` prop on its own is not enough. Every
 * storefront `next/image` therefore passes `IMAGE_QUALITY`, and the config
 * declares it.
 *
 * The full-screen gallery viewer is the one exception: it renders at
 * `IMAGE_QUALITY_MAX`, because the same picture is what the customer zooms
 * into, and a 75-quality file looks soft once it is scaled 2x on screen.
 */
export const IMAGE_QUALITY = 95;

/** Full-screen viewer / zoomed state, where the picture is read at 1:1. */
export const IMAGE_QUALITY_MAX = 100;

/** Vectors have no useful intrinsic size for the optimizer: serve them as-is. */
export function isVectorImage(src: string) {
  return src.toLowerCase().split("?")[0].endsWith(".svg");
}
