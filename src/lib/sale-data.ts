import "server-only";

import { unstable_cache } from "next/cache";
import { cache } from "react";

import { CACHE_TAGS, DEFAULT_PUBLIC_REVALIDATE } from "@/lib/cache-tags";
import { parseOptionList, type ProductListItem } from "@/lib/products";
import { createPublicClient } from "@/lib/supabase/public";

type SupabaseClient = ReturnType<typeof createPublicClient>;

export type SaleCategory = {
  id: string;
  name: string;
  slug: string;
};

export type SaleProduct = ProductListItem & {
  categoryId: string | null;
};

export type SaleData = {
  products: SaleProduct[];
  categories: SaleCategory[];
  desktopImageUrl: string | null;
  mobileImageUrl: string | null;
  hasSaleProducts: boolean;
};

type SaleProductRow = {
  id: string;
  name: string;
  slug: string;
  sku: string | null;
  category_id: string | null;
  price: number;
  discount_price: number | null;
  stock_quantity: number | null;
  sizes: string | null;
  color: string | null;
  images: string[] | null;
  created_at: string;
};

const SALE_PRODUCT_COLUMNS =
  "id, name, slug, sku, category_id, price, discount_price, stock_quantity, sizes, color, images, created_at";
const SALE_PRODUCT_COLUMNS_WITHOUT_COLOR =
  "id, name, slug, sku, category_id, price, discount_price, stock_quantity, sizes, images, created_at";
const SALE_PRODUCT_COLUMNS_WITHOUT_SKU =
  "id, name, slug, category_id, price, discount_price, stock_quantity, sizes, color, images, created_at";
const SALE_PRODUCT_COLUMNS_WITHOUT_SKU_OR_COLOR =
  "id, name, slug, category_id, price, discount_price, stock_quantity, sizes, images, created_at";
const SALE_PAGE_SIZE = 1000;

function isMissingColorColumnError(error: {
  code?: string;
  message?: string;
}): boolean {
  return (
    (error.code === "42703" || error.code === "PGRST204") &&
    /color/i.test(error.message ?? "") &&
    /(column|does not exist|not found)/i.test(error.message ?? "")
  );
}

function isMissingSkuColumnError(error: {
  code?: string;
  message?: string;
}): boolean {
  return (
    (error.code === "42703" || error.code === "PGRST204") &&
    /sku/i.test(error.message ?? "") &&
    /(column|does not exist|not found)/i.test(error.message ?? "")
  );
}

function isMissingSaleImageColumnError(error: {
  code?: string;
  message?: string;
}): boolean {
  if (error.code === "42703" || error.code === "PGRST204") {
    return /sale_(image|mobile_image)_url/i.test(error.message ?? "");
  }

  return /sale_(image|mobile_image)_url/i.test(error.message ?? "") &&
    /(column|does not exist|not found)/i.test(error.message ?? "");
}

async function fetchSaleProductRows(
  supabase: SupabaseClient,
  includeColor: boolean,
  includeSku: boolean,
): Promise<SaleProductRow[]> {
  const rows: SaleProductRow[] = [];

  for (let from = 0; ; from += SALE_PAGE_SIZE) {
    const columns = includeSku
      ? includeColor
        ? SALE_PRODUCT_COLUMNS
        : SALE_PRODUCT_COLUMNS_WITHOUT_COLOR
      : includeColor
        ? SALE_PRODUCT_COLUMNS_WITHOUT_SKU
        : SALE_PRODUCT_COLUMNS_WITHOUT_SKU_OR_COLOR;

    const { data, error } = await supabase
        .from("products")
        .select(columns)
        .eq("is_active", true)
        .not("discount_price", "is", null)
        .order("created_at", { ascending: false })
        .order("id", { ascending: true })
        .range(from, from + SALE_PAGE_SIZE - 1);
    if (error) throw error;
    const page = ((data ?? []) as unknown as SaleProductRow[]).map((row) => ({
      ...row,
      color: includeColor ? row.color : null,
      sku: includeSku ? row.sku : null,
    }));

    rows.push(...page);
    if (page.length < SALE_PAGE_SIZE) return rows;
  }
}

