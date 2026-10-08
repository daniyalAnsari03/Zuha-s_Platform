"use client";

import Image, { type ImageProps } from "next/image";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

type PickImageProps = Pick<
  ImageProps,
  | "src"
  | "alt"
  | "sizes"
  | "quality"
  | "priority"
  | "loading"
  | "fetchPriority"
  | "unoptimized"
>;

export type FadeInImageProps = PickImageProps & {
  /** Classes for the `next/image` itself, e.g. `object-cover`. */
  className?: string;
  /** Classes for the positioned placeholder wrapper. */
  wrapperClassName?: string;
};

/**
 * A storefront `next/image` that fades from transparent to opaque (300ms) once
 * the picture has decoded, over a light neutral placeholder so there is never a
 * white flash. It wraps the image in an `absolute inset-0` placeholder, which is
 * exactly how the storefront already positions every image (each parent is a
 * `relative` box), so it adds no layout shift.
 *
 * `priority` images (the first homepage slide, the first product image) skip the
 * fade entirely so the largest contentful paint is not delayed. An image that
 * was already in the browser cache before hydration is detected with
 * `img.complete`, so it can never stay invisible. Tiny icons do not use this.
 */
export default function FadeInImage({
  src,
  alt,
  sizes,
  quality,
  priority = false,
  loading,
  fetchPriority,
  unoptimized,
  className,
  wrapperClassName,
}: FadeInImageProps) {
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const [loaded, setLoaded] = useState(false);
  const visible = priority || loaded;

  // A cached image can be `complete` before React ever attaches its `onLoad`,
  // in which case that event never fires for it. Checking here catches it.
  useEffect(() => {
    const image = wrapperRef.current?.querySelector("img");
    if (image?.complete || (image?.naturalWidth ?? 0) > 0) setLoaded(true);
  }, []);

  return (
    <span
      ref={wrapperRef}
      className={cn(
        "absolute inset-0 block bg-black/5",
        wrapperClassName,
      )}
    >
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        quality={quality}
        priority={priority}
        loading={loading}
        fetchPriority={fetchPriority}
        unoptimized={unoptimized}
        onLoad={() => setLoaded(true)}
        className={cn(
          "transition-opacity duration-300 ease-[var(--motion-ease)]",
          visible ? "opacity-100" : "opacity-0",
          className,
        )}
      />
    </span>
  );
}