"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
/* Admin list thumbnails are plain <img>, not next/image — see ImageUpload.tsx. */
/* eslint-disable @next/next/no-img-element */

import AdminDeleteButton from "@/components/admin/AdminDeleteButton";
import AdminDialog, { AdminDialogCancel } from "@/components/admin/AdminDialog";
import {
  ADMIN_INPUT_CLASS,
  ADMIN_PRIMARY_BUTTON_CLASS,
  ADMIN_SECONDARY_BUTTON_CLASS,
  ADMIN_TEXTAREA_CLASS,
  AdminFeedback,
  AdminField,
  AdminUploadBusyNotice,
  useUploadBusy,
} from "@/components/admin/admin-fields";
import { ImageGalleryUpload } from "@/components/admin/ImageUpload";
import { deleteProduct, saveProduct } from "@/lib/admin/products";
import type {
  AdminCategoryOption,
  AdminProduct,
  AdminSubCategoryOption,
} from "@/lib/admin/queries";
import {
  MAX_NAME_LENGTH,
  MAX_OPTION_LIST_LENGTH,
  MAX_PRODUCT_DESCRIPTION_LENGTH,
} from "@/lib/admin/validation";
import { discountPercentFor, effectivePrice } from "@/lib/products";
import { cn } from "@/lib/utils";

/**
 * The Products screen: a searchable list plus the add / edit form.
 *
 * The list is filtered in the browser on the name only, which is what the dashboard
 * needs at this size and keeps typing instant. Nothing here decides what may be
 * saved — `lib/admin/products.ts` re-reads the category, the sub-category and every
 * field before it writes, so a stale form cannot slip a product into the wrong
 * place.
 *
 * Stock lives in the product form and on the Inventory screen together: both edit
 * the same `stock_quantity` column, so a change saved in either place shows up in
 * the other and on the storefront.
 */

type ProductDraft = {
  id: string | null;
  name: string;
  description: string;
  categoryId: string;
  subCategoryId: string;
  price: string;
  discountPrice: string;
  sizes: string;
  color: string;
  stockQuantity: string;
  lowStockThreshold: string;
  images: string[];
};

