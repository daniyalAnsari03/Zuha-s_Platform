"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
/* Admin list thumbnails are plain <img>, not next/image — see ImageUpload.tsx. */
/* eslint-disable @next/next/no-img-element */

import {
  ADMIN_INPUT_CLASS,
  ADMIN_PRIMARY_BUTTON_CLASS,
  AdminField,
} from "@/components/admin/admin-fields";
import { updateInventoryRow } from "@/lib/admin/inventory";
import type { AdminInventoryRow } from "@/lib/admin/queries";
import { isLowStock } from "@/lib/products";
import { cn } from "@/lib/utils";

/**
 * Inventory: one row per product, both numbers editable in place.
 *
 * One row saves at a time — that is all this screen is, and it keeps a mistake in
 * one product's stock from taking the rest of the table with it. The Save button
 * only activates once a value has actually changed, so a stray Enter or a click
 * cannot rewrite a row unnecessarily.
 *
 * The search is the Products screen's, unchanged: the same field, the same
 * `max-w-xs` width, the same "N of M" hint, and the same name-only match filtered
 * in the browser so typing stays instant. What it matches cannot change, so the
 * low-stock summary stays about every product rather than the filtered page.
 *
 * "Low stock" is the same rule the Dashboard home will use: at or below the
 * product's own threshold, from `isLowStock()` in `lib/products.ts`. One helper, so
 * the flag cannot mean two different things in two places.
 */

type RowValues = { stockQuantity: string; lowStockThreshold: string };

export default function InventoryManager({ rows, total, totalPages, currentPage }: {
  rows: AdminInventoryRow[];
  total: number;
  totalPages: number;
  currentPage: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");

  const matches = useMemo(() => {
    const needle = search.trim().toLowerCase();

    return needle
      ? rows.filter((row) => row.name.toLowerCase().includes(needle))
      : rows;
  }, [rows, search]);

  const lowStockCount = rows.filter(isLowStock).length;
  const [paging, startPageTransition] = useTransition();

  const setPage = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (page > 1) params.set("page", String(page));
    else params.delete("page");
    startPageTransition(() => {
      router.push(`?${params.toString()}`, { scroll: false });
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <AdminField
          label="Search"
          htmlFor="inventory-search"
          className="w-full max-w-xs"
          hint={
            matches.length === rows.length
              ? `${rows.length} ${rows.length === 1 ? "product" : "products"}`
              : `${matches.length} of ${rows.length}`
          }
        >
          <input
            id="inventory-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name"
            className={ADMIN_INPUT_CLASS}
          />
        </AdminField>

        {rows.length > 0 ? (
          <p className="text-sm text-black/60">
            {lowStockCount} at or below the low-stock threshold
          </p>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <p className="border border-dashed border-black/15 px-4 py-10 text-center text-sm text-black/50">
          Add a product first, then set its stock here.
        </p>
      ) : matches.length === 0 ? (
        <p className="border border-dashed border-black/15 px-4 py-10 text-center text-sm text-black/50">
          Nothing matches “{search.trim()}”.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-black/10 border border-black/10">
          {matches.map((row) => (
            <InventoryRow key={row.id} row={row} />
          ))}
        </ul>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-black/60">
            Page {currentPage} of {totalPages} {total > 0 ? `(${total} total)` : ""}
          </p>

          <div className="flex gap-2">
            <button
              onClick={() => setPage(currentPage - 1)}
              disabled={currentPage === 1 || paging}
              className="px-3 py-1 border border-black/20 text-sm hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {paging ? "Loading..." : "Prev"}
            </button>

            <button
              onClick={() => setPage(currentPage + 1)}
              disabled={currentPage === totalPages || paging}
              className="px-3 py-1 border border-black/20 text-sm hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {paging ? "Loading..." : "Next"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function InventoryRow({
  row,
}: {
  row: AdminInventoryRow;
}) {
  const [values, setValues] = useState<RowValues>({
    stockQuantity: String(row.stockQuantity),
    lowStockThreshold: String(row.lowStockThreshold),
  });
  const [status, setStatus] = useState<
    { tone: "success" | "error"; message: string } | null
  >(null);
  const [pending, startTransition] = useTransition();

  const changed =
    values.stockQuantity !== String(row.stockQuantity) ||
    values.lowStockThreshold !== String(row.lowStockThreshold);

  /** The flag follows what is on screen, so it updates as the admin types. */
  const lowStock = isLowStock({
    stockQuantity: Number(values.stockQuantity) || 0,
    lowStockThreshold: Number(values.lowStockThreshold) || 0,
  });

  const save = () => {
    setStatus(null);

    startTransition(async () => {
      const result = await updateInventoryRow({
        id: row.id,
        stockQuantity: values.stockQuantity,
        lowStockThreshold: values.lowStockThreshold,
      });

      if (!result.ok) {
        setStatus({ tone: "error", message: result.error });
        return;
      }

      setStatus({ tone: "success", message: result.message });
    });
  };

  return (
    <li className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:gap-4 sm:p-4">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="relative aspect-[2/3] w-10 shrink-0 overflow-hidden border border-black/10 bg-black/5 sm:w-14">
          {row.imageUrl ? (
            <img
              src={row.imageUrl}
              alt={row.name}
              width={56}
              height={84}
              loading="lazy"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : null}
        </div>

        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{row.name}</p>

          <p
            className={cn(
              "mt-1 inline-block px-2 py-0.5 text-[10px] tracking-[0.1em] uppercase",
              lowStock
                ? "bg-plum text-white"
                : "bg-black/5 text-black/45",
            )}
          >
            {lowStock ? "Low stock" : "In stock"}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex w-28 flex-col gap-1">
          <span className="text-[10px] tracking-[0.16em] text-black/50 uppercase">
            Stock
          </span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            step="1"
            value={values.stockQuantity}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                stockQuantity: event.target.value,
              }))
            }
            className={ADMIN_INPUT_CLASS}
          />
        </label>

        <label className="flex w-28 flex-col gap-1">
          <span className="text-[10px] tracking-[0.16em] text-black/50 uppercase">
            Low at
          </span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            step="1"
            value={values.lowStockThreshold}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                lowStockThreshold: event.target.value,
              }))
            }
            className={ADMIN_INPUT_CLASS}
          />
        </label>

        <button
          type="button"
          onClick={save}
          disabled={!changed || pending}
          className={ADMIN_PRIMARY_BUTTON_CLASS}
        >
          {pending ? "Saving..." : "Save"}
        </button>
      </div>

      {status ? (
        <p
          role={status.tone === "error" ? "alert" : "status"}
          className={cn(
            "text-xs",
            status.tone === "error" ? "text-plum" : "text-black/50",
          )}
        >
          {status.message}
        </p>
      ) : null}
    </li>
  );
}