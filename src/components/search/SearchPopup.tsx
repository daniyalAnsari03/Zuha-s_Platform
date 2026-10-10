"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import Price from "@/components/currency/Price";
import { CloseIcon, SearchIcon } from "@/components/icons";
import FadeInImage from "@/components/ui/FadeInImage";
import NavbarPopover from "@/components/layout/NavbarPopover";
import { IMAGE_QUALITY } from "@/lib/images";
import {
  MOTION_DURATION,
  TRANSITION_POPUP_EXIT,
  TRANSITION_POPUP_FADE,
  fadeUpVariant,
  staggerContainer,
} from "@/lib/motion";
import { discountPercentFor, effectivePrice } from "@/lib/products";
import {
  loadCategoryIndex,
  matchCategories,
  searchProducts,
  type SearchCategoryHit,
  type SearchProductHit,
} from "@/lib/search-data";

type SearchPopupProps = {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
};

/** Long enough to skip the intermediate states of typing, short enough to feel live. */
const DEBOUNCE_MS = 250;

/** Matches the thumbnail box: w-14 below sm, w-16 from sm up. */
const RESULT_SIZES = "(max-width: 639px) 3.5rem, 4rem";

/** Products already fetched, tagged with the term they were fetched for. */
type Loaded = {
  term: string;
  products: SearchProductHit[];
};

const NO_PRODUCTS: SearchProductHit[] = [];

/**
 * Search as a popup below the navbar, not a page: a single input that reports
 * matching products and matching categories (top-level and sub-category) as the
 * customer types.
 *
 * The input is debounced, so one request runs per settled keystroke instead of
 * one per character, and the category index is fetched once when the popup opens
 * and matched in memory afterwards. Results are capped; the full catalog stays
 * browsable through the menu and the listing pages.
 */
