"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
  ZoomIcon,
} from "@/components/icons";
import BodyPortal from "@/components/layout/BodyPortal";
import { IMAGE_QUALITY, IMAGE_QUALITY_MAX } from "@/lib/images";
import { TRANSITION_FAST } from "@/lib/motion";
import { cn } from "@/lib/utils";

type ProductImageViewerProps = {
  /** Every gallery image, in slider order. */
  images: string[];
  productName: string;
  /** The slide the slider is on; the viewer starts here and reports back. */
  index: number;
  onIndexChange: (index: number) => void;
  isOpen: boolean;
  onClose: () => void;
};

const TOOLBAR_BUTTON =
  "flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

const ARROW_BUTTON =
  "absolute top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white transition-colors hover:bg-black/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

/** How far a finger has to travel before a swipe counts as a swipe. */
const SWIPE_THRESHOLD_PX = 48;

/**
 * Full-screen gallery viewer for the mobile/tablet product slider.
 *
 * It is portalled to `<body>` so it sits above the quick view modal it is
 * usually opened from, and it owns nothing but itself: the active image lives
 * in the slider (the parent), so closing puts the slider exactly where the
 * customer left it.
 *
 * One image: no arrows, no thumbnails, no swipe — just the picture, zoom and
 * close.
 */
