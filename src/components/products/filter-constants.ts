export type SortOption = "newest" | "price-asc" | "price-desc";

export const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
];

export type ProductFilters = {
  /** Effective (discount) price bounds; null means unbounded on that end. */
  minPrice: number | null;
  maxPrice: number | null;
  sizes: string[];
  colors: string[];
};

export const EMPTY_FILTERS: ProductFilters = {
  minPrice: null,
  maxPrice: null,
  sizes: [],
  colors: [],
};
