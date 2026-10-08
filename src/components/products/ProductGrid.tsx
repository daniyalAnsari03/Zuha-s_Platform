"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";

import { ChevronDownIcon, FunnelIcon } from "@/components/icons";
import ProductCard from "@/components/products/ProductCard";
import {
  EMPTY_FILTERS,
  SORT_OPTIONS,
  type ProductFilters,
  type SortOption,
} from "@/components/products/filter-constants";
import { effectivePrice, type ProductListItem } from "@/lib/products";

/**
 * The drawer is a popup the customer opens from the Filter button, so its code
 * (and the framer-motion drawer it needs) is split out of this route's bundle
 * and only fetched when the listing itself hydrates. It renders nothing while
 * closed, so deferring it changes no HTML.
 */
const FilterPanel = dynamic(
  () => import("@/components/products/FilterPanel"),
  { ssr: false },
);

type ProductGridProps = {
  products: ProductListItem[];
};

/**
 * Client-side listing: filters and sorts the products already loaded for the
 * route, behind one editorial toolbar row.
 *
 * Layout top to bottom: a "Filter" button on the left that opens the filter
 * drawer, and on the right the item count plus the sort dropdown. The grid
 * below uses the full container width - there is no permanent filter sidebar.
 * Grid is 2 per row on mobile, 3 on tablet, 4 on desktop.
 */
export default function ProductGrid({ products }: ProductGridProps) {
  const [filters, setFilters] = useState<ProductFilters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<SortOption>("newest");
  const [filtersOpen, setFiltersOpen] = useState(false);

  /** Unique size/colour options across every product in this listing. */
  const { sizeOptions, colorOptions, priceCeiling } = useMemo(() => {
    const sizes: string[] = [];
    const colors: string[] = [];
    let ceiling = 0;

    for (const product of products) {
      for (const size of product.sizes) {
        if (!sizes.some((value) => value.toLowerCase() === size.toLowerCase())) {
          sizes.push(size);
        }
      }

      for (const color of product.colors) {
        if (
          !colors.some((value) => value.toLowerCase() === color.toLowerCase())
        ) {
          colors.push(color);
        }
      }

      ceiling = Math.max(ceiling, effectivePrice(product));
    }

    return { sizeOptions: sizes, colorOptions: colors, priceCeiling: ceiling };
  }, [products]);

  const visible = useMemo(() => {
    const filtered = products.filter((product) => {
      const price = effectivePrice(product);

      if (filters.minPrice !== null && price < filters.minPrice) return false;
      if (filters.maxPrice !== null && price > filters.maxPrice) return false;

      // Size/colour are free-text lists; matching ignores case and padding.
      if (
        filters.sizes.length > 0 &&
        !filters.sizes.every((size) => product.sizes.includes(size))
      ) {
        return false;
      }

      if (
        filters.colors.length > 0 &&
        !filters.colors.every((color) => product.colors.includes(color))
      ) {
        return false;
      }

      return true;
    });

    const sorted = [...filtered];

    switch (sort) {
      case "price-asc":
        sorted.sort(
          (a, b) => effectivePrice(a) - effectivePrice(b) || a.name.localeCompare(b.name),
        );
        break;
      case "price-desc":
        sorted.sort(
          (a, b) => effectivePrice(b) - effectivePrice(a) || a.name.localeCompare(b.name),
        );
        break;
      case "newest":
        sorted.sort(
          (a, b) =>
            Date.parse(b.createdAt) - Date.parse(a.createdAt) ||
            a.name.localeCompare(b.name),
        );
        break;
    }

    return sorted;
  }, [products, filters, sort]);

  const activeFilterCount =
    (filters.minPrice !== null ? 1 : 0) +
    (filters.maxPrice !== null ? 1 : 0) +
    filters.sizes.length +
    filters.colors.length;

  return (
    <div>
      <div className="mb-8 flex items-center justify-between gap-3 lg:mb-10">
        <button
          type="button"
          onClick={() => setFiltersOpen(true)}
          aria-expanded={filtersOpen}
          className="inline-flex min-h-11 shrink-0 items-center gap-2 border border-black/15 px-3 text-[11px] tracking-[0.16em] text-black uppercase transition-colors hover:border-plum hover:text-plum focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum sm:px-4 sm:text-xs"
        >
          <FunnelIcon width={16} height={16} />
          Filter

          {activeFilterCount > 0 ? (
            <span className="flex h-5 min-w-5 items-center justify-center bg-plum px-1 text-[10px] tracking-normal text-white">
              {activeFilterCount}
            </span>
          ) : null}
        </button>

        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <p className="shrink-0 text-[11px] tracking-[0.16em] whitespace-nowrap text-black/50 uppercase sm:text-xs">
            {visible.length} Items
          </p>

          <span aria-hidden="true" className="text-[11px] text-black/30 sm:text-xs">
            |
          </span>

          {/*
            No visible "Sort By:" label - the toolbar reads as a count, a
            divider and the dropdown. The control still has an accessible name,
            supplied by aria-label on the select itself.
          */}
          <span className="relative min-w-0">
            <select
              id="product-sort"
              aria-label="Sort by"
              value={sort}
              onChange={(event) => setSort(event.target.value as SortOption)}
              className="h-11 w-full min-w-0 appearance-none truncate border border-black/15 bg-white pr-8 pl-3 text-[11px] transition-colors hover:border-plum focus-visible:border-plum focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-plum sm:w-auto sm:min-w-[11rem] sm:text-xs"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <ChevronDownIcon
              width={16}
              height={16}
              className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-black/50"
            />
          </span>
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="py-16 text-center text-sm text-black/50">
          No products match these filters.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 sm:gap-y-10 md:grid-cols-3 md:gap-x-6 lg:grid-cols-4 lg:gap-x-8 lg:gap-y-12 xl:gap-x-9">
          {visible.map((product, index) => (
            <ProductCard
              key={product.id}
              product={product}
              priority={index === 0}
            />
          ))}
        </div>
      )}

      <FilterPanel
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        filters={filters}
        onChange={setFilters}
        sizeOptions={sizeOptions}
        colorOptions={colorOptions}
        priceCeiling={priceCeiling}
      />
    </div>
  );
}