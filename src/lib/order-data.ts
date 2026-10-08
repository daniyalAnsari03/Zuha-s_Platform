/**
 * Server-side order readers.
 *
 * Two different clients are used on purpose:
 *
 *  - the confirmation page reads through the service-role client and asks only
 *    for the columns it is allowed to show. No name, phone, address or email is
 *    ever selected here, so a guessed order number cannot leak any of it. It
 *    also requires the order's `confirmation_token`, checked in constant time,
 *    so an order number on its own is not enough to open the page at all.
 *  - "My Orders" runs as the signed-in shopper, so it uses the cookie-scoped
 *    client and the RLS policies from migration 001
 *    (`user_id = auth.uid() or is_admin()`) do the work. The explicit
 *    `user_id` filter is a second lock on the same door.
 */

import { timingSafeEqual } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { isOrderStatus, type OrderStatus } from "@/lib/order-types";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

/** One order line, as both pages below display it. */
export type OrderLine = {
  productName: string;
  productSlug: string | null;
  /**
   * Snapshot of the product's current first gallery image, resolved at read
   * time so a placed order — which snapshots no art — can show a thumbnail for
   * as long as the product still exists.
   */
  imageUrl: string | null;
  /** The size the shopper chose, free text. */
  variant: string | null;
  /** The colour the shopper chose, free text. */
  color: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type OrderSummary = {
  orderNumber: string;
  status: OrderStatus;
  createdAt: string;
  subtotal: number;
  total: number;
  items: OrderLine[];
};

/**
 * Everything the confirmation page is allowed to know about an order.
 *
 * Note what is missing: the shopper's name, email, phone and address. An order
 * number is guessable, so this shape is what gets rendered after checkout.
 */
export type OrderConfirmation = OrderSummary;

export type CustomerOrder = {
  orderNumber: string;
  createdAt: string;
  status: OrderStatus;
  total: number;
};

/** The full detail a signed-in shopper may see on their own order. */
export type CustomerOrderDetail = OrderSummary & {
  customerName: string | null;
  customerEmail: string;
  customerPhone: string | null;
  shippingAddress: string | null;
  shippingCity: string | null;
  /** True only when the shopper is on this order, i.e. RLS let it through. */
  isOwner: boolean;
};

type ItemRow = {
  product_name: string;
  product_slug: string | null;
  variant: string | null;
  color: string | null;
  quantity: number;
  unit_price: number;
  line_total: number;
};

const ITEM_COLUMNS =
  "product_name, product_slug, variant, color, quantity, unit_price, line_total";

function toLines(rows: ItemRow[] | null): OrderLine[] {
  return (rows ?? []).map((row) => ({
    productName: row.product_name,
    productSlug: row.product_slug,
    imageUrl: null,
    variant: row.variant,
    color: row.color,
    quantity: Number(row.quantity),
    unitPrice: Number(row.unit_price),
    lineTotal: Number(row.line_total),
  }));
}

type ImageClient = Pick<SupabaseClient<Database>, "from">;

/**
 * Fills each line's `imageUrl` from the product's current first gallery image.
 *
 * The order line only snapshots the slug, not the art, so the thumbnail is
 * resolved here against `products` — newest art for a still-listed product,
 * null once the product is gone. One batched query per order, never an image
 * round-trip per line.
 */
async function attachImages(
  lines: OrderLine[],
  client: ImageClient,
): Promise<OrderLine[]> {
  const slugs = Array.from(
    new Set(
      lines
        .map((line) => line.productSlug)
        .filter((slug): slug is string => slug !== null),
    ),
  );

  if (slugs.length === 0) return lines;

  const { data } = await client
    .from("products")
    .select("slug, images")
    .in("slug", slugs);

  const firstImage = new Map<string, string | null>(
    (data ?? []).map((row) => [row.slug, row.images[0] ?? null]),
  );

  return lines.map((line) => ({
    ...line,
    imageUrl: line.productSlug ? (firstImage.get(line.productSlug) ?? null) : null,
  }));
}

function toStatus(value: string): OrderStatus {
  // The column is the `order_status` enum, so an unknown value can only mean the
  // database and this build disagree. Showing the raw string beats crashing.
  return isOrderStatus(value) ? value : "Order Placed";
}

/**
 * Compares the link's token with the one stored on the order in constant time.
 *
 * A mismatch in length — including a null stored token, i.e. an order placed
 * before migration 012 — fails without ever touching the contents, so timing
 * says nothing about which byte was wrong.
 */
function confirmationTokenMatches(provided: string, stored: string | null): boolean {
  if (stored === null || provided.length !== stored.length) return false;

  return timingSafeEqual(Buffer.from(provided, "utf8"), Buffer.from(stored, "utf8"));
}

/**
 * The order behind a confirmation link, or null when either the number is
 * unknown or the token does not match.
 *
 * The two failures return the same null on purpose: the caller renders one
 * not-found for both, so the page never reveals whether an order number exists.
 * The `id` is needed to fetch the lines but is never part of the returned shape.
 */
export async function getOrderConfirmation(
  orderNumber: string,
  token: string,
): Promise<OrderConfirmation | null> {
  const admin = createAdminClient();

  const { data: order, error } = await admin
    .from("orders")
    .select(
      "id, order_number, status, created_at, subtotal, total, confirmation_token",
    )
    .eq("order_number", orderNumber)
    .maybeSingle();

  if (error || !order) return null;

  if (!confirmationTokenMatches(token, order.confirmation_token)) return null;

  const { data: items } = await admin
    .from("order_items")
    .select(ITEM_COLUMNS)
    .eq("order_id", order.id)
    .order("created_at", { ascending: true });

  return {
    orderNumber: order.order_number,
    status: toStatus(order.status),
    createdAt: order.created_at,
    subtotal: Number(order.subtotal),
    total: Number(order.total),
    items: await attachImages(toLines(items), admin),
  };
}

/**
 * The signed-in shopper's orders, newest first.
 *
 * Empty for a guest, so the caller can decide between rendering an empty list and
 * redirecting to the login page.
 */
export async function getCustomerOrders(): Promise<CustomerOrder[]> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data } = await supabase
    .from("orders")
    .select("order_number, created_at, status, total")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (data ?? []).map((row) => ({
    orderNumber: row.order_number,
    createdAt: row.created_at,
    status: toStatus(row.status),
    total: Number(row.total),
  }));
}

/**
 * One of the signed-in shopper's orders, with its lines and the delivery details
 * they are allowed to see.
 *
 * Returns null for someone else's order exactly as it does for a number that does
 * not exist — RLS filters the row out before the query can see it, so the two
 * cases are indistinguishable from the outside.
 */
export async function getCustomerOrderDetail(
  orderNumber: string,
): Promise<CustomerOrderDetail | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: order } = await supabase
    .from("orders")
    .select(
      "id, order_number, status, created_at, subtotal, total, customer_name, customer_email, customer_phone, shipping_address, shipping_city, user_id",
    )
    .eq("order_number", orderNumber)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!order) return null;

  const { data: items } = await supabase
    .from("order_items")
    .select(ITEM_COLUMNS)
    .eq("order_id", order.id)
    .order("created_at", { ascending: true });

  return {
    orderNumber: order.order_number,
    status: toStatus(order.status),
    createdAt: order.created_at,
    subtotal: Number(order.subtotal),
    total: Number(order.total),
    items: await attachImages(toLines(items), supabase),
    customerName: order.customer_name,
    customerEmail: order.customer_email,
    customerPhone: order.customer_phone,
    shippingAddress: order.shipping_address,
    shippingCity: order.shipping_city,
    isOwner: order.user_id === user.id,
  };
}