"use client";

import { useMemo, useState } from "react";

import Breadcrumb from "@/components/layout/Breadcrumb";
import ProductGrid from "@/components/products/ProductGrid";
import { CONTENT_CONTAINER } from "@/lib/content-container";
import type { SaleCategory, SaleProduct } from "@/lib/sale-data";
import { cn } from "@/lib/utils";

type SaleListingProps = {
  products: SaleProduct[];
  categories: SaleCategory[];
};

export default function SaleListing({
  products,
  categories,
}: SaleListingProps) {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    null,
  );

  const categoryProducts = useMemo(
    () =>
      selectedCategoryId
        ? products.filter(
            (product) => product.categoryId === selectedCategoryId,
          )
        : products,
    [products, selectedCategoryId],
  );

  return (
    <section className={CONTENT_CONTAINER}>
      <h1 className="sr-only">Sale</h1>

      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Sale" }]} />

      <nav
        aria-label="Sale categories"
        className="mt-6 flex w-full gap-2 overflow-x-auto overscroll-x-contain pb-2"
      >
        <CategoryChip
          label="All"
          selected={selectedCategoryId === null}
          onClick={() => setSelectedCategoryId(null)}
        />
        {categories.map((category) => (
          <CategoryChip
            key={category.id}
            label={category.name}
            selected={selectedCategoryId === category.id}
            onClick={() => setSelectedCategoryId(category.id)}
          />
        ))}
      </nav>

      <div className="mt-6">
        {categoryProducts.length > 0 ? (
          <ProductGrid products={categoryProducts} />
        ) : (
          <p className="py-16 text-center text-sm text-black/50">
            {selectedCategoryId
              ? "No sale items in this category"
              : "No sale items available"}
          </p>
        )}
      </div>
    </section>
  );
}

function CategoryChip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "min-h-11 shrink-0 border px-4 text-xs tracking-[0.12em] uppercase transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum sm:px-5",
        selected
          ? "border-plum bg-plum text-white"
          : "border-black/15 bg-white text-black hover:border-plum hover:text-plum",
      )}
    >
      {label}
    </button>
  );
}
