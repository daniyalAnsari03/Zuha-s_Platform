import "server-only";

/**
 * The admin's read side: everything the dashboard's screens render —
 * Categories, Products, Inventory, Orders, Customers, Contact messages,
 * Analytics, the Dashboard home, Announcements, Team Members and Settings.
 *
 * Runs on the service-role client from `admin/db.ts`, because a dashboard has to
 * see rows RLS hides from a shopper — an inactive product, a category with no
 * active flag, an order count. The key authorises nothing on its own, so every
 * function here calls `requireAdmin()` before it queries, exactly like the server
 * actions in this folder.
 *
 * No fallbacks. The storefront falls back to seed art while the tables are empty
 * so a visitor always sees something; an admin screen must instead be honest about
 * the database, or a silent failure looks like a data-loss bug.
 */

import { getAdminDb } from "@/lib/admin/db";
import { requireAdmin } from "@/lib/admin/guard";
import { slugify } from "@/lib/admin/slug";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/order-types";
import {
  STORE_POLICY_SLUGS,
  STORE_POLICY_TITLES,
  type StorePolicySlug,
} from "@/lib/policy-types";
import { isLowStock, pairImagesWithColors } from "@/lib/products";

export type AdminSubCategory = {
  id: string;
  categoryId: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  /** Products pointing at this sub-category. */
  productCount: number;
};

export type AdminCategory = {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  mobileImageUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  subCategories: AdminSubCategory[];
  /** Products pointing at this category directly. */
  productCount: number;
};

export type AdminCategoryOption = {
  id: string;
  name: string;
  /** False for Bag's / Jewellery style categories that have no sub-categories. */
  hasSubCategories: boolean;
};

export type AdminSubCategoryOption = {
  id: string;
  categoryId: string;
  name: string;
};

export type AdminProduct = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  categoryId: string | null;
  subCategoryId: string | null;
  price: number;
  discountPrice: number | null;
  /** Free text exactly as the admin typed it, e.g. "S, M, L". */
  sizes: string | null;
  /** Free text exactly as the admin typed it, e.g. "Black, Red". */
  color: string | null;
  stockQuantity: number;
  lowStockThreshold: number;
  images: string[];
  /**
   * Colour tag per image, index-aligned with `images` ("" = no tag), from
   * migration 017. Always the same length as `images`, so the edit form can
   * key its per-thumbnail inputs by URL without any shifting.
   */
  imageColors: string[];
  isActive: boolean;
};

export type AdminInventoryRow = {
  id: string;
  name: string;
  imageUrl: string | null;
  stockQuantity: number;
  lowStockThreshold: number;
};

/** Every top-level category with its sub-categories and product counts. */
export async function listAdminCategories(): Promise<AdminCategory[]> {
  await requireAdmin();
  const db = getAdminDb();

  const [categoriesResult, subCategoriesResult, productsResult] = await Promise.all([
    db.from("categories").select("id, name, slug, image_url, mobile_image_url, sort_order, is_active").order("sort_order", { ascending: true }),
    db.from("sub_categories").select("id, category_id, name, slug, image_url").order("sort_order", { ascending: true }),
    // Only the two foreign keys are needed, to count what is attached.
    db.from("products").select("id, category_id, sub_category_id"),
  ]);

  if (categoriesResult.error) {
    throw new Error(`Could not load categories: ${categoriesResult.error.message}`);
  }

  const subCategories = subCategoriesResult.data ?? [];
  const products = productsResult.data ?? [];

  const productsPerCategory = countBy(products.map((row) => row.category_id));
  const productsPerSubCategory = countBy(products.map((row) => row.sub_category_id));

  return (categoriesResult.data ?? []).map((category) => ({
    id: category.id,
    name: category.name,
    slug: category.slug,
    imageUrl: category.image_url,
    mobileImageUrl: category.mobile_image_url,
    sortOrder: category.sort_order,
    isActive: category.is_active,
    productCount: productsPerCategory.get(category.id) ?? 0,
    subCategories: subCategories
      .filter((sub) => sub.category_id === category.id)
      .map((sub) => ({
        id: sub.id,
        categoryId: sub.category_id,
        name: sub.name,
        slug: sub.slug,
        imageUrl: sub.image_url,
        productCount: productsPerSubCategory.get(sub.id) ?? 0,
      })),
  }));
}

/** The category and sub-category options the product form needs. */
export async function listAdminTaxonomy(): Promise<{
  categories: AdminCategoryOption[];
  subCategories: AdminSubCategoryOption[];
}> {
  await requireAdmin();
  const db = getAdminDb();

  const [categoriesResult, subCategoriesResult] = await Promise.all([
    db.from("categories").select("id, name").order("sort_order", { ascending: true }),
    db.from("sub_categories").select("id, category_id, name").order("sort_order", { ascending: true }),
  ]);

  if (categoriesResult.error) {
    throw new Error(`Could not load categories: ${categoriesResult.error.message}`);
  }

  const subCategories = subCategoriesResult.data ?? [];

  return {
    categories: (categoriesResult.data ?? []).map((category) => ({
      id: category.id,
      name: category.name,
      hasSubCategories: subCategories.some((sub) => sub.category_id === category.id),
    })),
    subCategories: subCategories.map((sub) => ({
      id: sub.id,
      categoryId: sub.category_id,
      name: sub.name,
    })),
  };
}