export default function ProductImageViewer({
  images,
  productName,
  index,
  onIndexChange,
  isOpen,
  onClose,
}: ProductImageViewerProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const panLayerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const activeThumbRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  const indexRef = useRef(index);
  const countRef = useRef(images.length);
  const onIndexChangeRef = useRef(onIndexChange);
  const pushedEntryRef = useRef(false);
  const closingRef = useRef(false);
  const touchStartXRef = useRef<number | null>(null);
  const panStartRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  const [zoomed, setZoomed] = useState(false);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [shownIndex, setShownIndex] = useState(index);

  const reduceMotion = useReducedMotion();

  const count = images.length;
  const hasMany = count > 1;

  /*
   * Zoom and pan belong to one picture only, so stepping to another slide
   * clears both while rendering (React's "adjust state when a prop changes"
   * pattern) — the new picture is on screen already, no second pass needed.
   */
  if (shownIndex !== index) {
    setShownIndex(index);
    setZoomed(false);
    setPan({ x: 0, y: 0 });
  }

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    indexRef.current = index;
    countRef.current = images.length;
    onIndexChangeRef.current = onIndexChange;
  });

  /**
   * Close without ever leaving a pushed history entry behind. When we own the
   * current entry, closing means going back (which also handles the browser
   * Back gesture); otherwise the parent is told directly.
   */
  const requestClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;

    if (window.history.state?.zuhaImageViewer) {
      window.history.back();
      return;
    }

    onCloseRef.current();
  }, []);

  // The entry is pushed once per open/close cycle, so React's Strict Mode
  // double effect in development cannot stack two of them.
  useEffect(() => {
    if (!isOpen) pushedEntryRef.current = false;
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    closingRef.current = false;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    if (!pushedEntryRef.current) {
      pushedEntryRef.current = true;
      window.history.pushState(
        { ...(window.history.state ?? {}), zuhaImageViewer: true },
        "",
      );
    }

    const handlePopState = () => {
      closingRef.current = true;
      onCloseRef.current();
    };

    /*
     * Capture phase, so Escape closes this viewer first and never falls
     * through to the quick view modal underneath it.
     */
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        requestClose();
        return;
      }

      if (event.key === "ArrowLeft" && countRef.current > 1 && indexRef.current > 0) {
        event.preventDefault();
        onIndexChangeRef.current(indexRef.current - 1);
      }

      if (
        event.key === "ArrowRight" &&
        countRef.current > 1 &&
        indexRef.current < countRef.current - 1
      ) {
        event.preventDefault();
        onIndexChangeRef.current(indexRef.current + 1);
      }
    };

    window.addEventListener("popstate", handlePopState);
    document.addEventListener("keydown", handleKeyDown, true);
    containerRef.current?.focus();

    return () => {
      window.removeEventListener("popstate", handlePopState);
      document.removeEventListener("keydown", handleKeyDown, true);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, requestClose]);

  // Keep the active thumbnail in view inside its own strip.
  useEffect(() => {
    if (!isOpen || !hasMany) return;
    activeThumbRef.current?.scrollIntoView({
      block: "nearest",
      inline: "center",
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }, [isOpen, hasMany, index, reduceMotion]);

  const goTo = (nextIndex: number) => {
    const clamped = Math.min(Math.max(nextIndex, 0), count - 1);
    if (clamped !== index) onIndexChange(clamped);
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    touchStartXRef.current = event.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    const startX = touchStartXRef.current;
    touchStartXRef.current = null;

    if (startX === null || zoomed || !hasMany) return;

    const endX = event.changedTouches[0]?.clientX ?? startX;
    const distance = endX - startX;

    if (Math.abs(distance) < SWIPE_THRESHOLD_PX) return;
    goTo(distance < 0 ? index + 1 : index - 1);
  };

  /**
   * A dragged zoomed image stops at the edge of the stage: the clamp reads the
   * laid-out rectangles, so it stays correct whatever the image ratio is.
   */
  const clampPan = (
    origin: { x: number; y: number },
    next: { x: number; y: number },
  ) => {
    const stage = stageRef.current;
    const layer = panLayerRef.current;
    if (!stage || !layer) return next;

    const stageRect = stage.getBoundingClientRect();
    const layerRect = layer.getBoundingClientRect();
    const deltaX = next.x - origin.x;
    const deltaY = next.y - origin.y;

    let x = next.x;
    let y = next.y;

    const left = layerRect.left + deltaX;
    const right = layerRect.right + deltaX;
    const top = layerRect.top + deltaY;
    const bottom = layerRect.bottom + deltaY;

    if (left > stageRect.left) {
      x = next.x - (left - stageRect.left);
    } else if (right < stageRect.right) {
      x = next.x + (stageRect.right - right);
    }

    if (top > stageRect.top) {
      y = next.y - (top - stageRect.top);
    } else if (bottom < stageRect.bottom) {
      y = next.y + (stageRect.bottom - bottom);
    }

    return { x, y };
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!zoomed || panStartRef.current) return;

    const origin = { x: pan.x, y: pan.y };
    panStartRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: origin.x,
      originY: origin.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsPanning(true);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = panStartRef.current;
    if (!start || start.pointerId !== event.pointerId) return;

    setPan(
      clampPan(
        { x: start.originX, y: start.originY },
        {
          x: start.originX + (event.clientX - start.startX),
          y: start.originY + (event.clientY - start.startY),
        },
      ),
    );
  };

  const endPan = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = panStartRef.current;
    if (!start || start.pointerId !== event.pointerId) return;

    panStartRef.current = null;
    setIsPanning(false);

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <BodyPortal>
      <AnimatePresence>
        {isOpen && count > 0 ? (
          <motion.div
            key="product-image-viewer"
            ref={containerRef}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={reduceMotion ? { duration: 0 } : TRANSITION_FAST}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={
              hasMany
                ? `${productName} images, ${index + 1} of ${count}`
                : `${productName} image`
            }
            className="fixed inset-0 z-[70] flex flex-col bg-black/95 focus:outline-none"
          >
            <div
              ref={stageRef}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={endPan}
              onPointerCancel={endPan}
              style={{ touchAction: zoomed ? "none" : "auto" }}
              className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden"
            >
              <AnimatePresence initial={false}>
                <motion.div
                  key={index}
                  initial={{ opacity: 0, scale: reduceMotion ? 1 : 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={reduceMotion ? { duration: 0 } : TRANSITION_FAST}
                  className="absolute inset-0"
                >
                  <div
                    ref={panLayerRef}
                    className="absolute inset-0"
                    style={{
                      transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoomed ? 2 : 1})`,
                      transition: isPanning
                        ? "none"
                        : "transform 200ms var(--motion-ease)",
                    }}
                  >
                    <Image
                      src={images[index]}
                      alt={
                        index === 0
                          ? productName
                          : `${productName} ${index + 1}`
                      }
                      fill
                      sizes="100vw"
                      // This is the picture the customer zooms into - the only
                      // one rendered at full quality.
                      quality={IMAGE_QUALITY_MAX}
                      priority
                      className="object-contain"
                    />
                  </div>
                </motion.div>
              </AnimatePresence>

              <div className="absolute right-3 top-3 z-10 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setZoomed((current) => !current);
                    setPan({ x: 0, y: 0 });
                  }}
                  aria-pressed={zoomed}
                  aria-label={zoomed ? "Zoom out" : "Zoom in"}
                  className={TOOLBAR_BUTTON}
                >
                  <ZoomIcon width={20} height={20} />
                </button>

                <button
                  type="button"
                  onClick={requestClose}
                  aria-label="Close image viewer"
                  className={TOOLBAR_BUTTON}
                >
                  <CloseIcon width={20} height={20} />
                </button>
              </div>

              {hasMany && index > 0 ? (
                <button
                  type="button"
                  onClick={() => goTo(index - 1)}
                  aria-label="Previous image"
                  className={cn(ARROW_BUTTON, "left-3")}
                >
                  <ChevronLeftIcon width={22} height={22} />
                </button>
              ) : null}

              {hasMany && index < count - 1 ? (
                <button
                  type="button"
                  onClick={() => goTo(index + 1)}
                  aria-label="Next image"
                  className={cn(ARROW_BUTTON, "right-3")}
                >
                  <ChevronRightIcon width={22} height={22} />
                </button>
              ) : null}
            </div>

            {hasMany ? (
              <div className="flex w-full shrink-0 justify-center px-3 pb-4 pt-3">
                <div className="no-scrollbar flex max-w-full gap-2 overflow-x-auto">
                  {images.map((imageUrl, imageIndex) => (
                    <button
                      key={imageUrl}
                      ref={
                        imageIndex === index ? activeThumbRef : undefined
                      }
                      type="button"
                      onClick={() => goTo(imageIndex)}
                      aria-label={`View image ${imageIndex + 1}`}
                      aria-current={imageIndex === index}
                      className={cn(
                        "relative h-14 w-10 shrink-0 overflow-hidden border-2 transition-opacity focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
                        imageIndex === index
                          ? "border-white opacity-100"
                          : "border-white/30 opacity-60 hover:opacity-100",
                      )}
                    >
                      <Image
                        src={imageUrl}
                        alt=""
                        fill
                        sizes="40px"
                        quality={IMAGE_QUALITY}
                        loading="lazy"
                        className="object-cover"
                      />
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </BodyPortal>
  );
}