function isSaleProduct(row: SaleProductRow): boolean {
  const price = Number(row.price);
  const discountPrice =
    row.discount_price === null ? null : Number(row.discount_price);

  return (
    Number.isFinite(price) &&
    price > 0 &&
    discountPrice !== null &&
    Number.isFinite(discountPrice) &&
    discountPrice > 0 &&
    discountPrice < price
  );
}

async function getSaleDataInternal(): Promise<SaleData> {
  const supabase = createPublicClient();

  const [categoriesResult, imageResult] = await Promise.all([
    supabase
      .from("categories")
      .select("id, name, slug")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("store_details")
      .select("sale_image_url, sale_mobile_image_url")
      .eq("id", 1)
      .maybeSingle(),
  ]);

  if (categoriesResult.error) {
    console.error("[sale-data] categories query failed.", categoriesResult.error);
    throw categoriesResult.error;
  }

  let desktopImageUrl: string | null = null;
  let mobileImageUrl: string | null = null;

  if (imageResult.error) {
    if (isMissingSaleImageColumnError(imageResult.error)) {
      console.warn(
        "[sale-data] Sale slide image columns are missing; run supabase/migrations/018_sale_slide.sql.",
      );
    } else {
      console.error("[sale-data] Sale slide image query failed.", imageResult.error);
      throw imageResult.error;
    }
  } else {
    desktopImageUrl = imageResult.data?.sale_image_url ?? null;
    mobileImageUrl = imageResult.data?.sale_mobile_image_url ?? null;
  }

  let rows: SaleProductRow[];
  try {
    rows = await fetchSaleProductRows(supabase, true, true);
  } catch (error) {
    const queryError = error as { code?: string; message?: string };
    if (isMissingSkuColumnError(queryError)) {
      try {
        rows = await fetchSaleProductRows(supabase, true, false);
      } catch (fallbackError) {
        const fallbackQueryError = fallbackError as {
          code?: string;
          message?: string;
        };
        if (!isMissingColorColumnError(fallbackQueryError)) {
          console.error("[sale-data] discounted products query without sku failed.", fallbackError);
          throw fallbackError;
        }
        rows = await fetchSaleProductRows(supabase, false, false);
      }
    } else if (isMissingColorColumnError(queryError)) {
      try {
        rows = await fetchSaleProductRows(supabase, false, true);
      } catch (fallbackError) {
        const fallbackQueryError = fallbackError as {
          code?: string;
          message?: string;
        };
        if (!isMissingSkuColumnError(fallbackQueryError)) {
          console.error("[sale-data] discounted products query without color failed.", fallbackError);
          throw fallbackError;
        }
        rows = await fetchSaleProductRows(supabase, false, false);
      }
    } else {
      console.error("[sale-data] discounted products query failed.", error);
      throw error;
    }
  }

  const products = rows.filter(isSaleProduct).map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    sku: row.sku,
    categoryId: row.category_id,
    imageUrl: row.images?.[0] ?? null,
    secondImageUrl: row.images?.[1] ?? null,
    price: Number(row.price),
    discountPrice: Number(row.discount_price),
    stockQuantity: Math.max(0, Number(row.stock_quantity ?? 0)),
    sizes: parseOptionList(row.sizes),
    colors: parseOptionList(row.color),
    createdAt: row.created_at,
  }));

  return {
    products,
    categories: (categoriesResult.data ?? []).map((category) => ({
      id: category.id,
      name: category.name,
      slug: category.slug,
    })),
    desktopImageUrl,
    mobileImageUrl,
    hasSaleProducts: products.length > 0,
  };
}

export const getSaleData = cache(() =>
  unstable_cache(getSaleDataInternal, ["sale-data"], {
    tags: [
      CACHE_TAGS.sale,
      CACHE_TAGS.products,
      CACHE_TAGS.categories,
      CACHE_TAGS.storeDetails,
    ],
    revalidate: DEFAULT_PUBLIC_REVALIDATE,
  })(),
);