export type AdminProductsListParams = {
  page?: number;
  perPage?: number;
};

/** Products, newest first — one page at a time. */
export async function listAdminProducts(
  params: AdminProductsListParams = {},
): Promise<{
  products: AdminProduct[];
  total: number;
  totalPages: number;
  currentPage: number;
}> {
  await requireAdmin();
  const db = getAdminDb();
  const page = params.page ?? 1;
  const perPage = params.perPage ?? 20;

  // The count and the page of rows are independent: run them together.
  const [{ count, error: countError }, { data, error }] = await Promise.all([
    db.from("products").select("id", { count: "exact", head: true }),
    db
      .from("products")
      .select(
        "id, name, slug, description, category_id, sub_category_id, price, discount_price, sizes, color, stock_quantity, low_stock_threshold, images, image_colors, is_active",
      )
      .order("created_at", { ascending: false })
      .range((page - 1) * perPage, page * perPage - 1),
  ]);

  if (countError) {
    throw new Error(`Could not count products: ${countError.message}`);
  }

  if (error) {
    throw new Error(`Could not load products: ${error.message}`);
  }

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / perPage));

  return {
    products: (data ?? []).map((product) => {
      // URLs and colour tags are paired in one pass, so the tags that come
      // back from `image_colors` (migration 017) can never land on the wrong
      // thumbnail — and a missing column/short array simply reads as "".
      const gallery = pairImagesWithColors(product.images, product.image_colors);

      return {
        id: product.id,
        name: product.name,
        slug: product.slug,
        description: product.description,
        categoryId: product.category_id,
        subCategoryId: product.sub_category_id,
        price: Number(product.price),
        discountPrice: product.discount_price === null ? null : Number(product.discount_price),
        sizes: product.sizes,
        color: product.color,
        stockQuantity: product.stock_quantity,
        lowStockThreshold: product.low_stock_threshold,
        images: gallery.map((entry) => entry.url),
        imageColors: gallery.map((entry) => entry.color),
        isActive: product.is_active,
      };
    }),
    total: count ?? 0,
    totalPages,
    currentPage: page,
  };
}

export type AdminInventoryListParams = {
  page?: number;
  perPage?: number;
};

/** Products with just the numbers the Inventory screen edits — one page at a time. */
export async function listAdminInventory(
  params: AdminInventoryListParams = {},
): Promise<{
  rows: AdminInventoryRow[];
  total: number;
  totalPages: number;
  currentPage: number;
}> {
  await requireAdmin();
  const db = getAdminDb();
  const page = params.page ?? 1;
  const perPage = params.perPage ?? 20;

  // The count and the page of rows are independent: run them together.
  const [{ count, error: countError }, { data, error }] = await Promise.all([
    db.from("products").select("id", { count: "exact", head: true }),
    db
      .from("products")
      .select("id, name, images, stock_quantity, low_stock_threshold")
      .order("name", { ascending: true })
      .range((page - 1) * perPage, page * perPage - 1),
  ]);

  if (countError) {
    throw new Error(`Could not count inventory: ${countError.message}`);
  }

  if (error) {
    throw new Error(`Could not load inventory: ${error.message}`);
  }

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / perPage));

  return {
    rows: (data ?? []).map((product) => ({
      id: product.id,
      name: product.name,
      imageUrl: product.images?.[0] ?? null,
      stockQuantity: product.stock_quantity,
      lowStockThreshold: product.low_stock_threshold,
    })),
    total: count ?? 0,
    totalPages,
    currentPage: page,
  };
}

/**
 * Every product's inventory numbers, not one page — the Dashboard's low-stock
 * section must see all products, whichever page of the Inventory screen they
 * would sit on. Internal: the caller has already run `requireAdmin()`.
 */