export default function SearchPopup({ open, onClose, anchorRef }: SearchPopupProps) {
  const [query, setQuery] = useState("");
  const [categoryIndex, setCategoryIndex] = useState<SearchCategoryHit[]>([]);
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  // Load the (small) category list once per opening, so category hits cost
  // nothing at all while typing.
  useEffect(() => {
    if (!open) return;

    let active = true;
    void loadCategoryIndex()
      .then((index) => {
        if (active) setCategoryIndex(index);
      })
      .catch(() => {
        // A transient failure just leaves the category matches empty.
        if (active) setCategoryIndex([]);
      });

    return () => {
      active = false;
    };
  }, [open]);

  const term = query.trim();

  // Debounced product lookup. Everything else on screen is derived from the term
  // and from whether the last lookup still matches it, so there is no moment
  // where products and categories disagree about what is being searched.
  useEffect(() => {
    if (term === "") return;

    let active = true;
    const timer = window.setTimeout(() => {
      void searchProducts(term)
        .then((products) => {
          if (active) setLoaded({ term, products });
        })
        .catch(() => {
          // Never leave the popup frozen on "Searching..." for a transient
          // error; an empty result is honest and the retry is just a keystroke.
          if (active) setLoaded({ term, products: [] });
        });
    }, DEBOUNCE_MS);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [term]);

  // Focus follows the field being mounted, which is exactly when the panel
  // appears - an effect keyed on `open` would run a frame too early.
  const inputRef = useCallback((node: HTMLInputElement | null) => {
    if (node) node.focus();
  }, []);

  const categories = useMemo(
    () => matchCategories(term, categoryIndex),
    [term, categoryIndex],
  );
  const products = loaded && loaded.term === term ? loaded.products : NO_PRODUCTS;
  const searching = term !== "" && loaded?.term !== term;
  const hasResults = products.length > 0 || categories.length > 0;

  return (
    <NavbarPopover open={open} onClose={onClose} anchorRef={anchorRef} label="Search">
      <div className="flex items-center gap-3 border-b border-black/10 px-4 sm:px-6">
        <SearchIcon className="shrink-0 text-black/40" width={20} height={20} />

        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search products and categories"
          aria-label="Search products and categories"
          autoComplete="off"
          className="min-h-14 w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-black/40 sm:text-base"
        />

        <button
          type="button"
          onClick={onClose}
          aria-label="Close search"
          className="flex h-11 w-11 shrink-0 items-center justify-center text-black transition-colors hover:text-plum focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum"
        >
          <CloseIcon />
        </button>
      </div>

      <AnimatePresence initial={false} mode="wait">
        {term === "" ? (
          <motion.p
            key="hint"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={TRANSITION_POPUP_FADE}
            className="px-4 py-6 text-sm text-black/50 sm:px-6"
          >
            Start typing to find a product or a category.
          </motion.p>
        ) : searching && !hasResults ? (
          <motion.p
            key="searching"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={TRANSITION_POPUP_FADE}
            className="px-4 py-6 text-sm text-black/50 sm:px-6"
          >
            Searching...
          </motion.p>
        ) : !hasResults ? (
          <motion.p
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={TRANSITION_POPUP_FADE}
            className="px-4 py-6 text-sm text-black/50 sm:px-6"
          >
            No results for &ldquo;{term}&rdquo;.
          </motion.p>
        ) : (
          <motion.div
            key="results"
            variants={staggerContainer(MOTION_DURATION.popupItemStagger)}
            initial="hidden"
            animate="show"
            exit={{ opacity: 0, transition: TRANSITION_POPUP_EXIT }}
          >
            {categories.length > 0 ? (
              <section aria-label="Categories" className="border-b border-black/10 py-2">
                <ul>
                  {categories.map((category) => (
                    <motion.li key={category.id} variants={fadeUpVariant}>
                      <Link
                        href={category.href}
                        onClick={onClose}
                        className="flex min-h-11 items-center justify-between gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-black/5 hover:text-plum focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum sm:px-6"
                      >
                        <span className="truncate">{category.name}</span>
                        <span className="shrink-0 text-[10px] tracking-[0.16em] text-black/40 uppercase">
                          {category.kind === "category" ? "Category" : "Sub-category"}
                        </span>
                      </Link>
                    </motion.li>
                  ))}
                </ul>
              </section>
            ) : null}

            {products.length > 0 ? (
              <section aria-label="Products" className="py-2">
                <ul>
                  {products.map((product) => (
                    <motion.li key={product.id} variants={fadeUpVariant}>
                      <Link
                        href={`/product/${product.slug}`}
                        onClick={onClose}
                        className="flex min-h-11 items-center gap-3 px-4 py-2.5 transition-colors hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum sm:px-6 sm:gap-4"
                      >
                        <span className="relative h-[3.375rem] w-14 shrink-0 overflow-hidden bg-black/5 sm:h-[3.9375rem] sm:w-16">
                          {product.imageUrl ? (
                            <FadeInImage
                              src={product.imageUrl}
                              alt=""
                              sizes={RESULT_SIZES}
                              quality={IMAGE_QUALITY}
                              className="object-cover"
                            />
                          ) : (
                            <span className="flex h-full w-full items-center justify-center text-[10px] tracking-[0.2em] text-black/30 uppercase">
                              No image
                            </span>
                          )}
                        </span>

                        <span className="min-w-0 flex-1 truncate text-sm">
                          {product.name}
                        </span>

                        <span className="shrink-0 text-sm">
                          {discountPercentFor(product.price, product.discountPrice) !== null ? (
                            <span className="flex items-baseline gap-2">
                              <Price
                                amount={product.price}
                                className="text-xs text-black/40 line-through"
                              />
                              <Price
                                amount={effectivePrice(product)}
                                className="font-medium text-plum"
                              />
                              <span className="bg-plum px-1.5 py-0.5 text-[10px] font-medium tracking-[0.06em] text-white uppercase">
                                {discountPercentFor(product.price, product.discountPrice)}% off
                              </span>
                            </span>
                          ) : (
                            <Price amount={product.price} />
                          )}
                        </span>
                      </Link>
                    </motion.li>
                  ))}
                </ul>
              </section>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>
    </NavbarPopover>
  );
}