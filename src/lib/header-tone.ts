/**
 * The adaptive header tone for the homepage category slider.
 *
 * The announcement bar, the hamburger, the logo and the search/login/cart icons
 * all share ONE colour over the slides, and that colour is decided by how light
 * the top of the active slide's image is. The rule lives here and nowhere else:
 *
 *   light image -> HEADER_TONE_ON_LIGHT_IMAGE
 *   dark image  -> HEADER_TONE_ON_DARK_IMAGE
 *
 * Flip the two constants to invert the rule everywhere at once.
 *
 * The measurement loads the image actually displayed for the current viewport,
 * draws it onto a small offscreen canvas with the same "cover" crop the slide
 * uses, averages the relative luminance of the strip that sits behind the bar
 * and the navbar (the top {@link HEADER_STRIP_HEIGHT_PX} of the viewport) and
 * caches the answer per image URL, so every image is measured at most once.
 * Anything that goes wrong - CORS, a load error, no 2D context - falls back to
 * {@link HEADER_TONE_FALLBACK} instead of throwing.
 */

import { scheduleIdle } from "@/lib/idle";

export const HEADER_TONE_ON_LIGHT_IMAGE = "white";
export const HEADER_TONE_ON_DARK_IMAGE = "black";

export type HeaderTone =
  | typeof HEADER_TONE_ON_LIGHT_IMAGE
  | typeof HEADER_TONE_ON_DARK_IMAGE;

/** Average relative luminance above this counts as a light image. */
export const HEADER_TONE_LIGHT_THRESHOLD = 0.5;

/** Colour-only switch when the active slide changes; no layout movement. */
export const HEADER_TONE_TRANSITION_MS = 300;

export const HEADER_TONE_TRANSITION = `color ${HEADER_TONE_TRANSITION_MS}ms ease-out`;

/** The strip of the slide behind the announcement bar and the navbar. */
export const HEADER_STRIP_HEIGHT_PX = 160;

/** Rendered on first paint, and whenever a measurement fails. */
export const HEADER_TONE_FALLBACK = HEADER_TONE_ON_LIGHT_IMAGE;

/**
 * The fixed-height chrome the `(site)` layout stacks above a page's content:
 * the announcement bar (`h-10`) and the solid navbar row (see `NAV_HEIGHT` in
 * the Navbar component: `h-12`, `md:h-[59px]`). The page shell subtracts this
 * from a full viewport to size its content, so header + content always fill the
 * first screen and the normal footer starts below it. These are the only source
 * of those numbers - keep them in step with the two components.
 */
export const ANNOUNCEMENT_BAR_HEIGHT_PX = 40;
export const NAVBAR_HEIGHT_PX = 48;
export const NAVBAR_HEIGHT_MD_PX = 59;

/**
 * Canvas width for the sample; the height follows the viewport aspect ratio.
 *
 * Kept deliberately tiny: the answer is an average luminance, so a 32px-wide
 * downscale samples the strip just as faithfully as a full-width one while
 * making the offscreen `drawImage` + `getImageData` a few hundred pixels
 * instead of hundreds of thousands. That is what keeps the measurement off the
 * critical path when it happens to run during a slide transition.
 */
const SAMPLE_WIDTH = 32;

/** One measurement per image URL, shared by every caller. */
const toneByImageUrl = new Map<string, Promise<HeaderTone>>();

export function measureHeaderTone(imageUrl: string): Promise<HeaderTone> {
  const cached = toneByImageUrl.get(imageUrl);
  if (cached) return cached;

  const pending = computeHeaderTone(imageUrl).catch(
    (): HeaderTone => HEADER_TONE_FALLBACK,
  );
  toneByImageUrl.set(imageUrl, pending);
  return pending;
}

/**
 * Warms the tone cache for every slide image, one at a time, while the browser
 * is idle. By the time the shopper reaches a slide its tone is already cached,
 * so changing slides only reads a resolved value instead of decoding an image
 * and reading canvas pixels on the main thread mid-transition.
 *
 * The returned function cancels any remaining work (call it on unmount).
 */
export function prefetchHeaderTones(
  imageUrls: readonly (string | null | undefined)[],
): () => void {
  const queue = Array.from(
    new Set(
      imageUrls.filter(
        (url): url is string => typeof url === "string" && url.length > 0,
      ),
    ),
  );

  let cancelled = false;
  let next = 0;

  const runNext = () => {
    if (cancelled || next >= queue.length) return;

    void measureHeaderTone(queue[next++]).finally(() => {
      if (!cancelled) scheduleIdle(runNext);
    });
  };

  scheduleIdle(runNext);
  return () => {
    cancelled = true;
  };
}

async function computeHeaderTone(imageUrl: string): Promise<HeaderTone> {
  const image = await loadImage(imageUrl);

  // `load` can fire before the pixels are ready to paint; drawing at that
  // moment would sample an empty canvas (every channel 0 => "dark image").
  // `decode()` guarantees a real bitmap before the canvas read.
  try {
    await image.decode();
  } catch {
    throw new Error(`Slide image could not be decoded: ${imageUrl}`);
  }

  if (image.naturalWidth === 0 || image.naturalHeight === 0) {
    throw new Error("Slide image has no intrinsic size");
  }

  const luminance = sampleHeaderStripLuminance(image);

  return luminance > HEADER_TONE_LIGHT_THRESHOLD
    ? HEADER_TONE_ON_LIGHT_IMAGE
    : HEADER_TONE_ON_DARK_IMAGE;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Slide image failed to load: ${src}`));
    image.src = src;
  });
}

function sampleHeaderStripLuminance(image: HTMLImageElement): number {
  const viewportWidth = Math.max(1, window.innerWidth || 1);
  const viewportHeight = Math.max(1, window.innerHeight || 1);

  const canvasWidth = Math.max(1, Math.min(SAMPLE_WIDTH, viewportWidth));
  const canvasHeight = Math.max(
    1,
    Math.round((canvasWidth * viewportHeight) / viewportWidth),
  );

  const canvas = document.createElement("canvas");
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;

  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Canvas 2D context unavailable");

  // Same crop the slide renders with: fill the viewport-shaped box and cut off
  // whatever overflows, centred on both axes.
  const scale = Math.max(
    canvasWidth / image.naturalWidth,
    canvasHeight / image.naturalHeight,
  );
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;

  context.drawImage(
    image,
    (canvasWidth - drawWidth) / 2,
    (canvasHeight - drawHeight) / 2,
    drawWidth,
    drawHeight,
  );

  const stripHeight = Math.max(
    1,
    Math.min(
      canvasHeight,
      Math.round((canvasHeight * HEADER_STRIP_HEIGHT_PX) / viewportHeight),
    ),
  );

  // Throws SecurityError if a remote host served the image without CORS.
  const { data } = context.getImageData(0, 0, canvasWidth, stripHeight);

  let total = 0;
  let pixels = 0;

  for (let i = 0; i < data.length; i += 4) {
    total += relativeLuminance(data[i] / 255, data[i + 1] / 255, data[i + 2] / 255);
    pixels += 1;
  }

  if (pixels === 0) throw new Error("Header strip contained no pixels");

  return total / pixels;
}

/** WCAG relative luminance of one sRGB colour, channels in 0..1. */
function relativeLuminance(red: number, green: number, blue: number): number {
  const toLinear = (channel: number) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;

  return (
    0.2126 * toLinear(red) +
    0.7152 * toLinear(green) +
    0.0722 * toLinear(blue)
  );
}