async function allInventoryRows(
  db: ReturnType<typeof getAdminDb>,
): Promise<AdminInventoryRow[]> {
  const { data, error } = await db
    .from("products")
    .select("id, name, images, stock_quantity, low_stock_threshold")
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Could not load inventory: ${error.message}`);
  }

  return (data ?? []).map((product) => ({
    id: product.id,
    name: product.name,
    imageUrl: product.images?.[0] ?? null,
    stockQuantity: product.stock_quantity,
    lowStockThreshold: product.low_stock_threshold,
  }));
}

/**
 * A slug that is free in `table`.
 *
 * The admin never edits a slug and never supplies one: it is derived from the
 * name every time, and a name that is already taken gets `-2`, `-3` and so on, so
 * two categories called "Casual" can both exist under different parents without
 * one silently taking the other's URL.
 *
 * `excludeId` is the row being edited. Without it, saving a product called "Dress"
 * would find its own `dress` slug taken and rename the product to `dress-2` on
 * every edit — so the row's own slug never counts as a clash.
 */
export async function uniqueSlug(
  table: "categories" | "sub_categories" | "products",
  name: string,
  fallback: string,
  excludeId?: string | null,
): Promise<string> {
  await requireAdmin();
  const db = getAdminDb();

  const base = slugify(name, fallback);

  // One round-trip instead of one per candidate: fetch every existing slug that
  // starts with `base`, then pick the first free suffix in memory.
  const query =
    table === "categories"
      ? db.from("categories").select("slug")
      : table === "sub_categories"
        ? db.from("sub_categories").select("slug")
        : db.from("products").select("slug");

  const scoped = excludeId ? query.neq("id", excludeId) : query;

  // `%` and `_` would be LIKE wildcards; `base` comes from `slugify`, which only
  // ever produces letters, digits and hyphens, so the prefix is safe to embed.
  const result = await scoped.like("slug", `${base}%`);

  if (result.error) {
    throw new Error(`Could not check the slug "${base}": ${result.error.message}`);
  }

  const taken = new Set((result.data ?? []).map((row) => row.slug));

  for (let attempt = 1; attempt <= 50; attempt += 1) {
    const candidate = attempt === 1 ? base : `${base}-${attempt}`;
    if (!taken.has(candidate)) return candidate;
  }

  throw new Error("Could not find a free slug for that name. Please rename it.");
}

function countBy(values: readonly (string | null)[]): Map<string, number> {
  const counts = new Map<string, number>();

  for (const value of values) {
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return counts;
}

// ---------------------------------------------------------------------------
// Orders (Phase 9C)
// ---------------------------------------------------------------------------

export type AdminOrderListItem = {
  id: string;
  orderNumber: string;
  createdAt: string;
  customerName: string | null;
  customerEmail: string;
  total: number;
  status: OrderStatus;
};

export type AdminOrderItemLine = {
  id: string;
  productName: string;
  /** The size the shopper chose, stored in `order_items.variant`. */
  size: string | null;
  color: string | null;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  /** The product's current main image, when the product still exists. */
  imageUrl: string | null;
};

export type AdminOrderDetail = AdminOrderListItem & {
  customerPhone: string | null;
  shippingAddress: string | null;
  shippingCity: string | null;
  paymentMethod: string | null;
  subtotal: number;
  shippingFee: number;
  discount: number;
  items: AdminOrderItemLine[];
};

export type AdminOrdersListParams = {
  page?: number;
  perPage?: number;
};

/** Orders, newest first — one page at a time. */
export async function listAdminOrders(
  params: AdminOrdersListParams = {},
): Promise<{
  orders: AdminOrderListItem[];
  total: number;
  totalPages: number;
  currentPage: number;
}> {
  await requireAdmin();
  const db = getAdminDb();
  const page = params.page ?? 1;
  const perPage = params.perPage ?? 20;

  // The count and the page of rows are independent: run them together.
  const [{ count, error: countError }, { data, error }] = await Promise.all([
    db.from("orders").select("id", { count: "exact", head: true }),
    db
      .from("orders")
      .select(
        "id, order_number, created_at, customer_name, customer_email, total, status",
      )
      .order("created_at", { ascending: false })
      .range((page - 1) * perPage, page * perPage - 1),
  ]);

  if (countError) {
    throw new Error(`Could not count orders: ${countError.message}`);
  }

  if (error) {
    throw new Error(`Could not load orders: ${error.message}`);
  }

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / perPage));

  return {
    orders: (data ?? []).map((order) => ({
      id: order.id,
      orderNumber: order.order_number,
      createdAt: order.created_at,
      customerName: order.customer_name,
      customerEmail: order.customer_email,
      total: Number(order.total),
      status: order.status,
    })),
    total: count ?? 0,
    totalPages,
    currentPage: page,
  };
}

/** The newest `limit` orders — the Dashboard home's "recent orders" list. */
async function recentAdminOrders(
  db: ReturnType<typeof getAdminDb>,
  limit: number,
): Promise<AdminOrderListItem[]> {
  const { data, error } = await db
    .from("orders")
    .select(
      "id, order_number, created_at, customer_name, customer_email, total, status",
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Could not load orders: ${error.message}`);
  }

  return (data ?? []).map((order) => ({
    id: order.id,
    orderNumber: order.order_number,
    createdAt: order.created_at,
    customerName: order.customer_name,
    customerEmail: order.customer_email,
    total: Number(order.total),
    status: order.status,
  }));
}

