"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

import { CloseIcon } from "@/components/icons";
import ProductDetailContent, {
  type ProductDetailData,
} from "@/components/products/ProductDetailContent";
import { getQuickViewProduct } from "@/lib/quick-view";
import { modalBackdropVariant, modalVariant } from "@/lib/motion";

type ProductQuickViewProps = {
  product: ProductDetailData | null;
  isOpen: boolean;
  onClose: () => void;
};

export default function ProductQuickView({
  product,
  isOpen,
  onClose,
}: ProductQuickViewProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const [fullProduct, setFullProduct] = useState<ProductDetailData | null>(null);
  const [errorSlug, setErrorSlug] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !product) return;

    let active = true;
    const slug = product.slug;

    void getQuickViewProduct(slug)
      .then((loaded) => {
        if (!active) return;
        if (loaded) {
          setFullProduct(loaded);
          setErrorSlug(null);
        } else {
          setFullProduct(null);
          setErrorSlug(slug);
        }
      })
      .catch(() => {
        // A transient Supabase error must not leave the modal stuck loading.
        if (!active) return;
        setFullProduct(null);
        setErrorSlug(slug);
      });

    return () => {
      active = false;
    };
  }, [isOpen, product]);

  const ready = fullProduct?.slug === product?.slug;
  const failed = errorSlug === product?.slug && !ready;

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, onClose]);

  const handleOverlayClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === overlayRef.current) {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && product ? (
        <motion.div
          variants={modalBackdropVariant}
          initial="hidden"
          animate="show"
          exit="exit"
          className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/60 p-3 sm:p-4"
          ref={overlayRef}
          onClick={handleOverlayClick}
        >
          <motion.div
            variants={modalVariant}
            initial="hidden"
            animate="show"
            exit="exit"
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={fullProduct?.name ?? product?.name ?? "Product quick view"}
            className="relative flex max-h-[90dvh] w-full max-w-6xl flex-col bg-white p-4 sm:p-6 md:p-8"
          >
            {ready && fullProduct ? (
              <ProductDetailContent
                product={fullProduct}
                onClose={onClose}
                showCloseButton
                isModal
              />
            ) : (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close quick view"
                  className="absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center border border-black/10 bg-white/95 text-black transition-colors hover:text-plum focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum"
                >
                  <CloseIcon width={18} height={18} />
                </button>

                {failed ? (
                  <div className="flex min-h-[50vh] w-full flex-col items-center justify-center gap-4">
                    <span className="text-sm text-black/70">
                      Couldn&rsquo;t load this product.
                    </span>
                    <button
                      type="button"
                      onClick={onClose}
                      className="border border-black/15 px-6 py-2.5 text-sm text-black transition-colors hover:border-plum hover:text-plum focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum"
                    >
                      Close
                    </button>
                  </div>
                ) : (
                  <div className="flex min-h-[50vh] w-full items-center justify-center">
                    <span className="text-xs uppercase tracking-[0.2em] text-black/40">
                      Loading...
                    </span>
                  </div>
                )}
              </>
            )}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}