"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

import { CloseIcon } from "@/components/icons";
import {
  EMPTY_FILTERS,
  type ProductFilters,
} from "@/components/products/filter-constants";
import { backdropVariant, drawerLeftVariant } from "@/lib/motion";
import { cn } from "@/lib/utils";

export {
  EMPTY_FILTERS,
  SORT_OPTIONS,
  type ProductFilters,
  type SortOption,
} from "@/components/products/filter-constants";

type FilterPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Filters currently applied to the grid; the drawer edits a draft of these. */
  filters: ProductFilters;
  onChange: (filters: ProductFilters) => void;
  /** Unique options built from every product in the listing. */
  sizeOptions: string[];
  colorOptions: string[];
  /** Highest effective price in the listing, used as the range input max. */
  priceCeiling: number;
};

/**
 * Price / size / colour filters as a drawer that slides in from the left over
 * a dimmed backdrop. Full width on mobile, ~380px from tablet up.
 *
 * The grid is full width now, so the filters are no longer a permanent sidebar;
 * they open on demand from the "Filter" button in the toolbar. The filter maths,
 * the option parsing and the `ProductFilters` shape are unchanged - only the
 * shell is new.
 *
 * This component owns the open state plumbing (scroll lock, Escape, focus);
 * the panel itself lives in `FilterDrawer` below.
 */
export default function FilterPanel({
  open,
  onOpenChange,
  filters,
  onChange,
  sizeOptions,
  colorOptions,
  priceCeiling,
}: FilterPanelProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  // Move focus into the drawer on open and hand it back to the trigger on close.
  useEffect(() => {
    if (!open) {
      restoreFocusRef.current?.focus();
      restoreFocusRef.current = null;
      return;
    }

    restoreFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    // `FilterDrawer` mounts in this same commit, so reach for its close button
    // by id-free ref handoff on the next frame.
    const frame = requestAnimationFrame(() => closeButtonRef.current?.focus());

    return () => cancelAnimationFrame(frame);
  }, [open]);

  // Lock the page behind the drawer so the grid cannot scroll under it.
  // `html { scrollbar-gutter: stable }` already keeps the scrollbar's width
  // reserved, so the lock itself never shifts the layout - no extra padding.
  useEffect(() => {
    if (!open) return;

    const { body } = document;
    const previousOverflow = body.style.overflow;
    body.style.overflow = "hidden";

    return () => {
      body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, close]);

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            key="filter-backdrop"
            onClick={close}
            className="fixed inset-0 z-50 bg-black/45"
            variants={backdropVariant}
            initial="hidden"
            animate="show"
            exit="exit"
          />

          <FilterDrawer
            key="filter-drawer"
            closeButtonRef={closeButtonRef}
            filters={filters}
            onChange={onChange}
            onClose={close}
            sizeOptions={sizeOptions}
            colorOptions={colorOptions}
            priceCeiling={priceCeiling}
          />
        </>
      ) : null}
    </AnimatePresence>
  );
}

type FilterDrawerProps = {
  closeButtonRef: RefObject<HTMLButtonElement | null>;
  filters: ProductFilters;
  onChange: (filters: ProductFilters) => void;
  onClose: () => void;
  sizeOptions: string[];
  colorOptions: string[];
  priceCeiling: number;
};

/**
 * The drawer panel.
 *
 * Remounts on every open, so the draft simply starts from the filters the grid
 * is already showing - no syncing effect needed. Only "Apply" commits the draft,
 * so closing by the backdrop, the close button or Escape leaves the grid
 * untouched.
 */