/**
 * One order with its line items, for the detail screen.
 *
 * Returns null (rather than throwing) when the id does not exist, so the page
 * can answer with a 404 instead of an error boundary. A failed *query* still
 * throws — that is a real fault, not a missing row.
 */
export async function getAdminOrder(
  id: string,
): Promise<AdminOrderDetail | null> {
  await requireAdmin();
  const db = getAdminDb();

  // The order and its line items only depend on the `id` we already hold, so
  // fetch them together; the products read afterwards needs the items' ids.
  const [{ data: order, error }, { data: itemRows, error: itemsError }] =
    await Promise.all([
      db
        .from("orders")
        .select(
          "id, order_number, created_at, customer_name, customer_email, customer_phone, shipping_address, shipping_city, payment_method, subtotal, shipping_fee, discount, total, status",
        )
        .eq("id", id)
        .maybeSingle(),
      db
        .from("order_items")
        .select(
          "id, product_id, product_name, variant, color, unit_price, quantity, line_total, created_at",
        )
        .eq("order_id", id)
        .order("created_at", { ascending: true }),
    ]);

  if (error) {
    throw new Error(`Could not load the order: ${error.message}`);
  }

  if (!order) return null;

  if (itemsError) {
    throw new Error(`Could not load the order items: ${itemsError.message}`);
  }

  const productIds = [
    ...new Set(
      (itemRows ?? [])
        .map((item) => item.product_id)
        .filter((productId): productId is string => Boolean(productId)),
    ),
  ];

  const images = new Map<string, string | null>();

  if (productIds.length > 0) {
    const { data: products, error: productsError } = await db
      .from("products")
      .select("id, images")
      .in("id", productIds);

    if (productsError) {
      throw new Error(`Could not load the products: ${productsError.message}`);
    }

    for (const product of products ?? []) {
      images.set(product.id, product.images?.[0] ?? null);
    }
  }

  return {
    id: order.id,
    orderNumber: order.order_number,
    createdAt: order.created_at,
    customerName: order.customer_name,
    customerEmail: order.customer_email,
    customerPhone: order.customer_phone,
    shippingAddress: order.shipping_address,
    shippingCity: order.shipping_city,
    paymentMethod: order.payment_method,
    subtotal: Number(order.subtotal),
    shippingFee: Number(order.shipping_fee),
    discount: Number(order.discount),
    total: Number(order.total),
    status: order.status,
    items: (itemRows ?? []).map((item) => ({
      id: item.id,
      productName: item.product_name,
      size: item.variant,
      color: item.color,
      unitPrice: Number(item.unit_price),
      quantity: item.quantity,
      lineTotal: Number(item.line_total),
      imageUrl: item.product_id
        ? images.get(item.product_id) ?? null
        : null,
    })),
  };
}

/** Orders per status, in the order the store moves them through. */
async function orderStatusCounts(
  db: ReturnType<typeof getAdminDb>,
): Promise<{ status: OrderStatus; count: number }[]> {
  const counts = await Promise.all(
    ORDER_STATUSES.map(async (status) => {
      const { count, error } = await db
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("status", status);

      if (error) {
        throw new Error(`Could not count orders: ${error.message}`);
      }

      return { status, count: count ?? 0 };
    }),
  );

  return counts;
}

// ---------------------------------------------------------------------------
// Customers (Phase 9C)
// ---------------------------------------------------------------------------

export type AdminCustomer = {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  /** When the account was created, which is not when it first ordered. */
  signedUpAt: string;
};

export type AdminCustomersListParams = {
  page?: number;
  perPage?: number;
};

/**
 * Signed-up shoppers only — guest checkouts never create an Auth account and
 * are deliberately absent.
 *
 * The accounts come from Auth itself rather than from `customers`: a `customers`
 * row only appears once someone checks out, so it cannot answer "who has signed
 * up?", and its `created_at` would be the first order, not the sign-up. The
 * profile row is joined in afterwards for the name and phone number Auth does
 * not hold.
 *
 * Auth paginates on its own, so `page` and `perPage` go straight to it; the
 * page that comes back is only sorted, never sliced again.
 */