export default function ProductsManager({
  products,
  categories,
  subCategories,
  total,
  totalPages,
  currentPage,
}: {
  products: AdminProduct[];
  categories: AdminCategoryOption[];
  subCategories: AdminSubCategoryOption[];
  total: number;
  totalPages: number;
  currentPage: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<ProductDraft | null>(null);

  const categoryName = useMemo(() => {
    const names = new Map(categories.map((category) => [category.id, category.name]));
    const subNames = new Map(
      subCategories.map((subCategory) => [subCategory.id, subCategory.name]),
    );

    return (product: AdminProduct) => {
      const subName = product.subCategoryId
        ? subNames.get(product.subCategoryId)
        : undefined;

      if (subName) return subName;

      return product.categoryId
        ? (names.get(product.categoryId) ?? "Uncategorised")
        : "Uncategorised";
    };
  }, [categories, subCategories]);

  const matches = useMemo(() => {
    const needle = search.trim().toLowerCase();

    return needle
      ? products.filter((product) => product.name.toLowerCase().includes(needle))
      : products;
  }, [products, search]);

  const [paging, startPageTransition] = useTransition();

  const setPage = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (page > 1) params.set("page", String(page));
    else params.delete("page");
    startPageTransition(() => {
      router.push(`?${params.toString()}`, { scroll: false });
    });
  };

  const add = () =>
    setDraft({
      id: null,
      name: "",
      description: "",
      categoryId: categories[0]?.id ?? "",
      subCategoryId: "",
      price: "",
      discountPrice: "",
      sizes: "",
      color: "",
      stockQuantity: "0",
      lowStockThreshold: "5",
      images: [],
    });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <AdminField
          label="Search"
          htmlFor="product-search"
          className="w-full max-w-xs"
          hint={
            matches.length === products.length
              ? `${products.length} ${products.length === 1 ? "product" : "products"}`
              : `${matches.length} of ${products.length}`
          }
        >
          <input
            id="product-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name"
            className={ADMIN_INPUT_CLASS}
          />
        </AdminField>

        <button
          type="button"
          onClick={add}
          disabled={categories.length === 0}
          className={ADMIN_PRIMARY_BUTTON_CLASS}
        >
          Add product
        </button>
      </div>

      {categories.length === 0 ? (
        <p className="border border-dashed border-black/15 px-4 py-10 text-center text-sm text-black/50">
          Add a category first — every product needs one.
        </p>
      ) : matches.length === 0 ? (
        <p className="border border-dashed border-black/15 px-4 py-10 text-center text-sm text-black/50">
          {products.length === 0
            ? "No products yet."
            : `Nothing matches “${search.trim()}”.`}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-black/10 border border-black/10">
          {matches.map((product) => (
            <li key={product.id} className="flex flex-wrap items-center gap-4 p-3 sm:p-4">
              <ProductThumb url={product.images[0] ?? null} name={product.name} />

              <div className="min-w-0 flex-1 basis-60 w-full sm:w-auto">
                <p className="truncate text-sm font-medium">{product.name}</p>
                <p className="text-xs text-black/45">{categoryName(product)}</p>
                <Price product={product} />
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setDraft({
                      id: product.id,
                      name: product.name,
                      description: product.description ?? "",
                      categoryId: product.categoryId ?? categories[0]?.id ?? "",
                      subCategoryId: product.subCategoryId ?? "",
                      price: String(product.price),
                      discountPrice:
                        product.discountPrice === null ? "" : String(product.discountPrice),
                      sizes: product.sizes ?? "",
                      color: product.color ?? "",
                      stockQuantity: String(product.stockQuantity),
                      lowStockThreshold: String(product.lowStockThreshold),
                      images: [...product.images],
                    })
                  }
                  className={ADMIN_SECONDARY_BUTTON_CLASS}
                >
                  Edit
                </button>

                <AdminDeleteButton
                  label="Delete"
                  itemName={product.name}
                  warning={`This also deletes ${product.images.length} image file${
                    product.images.length === 1 ? "" : "s"
                  }. Past orders keep their own copy of what was bought.`}
                  onConfirm={() => deleteProduct({ id: product.id })}
                />
              </div>
            </li>
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

      {draft ? (
        <ProductForm
          key={draft.id ?? "new"}
          draft={draft}
          categories={categories}
          subCategories={subCategories}
          onClose={() => setDraft(null)}
        />
      ) : null}
    </div>
  );
}

function ProductForm({
  draft,
  categories,
  subCategories,
  onClose,
}: {
  draft: ProductDraft;
  categories: AdminCategoryOption[];
  subCategories: AdminSubCategoryOption[];
  onClose: () => void;
}) {
  const [fields, setFields] = useState(draft);
  const [status, setStatus] = useState<Feedback>(null);
  const [pending, startTransition] = useTransition();
  const { uploadsBusy, reportUploadBusy } = useUploadBusy();

  const set = <Key extends keyof ProductDraft>(
    key: Key,
    value: ProductDraft[Key],
  ) => setFields((current) => ({ ...current, [key]: value }));

  const chosenCategory = categories.find(
    (category) => category.id === fields.categoryId,
  );
  const subCategoryOptions = subCategories.filter(
    (subCategory) => subCategory.categoryId === fields.categoryId,
  );
  const subCategoryRequired = subCategoryOptions.length > 0;

  /**
   * Moving the product to another category can invalidate the sub-category, so it
   * is cleared here. The server checks the same thing again — this only keeps the
   * form honest while it is on screen.
   */
  const chooseCategory = (categoryId: string) => {
    const stillValid = subCategories.some(
      (subCategory) =>
        subCategory.categoryId === categoryId && subCategory.id === fields.subCategoryId,
    );

    setFields((current) => ({
      ...current,
      categoryId,
      subCategoryId: stillValid ? current.subCategoryId : "",
    }));
  };

  const save = () => {
    setStatus(null);

    startTransition(async () => {
      const result = await saveProduct({
        id: fields.id,
        name: fields.name,
        description: fields.description,
        categoryId: fields.categoryId,
        subCategoryId: fields.subCategoryId || null,
        price: fields.price,
        discountPrice: fields.discountPrice === "" ? null : fields.discountPrice,
        sizes: fields.sizes,
        color: fields.color,
        stockQuantity: fields.stockQuantity,
        lowStockThreshold: fields.lowStockThreshold,
        images: fields.images,
      });

      if (!result.ok) {
        setStatus({ tone: "error", message: result.error });
        return;
      }

      onClose();
    });
  };

  return (
    <AdminDialog
      open
      onClose={onClose}
      title={draft.id ? "Edit product" : "Add product"}
      description="Shown on the product listing page and in quick view."
      footer={
        <>
          <AdminUploadBusyNotice busy={uploadsBusy} />
          <AdminDialogCancel onClose={onClose} />
          <button
            type="button"
            onClick={save}
            disabled={pending || uploadsBusy}
            className={ADMIN_PRIMARY_BUTTON_CLASS}
          >
            {pending ? "Saving..." : "Save product"}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <AdminField label="Name" htmlFor="product-name" required>
          <input
            id="product-name"
            value={fields.name}
            onChange={(event) => set("name", event.target.value)}
            maxLength={MAX_NAME_LENGTH}
            className={ADMIN_INPUT_CLASS}
            placeholder="Ivory Cotton Kurta"
          />
        </AdminField>

        <AdminField
          label="Description"
          htmlFor="product-description"
          hint={`Shown on the product page and in quick view. ${MAX_PRODUCT_DESCRIPTION_LENGTH} characters maximum.`}
        >
          <textarea
            id="product-description"
            value={fields.description}
            onChange={(event) => set("description", event.target.value)}
            maxLength={MAX_PRODUCT_DESCRIPTION_LENGTH}
            className={ADMIN_TEXTAREA_CLASS}
          />
        </AdminField>

        <div className="grid gap-5 sm:grid-cols-2">
          <AdminField label="Category" htmlFor="product-category" required>
            <select
              id="product-category"
              value={fields.categoryId}
              onChange={(event) => chooseCategory(event.target.value)}
              className={ADMIN_INPUT_CLASS}
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </AdminField>

          <AdminField
            label="Sub-category"
            htmlFor="product-sub-category"
            required={subCategoryRequired}
            hint={
              subCategoryRequired
                ? undefined
                : `${chosenCategory?.name ?? "This category"} has no sub-categories, so the product appears on its listing page directly.`
            }
          >
            <select
              id="product-sub-category"
              value={fields.subCategoryId}
              onChange={(event) => set("subCategoryId", event.target.value)}
              disabled={!subCategoryRequired}
              className={ADMIN_INPUT_CLASS}
            >
              <option value="">
                {subCategoryRequired ? "Choose a sub-category" : "Not applicable"}
              </option>

              {subCategoryOptions.map((subCategory) => (
                <option key={subCategory.id} value={subCategory.id}>
                  {subCategory.name}
                </option>
              ))}
            </select>
          </AdminField>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <AdminField label="Price" htmlFor="product-price" required>
            <input
              id="product-price"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={fields.price}
              onChange={(event) => set("price", event.target.value)}
              className={ADMIN_INPUT_CLASS}
              placeholder="4999"
            />
          </AdminField>

          <AdminField
            label="Discount price"
            htmlFor="product-discount"
            hint={discountHint(fields.price, fields.discountPrice)}
          >
            <input
              id="product-discount"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={fields.discountPrice}
              onChange={(event) => set("discountPrice", event.target.value)}
              className={ADMIN_INPUT_CLASS}
              placeholder="Leave empty for none"
            />
          </AdminField>

          <AdminField
            label="Stock quantity"
            htmlFor="product-stock"
            required
            hint="Whole numbers only. Edited here or on the Inventory screen — both stay in sync."
          >
            <input
              id="product-stock"
              type="number"
              inputMode="numeric"
              min={0}
              step="1"
              value={fields.stockQuantity}
              onChange={(event) => set("stockQuantity", event.target.value)}
              className={ADMIN_INPUT_CLASS}
            />
          </AdminField>

          <AdminField
            label="Low-stock threshold"
            htmlFor="product-threshold"
            required
            hint="Flagged as low stock at or below this."
          >
            <input
              id="product-threshold"
              type="number"
              inputMode="numeric"
              min={0}
              step="1"
              value={fields.lowStockThreshold}
              onChange={(event) => set("lowStockThreshold", event.target.value)}
              className={ADMIN_INPUT_CLASS}
            />
          </AdminField>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <AdminField
            label="Sizes"
            htmlFor="product-sizes"
            hint={`Shown to customers exactly as typed, e.g. “S, M, L”. ${MAX_OPTION_LIST_LENGTH} characters maximum.`}
          >
            <input
              id="product-sizes"
              value={fields.sizes}
              onChange={(event) => set("sizes", event.target.value)}
              maxLength={MAX_OPTION_LIST_LENGTH}
              className={ADMIN_INPUT_CLASS}
              placeholder="S, M, L, XL"
            />
          </AdminField>

          <AdminField
            label="Colours"
            htmlFor="product-colors"
            hint="Comma separated. Becomes the colour filter on the listing page."
          >
            <input
              id="product-colors"
              value={fields.color}
              onChange={(event) => set("color", event.target.value)}
              maxLength={MAX_OPTION_LIST_LENGTH}
              className={ADMIN_INPUT_CLASS}
              placeholder="Ivory, Sage"
            />
          </AdminField>
        </div>

        <ImageGalleryUpload
          label="Images"
          value={fields.images}
          onChange={(images) => set("images", images)}
          folder="products"
          hint="The first image is the main image on the listing page."
          onBusyChange={reportUploadBusy}
        />

        <AdminFeedback status={status} />
      </div>
    </AdminDialog>
  );
}

function ProductThumb({ url, name }: { url: string | null; name: string }) {
  return (
    <div className="relative aspect-[2/3] w-12 shrink-0 overflow-hidden border border-black/10 bg-black/5 sm:w-16">
      {url ? (
        <img
          src={url}
          alt={name}
          width={64}
          height={96}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : null}
    </div>
  );
}

function Price({ product }: { product: AdminProduct }) {
  // Same order and rule as the storefront card: original on the left (struck
  // through only when it is an actual discount), the paid price beside it.
  const percent = discountPercentFor(product.price, product.discountPrice ?? null);

  return (
    <p className="mt-1 flex items-baseline gap-2 text-xs">
      {percent !== null ? (
        <span className="text-black/40 line-through">
          {formatMoney(product.price)}
        </span>
      ) : null}
      <span className={percent !== null ? "text-plum" : undefined}>
        {formatMoney(effectivePrice(product))}
      </span>
    </p>
  );
}

function formatMoney(amount: number): string {
  return `PKR ${amount.toLocaleString("en-PK", {
    maximumFractionDigits: 2,
  })}`;
}

/** Live "X% OFF" so the admin sees the badge customers will see. */
function discountHint(price: string, discountPrice: string): string | undefined {
  const priceAmount = Number(price);
  const discountAmount = Number(discountPrice);

  if (discountPercentFor(priceAmount, discountAmount) === null) {
    return "Leave empty for no discount.";
  }

  const percent = discountPercentFor(priceAmount, discountAmount);

  return `Shows as “${percent}% OFF” on the listing page.`;
}

type Feedback = { tone: "success" | "error"; message: string } | null;