function FilterDrawer({
  closeButtonRef,
  filters,
  onChange,
  onClose,
  sizeOptions,
  colorOptions,
  priceCeiling,
}: FilterDrawerProps) {
  const [draft, setDraft] = useState<ProductFilters>(filters);

  const setDraftOption = (key: "sizes" | "colors", option: string) => {
    setDraft((current) => {
      const selected = current[key];
      const next = selected.some(
        (value) => value.toLowerCase() === option.toLowerCase(),
      )
        ? selected.filter((value) => value !== option)
        : [...selected, option];

      return { ...current, [key]: next };
    });
  };

  const draftIsEmpty =
    draft.minPrice === null &&
    draft.maxPrice === null &&
    draft.sizes.length === 0 &&
    draft.colors.length === 0;

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label="Filters"
      className="fixed inset-y-0 left-0 z-50 flex w-full flex-col bg-white shadow-[0_0_48px_rgba(0,0,0,0.18)] sm:w-[380px]"
      variants={drawerLeftVariant}
      initial="hidden"
      animate="show"
      exit="exit"
    >
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-black/10 px-4 sm:h-20 sm:px-6">
        <h2 className="text-sm font-semibold tracking-[0.2em] uppercase">
          Filter
        </h2>

        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          aria-label="Close filters"
          className="flex h-11 w-11 shrink-0 items-center justify-center text-black transition-colors hover:text-plum focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum"
        >
          <CloseIcon />
        </button>
      </header>

      <div className="flex flex-1 flex-col gap-7 overflow-y-auto overscroll-contain px-4 py-6 sm:px-6">
        <fieldset className="border-0 p-0">
          <legend className="mb-3 text-xs font-semibold tracking-[0.2em] uppercase">
            Price
          </legend>

          <div className="flex items-center gap-2">
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={priceCeiling}
              placeholder="Min"
              aria-label="Minimum price"
              value={draft.minPrice ?? ""}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  minPrice: parsePriceInput(event.target.value),
                }))
              }
              className={INPUT_CLASS}
            />

            <span aria-hidden="true" className="text-black/40">
              &ndash;
            </span>

            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={priceCeiling}
              placeholder="Max"
              aria-label="Maximum price"
              value={draft.maxPrice ?? ""}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  maxPrice: parsePriceInput(event.target.value),
                }))
              }
              className={INPUT_CLASS}
            />
          </div>
        </fieldset>

        {sizeOptions.length > 0 ? (
          <fieldset className="border-0 p-0">
            <legend className="mb-3 text-xs font-semibold tracking-[0.2em] uppercase">
              Size
            </legend>

            <div className="flex flex-wrap gap-2">
              {sizeOptions.map((size) => (
                <OptionChip
                  key={size}
                  label={size}
                  selected={draft.sizes.includes(size)}
                  onToggle={() => setDraftOption("sizes", size)}
                />
              ))}
            </div>
          </fieldset>
        ) : null}

        {colorOptions.length > 0 ? (
          <fieldset className="border-0 p-0">
            <legend className="mb-3 text-xs font-semibold tracking-[0.2em] uppercase">
              Color
            </legend>

            <div className="flex flex-wrap gap-2">
              {colorOptions.map((color) => (
                <OptionChip
                  key={color}
                  label={color}
                  selected={draft.colors.includes(color)}
                  onToggle={() => setDraftOption("colors", color)}
                />
              ))}
            </div>
          </fieldset>
        ) : null}
      </div>

      <footer className="flex shrink-0 items-center gap-3 border-t border-black/10 px-4 py-4 sm:px-6">
        <button
          type="button"
          onClick={() => setDraft(EMPTY_FILTERS)}
          disabled={draftIsEmpty}
          className="min-h-11 flex-1 text-xs tracking-[0.16em] text-black/60 uppercase transition-colors hover:text-plum focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum disabled:pointer-events-none disabled:text-black/25"
        >
          Clear all
        </button>

        <button
          type="button"
          onClick={() => {
            onChange(draft);
            onClose();
          }}
          className="min-h-11 flex-1 bg-plum px-4 text-xs tracking-[0.16em] text-white uppercase transition-colors hover:bg-plum-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum"
        >
          Apply
        </button>
      </footer>
    </motion.div>
  );
}

type OptionChipProps = {
  label: string;
  selected: boolean;
  onToggle: () => void;
};

function OptionChip({ label, selected, onToggle }: OptionChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onToggle}
      className={cn(OPTION_BASE, selected && OPTION_SELECTED)}
    >
      {label}
    </button>
  );
}

const INPUT_CLASS =
  "min-h-11 w-full min-w-0 border border-black/15 px-3 py-2 text-sm focus-visible:border-plum focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-plum";

const OPTION_BASE =
  "min-h-11 border border-black/15 px-4 py-2 text-sm transition-colors hover:border-plum hover:text-plum focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum";

const OPTION_SELECTED = "border-plum bg-plum text-white hover:text-white";

/** Empty or negative input means "no bound", not zero. */
function parsePriceInput(value: string): number | null {
  if (value.trim() === "") return null;

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;

  return parsed;
}