export async function listAdminCustomers(
  params: AdminCustomersListParams = {},
): Promise<{
  customers: AdminCustomer[];
  total: number;
  totalPages: number;
  currentPage: number;
}> {
  await requireAdmin();
  const db = getAdminDb();
  const page = params.page ?? 1;
  const perPage = params.perPage ?? 200;

  // The account list and the profile rows are independent — run them together,
  // then join them in memory below.
  const [{ data, error }, { data: profiles, error: profileError }] =
    await Promise.all([
      db.auth.admin.listUsers({ page, perPage }),
      db
        .from("customers")
        .select("user_id, full_name, phone")
        .not("user_id", "is", null),
    ]);

  if (error || !data) {
    console.error("[admin] could not list accounts.", error?.message);
    throw new Error(
      `Could not load customers: ${error?.message ?? "Supabase Auth did not return any accounts."}`,
    );
  }

  if (profileError) {
    throw new Error(`Could not load customer profiles: ${profileError.message}`);
  }

  const accounts = data.users.map((user) => ({
    id: user.id,
    email: user.email ?? "",
    createdAt: user.created_at,
    metadata: (user.user_metadata ?? {}) as Record<string, unknown>,
  }));

  const total = typeof data.total === "number" ? data.total : accounts.length;
  const totalPages = Math.max(1, Number(data.lastPage) || 1);

  const profileByUserId = new Map(
    (profiles ?? []).map((profile) => [
      profile.user_id ?? "",
      { name: profile.full_name, phone: profile.phone },
    ]),
  );

  const customers: AdminCustomer[] = accounts
    .map((account) => {
      const profile = profileByUserId.get(account.id);
      const metadata = account.metadata;

      const metadataName =
        typeof metadata.full_name === "string"
          ? metadata.full_name
          : typeof metadata.name === "string"
            ? metadata.name
            : null;

      const metadataPhone =
        typeof metadata.phone === "string" ? metadata.phone : null;

      return {
        id: account.id,
        email: account.email,
        name: profile?.name ?? metadataName,
        phone: profile?.phone ?? metadataPhone,
        signedUpAt: account.createdAt,
      };
    })
    .sort((a, b) => b.signedUpAt.localeCompare(a.signedUpAt));

  return {
    customers,
    total,
    totalPages,
    currentPage: page,
  };
}

/** How many accounts have signed up, for the Analytics stat card. */
async function countCustomers(
  db: ReturnType<typeof getAdminDb>,
): Promise<number> {
  const { data, error } = await db.auth.admin.listUsers({ page: 1, perPage: 1 });

  if (error || !data) {
    throw new Error(
      `Could not count customers: ${error?.message ?? "Supabase Auth did not return any accounts."}`,
    );
  }

  return typeof data.total === "number" ? data.total : data.users.length;
}

// ---------------------------------------------------------------------------
// Contact messages
// ---------------------------------------------------------------------------

export type AdminContactMessage = {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  message: string;
  isRead: boolean;
  createdAt: string;
};

export type AdminContactMessagesListParams = {
  page?: number;
  perPage?: number;
};

/** Messages from the /contact form, newest first — one page at a time. */
export async function listAdminContactMessages(
  params: AdminContactMessagesListParams = {},
): Promise<{
  messages: AdminContactMessage[];
  total: number;
  totalPages: number;
  currentPage: number;
}> {
  await requireAdmin();
  const db = getAdminDb();
  const page = params.page ?? 1;
  const perPage = params.perPage ?? 20;

  // The count and the page of rows are independent: run them together.
  const [{ count, error: countError }, { data, error }] = await Promise.all([
    db.from("contact_messages").select("id", { count: "exact", head: true }),
    db
      .from("contact_messages")
      .select("id, name, phone, email, message, is_read, created_at")
      .order("created_at", { ascending: false })
      .range((page - 1) * perPage, page * perPage - 1),
  ]);

  if (countError) {
    throw new Error(`Could not count messages: ${countError.message}`);
  }

  if (error) {
    throw new Error(`Could not load messages: ${error.message}`);
  }

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / perPage));

  return {
    messages: (data ?? []).map((message) => ({
      id: message.id,
      name: message.name,
      email: message.email,
      phone: message.phone,
      message: message.message,
      isRead: message.is_read,
      createdAt: message.created_at,
    })),
    total: count ?? 0,
    totalPages,
    currentPage: page,
  };
}

/**
 * How many messages nobody has opened yet — the sidebar's unread badge.
 *
 * A single head count (no rows come back), so it is cheap enough to sit in the
 * admin layout, which renders for every dashboard request.
 */
export async function countUnreadContactMessages(): Promise<number> {
  await requireAdmin();
  const db = getAdminDb();

  const { count, error } = await db
    .from("contact_messages")
    .select("id", { count: "exact", head: true })
    .eq("is_read", false);

  if (error) {
    throw new Error(`Could not count unread messages: ${error.message}`);
  }

  return count ?? 0;
}

// ---------------------------------------------------------------------------
// Dashboard home (Phase 9C)
// ---------------------------------------------------------------------------

export type AdminDashboardData = {
  statusCounts: { status: OrderStatus; count: number }[];
  /** The eight most recent orders. */
  recentOrders: AdminOrderListItem[];
  /** Every product at or below its own low-stock threshold. */
  lowStock: AdminInventoryRow[];
};

export async function getAdminDashboard(): Promise<AdminDashboardData> {
  await requireAdmin();
  const db = getAdminDb();

  const [statusCounts, recentOrders, inventory] = await Promise.all([
    orderStatusCounts(db),
    recentAdminOrders(db, 8),
    allInventoryRows(db),
  ]);

  return {
    statusCounts,
    recentOrders,
    // The same helper the Inventory screen uses, so "low stock" means the same
    // thing on both screens.
    lowStock: inventory.filter(isLowStock),
  };
}

