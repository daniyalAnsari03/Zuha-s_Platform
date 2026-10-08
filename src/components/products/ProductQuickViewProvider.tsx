"use client";

import dynamic from "next/dynamic";
import { createContext, useContext, useState } from "react";

import { type ProductDetailData } from "@/components/products/ProductDetailContent";

/**
 * The quick-view modal is opened from a card click, never rendered in the
 * page's HTML, so its chunk (the modal plus the full detail layout it reuses)
 * is split out of every listing bundle and fetched alongside them.
 */
const ProductQuickView = dynamic(
  () => import("@/components/products/ProductQuickView"),
  { ssr: false },
);


type QuickViewContextValue = {
  openQuickView: (product: ProductDetailData) => void;
  closeQuickView: () => void;
};

const QuickViewContext = createContext<QuickViewContextValue | null>(null);

export function QuickViewProvider({ children }: { children: React.ReactNode }) {
  const [product, setProduct] = useState<ProductDetailData | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const openQuickView = (productData: ProductDetailData) => {
    setProduct(productData);
    setIsOpen(true);
  };

  const closeQuickView = () => {
    setIsOpen(false);
  };

  return (
    <QuickViewContext.Provider value={{ openQuickView, closeQuickView }}>
      {children}
      <ProductQuickView
        product={product}
        isOpen={isOpen}
        onClose={closeQuickView}
      />
    </QuickViewContext.Provider>
  );
}

export function useQuickView() {
  const context = useContext(QuickViewContext);
  if (!context) {
    throw new Error("useQuickView must be used within QuickViewProvider");
  }
  return context;
}