// ---------------------------------------------------------------------------
// Analytics (Phase 9C)
// ---------------------------------------------------------------------------

export type AdminAnalyticsRange = "7d" | "30d" | "12m";

export type AdminAnalyticsPoint = {
  /** Human label for the axis: "Oct 5" for days, "Oct 25" for months. */
  label: string;
  value: number;
};

export type AdminAnalytics = {
  /** Order totals, cancelled orders excluded. */
  totalSales: number;
  totalOrders: number;
  totalCustomers: number;
  averageOrderValue: number;
  series: Record<AdminAnalyticsRange, AdminAnalyticsPoint[]>;
  topProducts: {
    productId: string | null;
    name: string;
    imageUrl: string | null;
    units: number;
  }[];
  statusCounts: { status: OrderStatus; count: number }[];
};

/**
 * Every number on the Analytics screen, computed on the server from `orders`
 * and `order_items`.
 *
 * Two rules the spec sets are enforced here rather than in the component:
 * cancelled orders count towards nothing that is money (sales, the chart, the
 * average and the best-sellers), and days and months are grouped in the store's
 * own time zone (Asia/Karachi) rather than the server's, so an order placed at
 * 1 a.m. local time lands on the day the shop sees it as.
 */
export async function getAdminAnalytics(): Promise<AdminAnalytics> {
  await requireAdmin();
  const db = getAdminDb();

  const [ordersResult, itemsResult, statusCounts, totalCustomers] =
    await Promise.all([
      db.from("orders").select("id, created_at, total, status"),
      db.from("order_items").select("order_id, product_id, product_name, quantity"),
      orderStatusCounts(db),
      countCustomers(db),
    ]);

  if (ordersResult.error) {
    throw new Error(`Could not load orders: ${ordersResult.error.message}`);
  }

  if (itemsResult.error) {
    throw new Error(`Could not load order items: ${itemsResult.error.message}`);
  }

  const orders = ordersResult.data ?? [];
  const cancelledOrderIds = new Set(
    orders.filter((order) => order.status === "Cancelled").map((order) => order.id),
  );

  const countedOrders = orders.filter((order) => !cancelledOrderIds.has(order.id));
  const totalSales = countedOrders.reduce(
    (sum, order) => sum + Number(order.total),
    0,
  );

  const salesByDay = new Map<string, number>();
  const salesByMonth = new Map<string, number>();

  for (const order of countedOrders) {
    const at = new Date(order.created_at);
    if (Number.isNaN(at.getTime())) continue;

    const day = dayKey(at);
    salesByDay.set(day, (salesByDay.get(day) ?? 0) + Number(order.total));

    const month = day.slice(0, 7);
    salesByMonth.set(month, (salesByMonth.get(month) ?? 0) + Number(order.total));
  }

  // Top sellers by units, tallied per product (or per name when the product
  // has since been deleted and `product_id` is null).
  const tallies = new Map<
    string,
    { productId: string | null; name: string; units: number }
  >();

  for (const item of itemsResult.data ?? []) {
    if (cancelledOrderIds.has(item.order_id)) continue;

    const key = item.product_id ?? `name:${item.product_name.toLowerCase()}`;
    const existing = tallies.get(key);

    if (existing) {
      existing.units += item.quantity;
    } else {
      tallies.set(key, {
        productId: item.product_id,
        name: item.product_name,
        units: item.quantity,
      });
    }
  }

  const topProducts = [...tallies.values()]
    .sort((a, b) => b.units - a.units || a.name.localeCompare(b.name))
    .slice(0, 5);

  const topProductIds = topProducts
    .map((product) => product.productId)
    .filter((productId): productId is string => Boolean(productId));

  const images = new Map<string, string | null>();

  if (topProductIds.length > 0) {
    const { data: products, error: productsError } = await db
      .from("products")
      .select("id, images")
      .in("id", topProductIds);

    if (productsError) {
      throw new Error(`Could not load the products: ${productsError.message}`);
    }

    for (const product of products ?? []) {
      images.set(product.id, product.images?.[0] ?? null);
    }
  }

  return {
    totalSales,
    totalOrders: orders.length,
    totalCustomers,
    averageOrderValue: countedOrders.length
      ? totalSales / countedOrders.length
      : 0,
    series: {
      "7d": daySeries(salesByDay, 7),
      "30d": daySeries(salesByDay, 30),
      "12m": monthSeries(salesByMonth, 12),
    },
    topProducts: topProducts.map((product) => ({
      ...product,
      imageUrl: product.productId
        ? images.get(product.productId) ?? null
        : null,
    })),
    statusCounts,
  };
}

// ---------------------------------------------------------------------------
// Announcements, Team Members and Settings (Phase 9C)
// ---------------------------------------------------------------------------

export type AdminAnnouncement = {
  id: string;
  /** The ticker's text: `title` and `body` joined, exactly as the homepage does. */
  text: string;
  isActive: boolean;
  createdAt: string;
};

export type AdminAnnouncementsListParams = {
  page?: number;
  perPage?: number;
};

type AnnouncementsPageData = {
  announcements: AdminAnnouncement[];
  total: number;
  totalPages: number;
  currentPage: number;
};

export async function listAdminAnnouncements(
  params: AdminAnnouncementsListParams = {},
): Promise<AnnouncementsPageData> {
  await requireAdmin();
  const db = getAdminDb();
  const page = params.page ?? 1;
  const perPage = params.perPage ?? 20;

  // The count and the page of rows are independent: run them together.
  const [{ count, error: countError }, { data, error }] = await Promise.all([
    db.from("announcements").select("id", { count: "exact", head: true }),
    db
      .from("announcements")
      .select("id, title, body, is_active, created_at")
      .order("created_at", { ascending: false })
      .range((page - 1) * perPage, page * perPage - 1),
  ]);

  if (countError) {
    throw new Error(`Could not count announcements: ${countError.message}`);
  }

  if (error) {
    throw new Error(`Could not load announcements: ${error.message}`);
  }

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / perPage));

  return {
    announcements: (data ?? []).map((announcement) => ({
      id: announcement.id,
      text: [announcement.title, announcement.body]
        .filter(Boolean)
        .join(" — "),
      isActive: announcement.is_active,
      createdAt: announcement.created_at,
    })),
    total: count ?? 0,
    totalPages,
    currentPage: page,
  };
}

export type AdminTeamMember = {
  id: string;
  name: string;
  role: string;
  bio: string | null;
  imageUrl: string | null;
  sortOrder: number;
  isActive: boolean;
};

export type AdminTeamMembersListParams = {
  page?: number;
  perPage?: number;
};

type TeamMembersPageData = {
  members: AdminTeamMember[];
  total: number;
  totalPages: number;
  currentPage: number;
};

/** Team members in carousel order — the same order the Team page uses. */
export async function listAdminTeamMembers(
  params: AdminTeamMembersListParams = {},
): Promise<TeamMembersPageData> {
  await requireAdmin();
  const db = getAdminDb();
  const page = params.page ?? 1;
  const perPage = params.perPage ?? 20;

  // The count and the page of rows are independent: run them together.
  const [{ count, error: countError }, { data, error }] = await Promise.all([
    db.from("team_members").select("id", { count: "exact", head: true }),
    db
      .from("team_members")
      .select("id, name, role, bio, image_url, sort_order, is_active")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true })
      .range((page - 1) * perPage, page * perPage - 1),
  ]);

  if (countError) {
    throw new Error(`Could not count team members: ${countError.message}`);
  }

  if (error) {
    throw new Error(`Could not load team members: ${error.message}`);
  }

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / perPage));

  return {
    members: (data ?? []).map((member) => ({
      id: member.id,
      name: member.name,
      role: member.role,
      bio: member.bio,
      imageUrl: member.image_url,
      sortOrder: member.sort_order,
      isActive: member.is_active,
    })),
    total: count ?? 0,
    totalPages,
    currentPage: page,
  };
}

export type AdminStoreDetails = {
  storeName: string;
  contactEmail: string;
  phone: string;
  address: string;
  instagram: string;
  facebook: string;
  tiktok: string;
  whatsapp: string;
  /** "1 USD = X PKR" as a string; empty means no rate. */
  usdRate: string;
  /** "1 EUR = X PKR" as a string; empty means no rate. */
  eurRate: string;
  /** "1 GBP = X PKR" as a string; empty means no rate. */
  gbpRate: string;
  /** "1 AED = X PKR" as a string; empty means no rate. */
  aedRate: string;
  /** "1 CAD = X PKR" as a string; empty means no rate. */
  cadRate: string;
};

export const EMPTY_STORE_DETAILS: AdminStoreDetails = {
  storeName: "",
  contactEmail: "",
  phone: "",
  address: "",
  instagram: "",
  facebook: "",
  tiktok: "",
  whatsapp: "",
  usdRate: "",
  eurRate: "",
  gbpRate: "",
  aedRate: "",
  cadRate: "",
};

/**
 * The Settings screen's starting values: the single `store_details` row
 * (migration 010). Empty strings mean "not set yet", which is exactly what the
 * form shows and what the storefront falls back to `site-config.ts` for.
 */
export async function getAdminStoreDetails(): Promise<AdminStoreDetails> {
  await requireAdmin();
  const db = getAdminDb();

  const { data, error } = await db
    .from("store_details")
    .select(
      "id, store_name, contact_email, phone, address, instagram_url, facebook_url, tiktok_url, whatsapp_url, usd_rate, eur_rate, gbp_rate, aed_rate, cad_rate",
    )
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    console.error("[admin] could not read the store details.", error.message);

    // The most likely cause by far: migration 010 has not been run yet.
    throw new Error(
      `Could not load the settings: ${error.message}. Run supabase/migrations/010_store_details.sql in the Supabase SQL Editor first.`,
    );
  }

  if (!data) return { ...EMPTY_STORE_DETAILS };

  return {
    storeName: data.store_name,
    contactEmail: data.contact_email,
    phone: data.phone,
    address: data.address,
    instagram: data.instagram_url,
    facebook: data.facebook_url,
    tiktok: data.tiktok_url,
    whatsapp: data.whatsapp_url,
    usdRate: data.usd_rate === null ? "" : String(data.usd_rate),
    eurRate: data.eur_rate === null ? "" : String(data.eur_rate),
    gbpRate: data.gbp_rate === null ? "" : String(data.gbp_rate),
    aedRate: data.aed_rate === null ? "" : String(data.aed_rate),
    cadRate: data.cad_rate === null ? "" : String(data.cad_rate),
  };
}

export type AdminStorePolicy = {
  slug: StorePolicySlug;
  title: string;
  content: string;
};

/**
 * The four policy pages (migration 014), always in the fixed route order, with
 * each row's own title and body. A slug with no row falls back to the seeded
 * title and an empty body, so the Settings screen still shows all four tabs.
 */
export async function listAdminStorePolicies(): Promise<AdminStorePolicy[]> {
  await requireAdmin();
  const db = getAdminDb();

  const { data, error } = await db
    .from("store_policies")
    .select("slug, title, content");

  if (error) {
    console.error("[admin] could not read the store policies.", error.message);

    // The most likely cause by far: migration 014 has not been run yet.
    throw new Error(
      `Could not load the store policies: ${error.message}. Run supabase/migrations/014_store_policies.sql in the Supabase SQL Editor first.`,
    );
  }

  const bySlug = new Map((data ?? []).map((row) => [row.slug, row]));

  return STORE_POLICY_SLUGS.map((slug) => {
    const row = bySlug.get(slug);

    return {
      slug,
      title: row?.title ?? STORE_POLICY_TITLES[slug],
      content: row?.content ?? "",
    };
  });
}

// ---------------------------------------------------------------------------
// Time-zone helpers for the Analytics chart.
//
// Days and months are bucketed in Asia/Karachi, never in the server's zone, so
// the chart matches the day the shop actually sees an order on. The key format
// is ISO (`YYYY-MM-DD`), which is sortable, and `Intl` does the conversion so
// there is no offset arithmetic to get wrong.
// ---------------------------------------------------------------------------

const STORE_TIME_ZONE = "Asia/Karachi";

const DAY_KEY_FORMAT = new Intl.DateTimeFormat("en-CA", {
  timeZone: STORE_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** The store's calendar day for a moment in time, e.g. "2026-10-05". */
function dayKey(at: Date): string {
  return DAY_KEY_FORMAT.format(at);
}

/** Moves a day key by whole days. */
function shiftDayKey(key: string, days: number): string {
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);

  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

/** Moves a month key (`YYYY-MM`) by whole months. */
function shiftMonthKey(key: string, months: number): string {
  const [year, month] = key.split("-").map(Number);
  const total = year * 12 + (month - 1) + months;
  const targetYear = Math.floor(total / 12);
  const targetMonth = total - targetYear * 12 + 1;

  return `${targetYear}-${pad2(targetMonth)}`;
}

/** "Oct 5" — a day's label on the chart's x-axis. */
function dayLabel(key: string): string {
  const [year, month, day] = key.split("-").map(Number);

  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
  });
}

/** "Oct 25" — a month's label on the chart's x-axis. */
function monthLabel(key: string): string {
  const [year, month] = key.split("-").map(Number);

  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    year: "2-digit",
  });
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/** One point per day for the last `days` days, oldest first. */
function daySeries(
  salesByDay: ReadonlyMap<string, number>,
  days: number,
): AdminAnalyticsPoint[] {
  const today = dayKey(new Date());
  const points: AdminAnalyticsPoint[] = [];

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const key = shiftDayKey(today, -offset);
    points.push({ label: dayLabel(key), value: salesByDay.get(key) ?? 0 });
  }

  return points;
}

/** One point per month for the last `months` months, oldest first. */
function monthSeries(
  salesByMonth: ReadonlyMap<string, number>,
  months: number,
): AdminAnalyticsPoint[] {
  const current = dayKey(new Date()).slice(0, 7);
  const points: AdminAnalyticsPoint[] = [];

  for (let offset = months - 1; offset >= 0; offset -= 1) {
    const key = shiftMonthKey(current, -offset);
    points.push({ label: monthLabel(key), value: salesByMonth.get(key) ?? 0 });
  }

  return points;
}