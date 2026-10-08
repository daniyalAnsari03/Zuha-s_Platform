"use server";

/**
 * The only way an order can be created.
 *
 * SECURITY DESIGN (Phase 7)
 * -------------------------
 * This is a server action, so it runs on the server and is the single entry point
 * for placing an order. It uses the service-role key, which lives only in
 * `.env.local` without a `NEXT_PUBLIC_` prefix and therefore never reaches the
 * browser bundle.
 *
 * The browser sends product ids, sizes, colours and quantities — and nothing
 * else that matters. Prices, the order number and the totals are all produced
 * here:
 *
 *  - every product is re-read from `products`, so a tampered payload cannot set a
 *    price, and a product whose discount changed since it was added to the cart
 *    is charged the current one;
 *  - a missing, inactive or size/colour-mismatched product aborts the whole order;
 *  - `generate_order_number()` (migration 006) mints the order number from a
 *    sequence, so it can neither collide nor be guessed from a previous one;
 *  - a 32-byte random `confirmation_token` is stored on the order, so the
 *    confirmation page can require a secret the order number does not reveal;
 *  - only `service_role` may insert into `orders` / `order_items` / `customers`
 *    (migration 006), so nothing here is reachable from the browser's key.
 *
 * `user_id` is stamped when the shopper is signed in and left null for a guest;
 * login is never required to order.
 */

import { randomBytes } from "node:crypto";

import {
  MAX_LINE_QUANTITY,
  MAX_ORDER_LINES,
  PAYMENT_METHOD,
  validateCheckoutField,
  type CheckoutField,
  type PlaceOrderPayload,
  type PlaceOrderResult,
} from "@/lib/order-types";
import { effectivePrice, parseOptionList } from "@/lib/products";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type AdminClient = ReturnType<typeof createAdminClient>;

/** What the shopper submitted, trimmed and checked. */
type ContactDetails = {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
};

/** One requested line, before any price is known. */
type RequestedLine = {
  productId: string;
  size: string | null;
  color: string | null;
  quantity: number;
};

/** The product columns needed to price and label a line. Nothing more. */
const PRODUCT_COLUMNS =
  "id, name, slug, price, discount_price, sizes, color, is_active";

/**
 * A row of {@link PRODUCT_COLUMNS}. Declared here so the pricing helpers are
 * checked at compile time instead of taking an untyped query result.
 */
type SellableProduct = {
  id: string;
  name: string;
  slug: string;
  price: number;
  discount_price: number | null;
  sizes: string | null;
  color: string | null;
  is_active: boolean;
};

const CONTACT_FIELDS: readonly CheckoutField[] = [
  "name",
  "email",
  "phone",
  "address",
  "city",
];

/**
 * A refusal the shopper is meant to read and act on ("please choose a size").
 *
 * Anything else — a missing env var, a Supabase or Postgres error message — is
 * deliberately *not* an `OrderRejected`: those are logged on the server and shown
 * as the generic fallback below, so an internal failure never narrates the
 * database back to the browser.
 */
class OrderRejected extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrderRejected";
  }
}

const GENERIC_FAILURE =
  "We could not place your order. Please try again in a moment.";

export async function placeOrder(payload: PlaceOrderPayload): Promise<PlaceOrderResult> {
  try {
    // Throws loudly when the server-only env is missing, rather than silently
    // writing an order with no owner.
    const admin = createAdminClient();

    const details = readContactDetails(payload);
    const lines = readRequestedLines(payload?.items);
    const products = await loadSellableProducts(admin, lines);
    const { items, subtotal } = priceLines(lines, products);

    const userId = await currentUserId();
    const customerId = await resolveCustomerId(admin, details, userId);
    const orderNumber = await nextOrderNumber(admin);
    const confirmationToken = newConfirmationToken();

    const { data: order, error: orderError } = await admin
      .from("orders")
      .insert({
        order_number: orderNumber,
        customer_id: customerId,
        user_id: userId,
        guest_token: null,
        confirmation_token: confirmationToken,
        status: "Order Placed",
        customer_email: details.email,
        customer_name: details.name,
        customer_phone: details.phone,
        shipping_address: details.address,
        shipping_city: details.city,
        // Not collected at checkout: the form asks for name, address, phone,
        // email and city, and nothing else.
        shipping_state: null,
        shipping_postal_code: null,
        shipping_country: null,
        shipping_method: PAYMENT_METHOD,
        subtotal,
        shipping_fee: 0,
        discount: 0,
        total: subtotal,
        payment_method: PAYMENT_METHOD,
        payment_reference: null,
        is_paid: false,
        notes: null,
        admin_notes: null,
      })
      .select("id")
      .single();

    if (orderError || !order) {
      console.error("[orders] could not insert the order.", orderError);
      throw new Error(GENERIC_FAILURE);
    }

    let { error: itemsError } = await admin
      .from("order_items")
      .insert(items.map((item) => ({ ...item, order_id: order.id })));

    /*
     * `order_items.color` is added by migration 009. If it has not been applied
     * yet the insert fails on an unknown column, so the colour is dropped once
     * and the order still goes through instead of checkout going down. The
     * warning tells whoever is looking at the log exactly which file to run.
     */
    if (itemsError && isMissingOrderColorColumnError(itemsError)) {
      console.warn(
        "[orders] order_items.color is missing; apply supabase/migrations/009_order_item_color.sql to store colours.",
      );

      const retried = await admin
        .from("order_items")
        .insert(
          items.map((item) => ({
            ...withoutColor(item),
            order_id: order.id,
            // The column really is absent on a pre-009 database, so this shape
            // is legal only there — hence the deliberate cast around a half row.
          } as unknown as Database["public"]["Tables"]["order_items"]["Insert"])),
        );

      itemsError = retried.error;
    }

    if (itemsError) {
      // Never leave an order row without its lines behind: the admin would see a
      // placed order worth money that contains nothing.
      console.error(
        `[orders] could not insert the items for ${orderNumber}; removing the order.`,
        itemsError,
      );
      await admin.from("orders").delete().eq("id", order.id);
      throw new Error(GENERIC_FAILURE);
    }

    return { ok: true, orderNumber, token: confirmationToken };
  } catch (error) {
    // Only a refusal the shopper can act on is echoed back. Everything else is
    // logged here and reported as the generic message.
    if (error instanceof OrderRejected) {
      return { ok: false, message: error.message };
    }

    console.error("[orders] placeOrder failed.", error);

    return { ok: false, message: GENERIC_FAILURE };
  }
}

// -----------------------------------------------------------------------------
// Input: everything that came from the browser is treated as untrusted
// -----------------------------------------------------------------------------

function trimmed(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Runs the same rules the form runs, so a request built by hand (or a stale tab
 * that skipped the client validation) is rejected with the same message a
 * customer would have seen anyway.
 */
function readContactDetails(payload: PlaceOrderPayload): ContactDetails {
  const details = {
    name: trimmed(payload?.name),
    email: trimmed(payload?.email),
    phone: trimmed(payload?.phone),
    address: trimmed(payload?.address),
    city: trimmed(payload?.city),
  };

  for (const field of CONTACT_FIELDS) {
    const problem = validateCheckoutField(field, details[field]);
    if (problem) throw new OrderRejected(problem);
  }

  return details;
}

function readRequestedLines(input: unknown): RequestedLine[] {
  if (!Array.isArray(input) || input.length === 0) {
    throw new OrderRejected("There is nothing in your cart to order.");
  }

  if (input.length > MAX_ORDER_LINES) {
    throw new OrderRejected("Please split this into more than one order.");
  }

  return input.map((entry) => {
    const raw = (entry ?? {}) as Partial<PlaceOrderPayload["items"][number]>;
    const productId = trimmed(raw.productId);
    const quantity = Number(raw.quantity);

    if (!productId) {
      throw new OrderRejected("One of the items in your cart is no longer available.");
    }

    if (
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > MAX_LINE_QUANTITY
    ) {
      throw new OrderRejected(
        `Please choose a quantity between 1 and ${MAX_LINE_QUANTITY} for every item.`,
      );
    }

    return {
      productId,
      size: trimmed(raw.size) || null,
      color: trimmed(raw.color) || null,
      quantity,
    };
  });
}

// -----------------------------------------------------------------------------
// Catalog: the only source of prices
// -----------------------------------------------------------------------------

async function loadSellableProducts(
  admin: AdminClient,
  lines: RequestedLine[],
): Promise<Map<string, SellableProduct>> {
  const ids = Array.from(new Set(lines.map((line) => line.productId)));

  const { data, error } = await admin
    .from("products")
    .select(PRODUCT_COLUMNS)
    .in("id", ids);

  if (error) {
    throw new Error("We could not load your items. Please try again.");
  }

  const rows = data ?? [];

  // A count mismatch means at least one id is gone or was never a product.
  if (rows.length !== ids.length) {
    throw new OrderRejected("One or more items in your cart are no longer available.");
  }

  const unavailable = rows.find((row) => !row.is_active);
  if (unavailable) {
    throw new OrderRejected(`${unavailable.name} is no longer available.`);
  }

  return new Map(rows.map((row) => [row.id, row]));
}

/** What a product sells for right now: its discount price when it has one. */
function currentUnitPrice(row: SellableProduct): number {
  return effectivePrice({
    price: Number(row.price),
    discountPrice: row.discount_price === null ? null : Number(row.discount_price),
  });
}

function round(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/** One priced line, exactly as it is inserted into `order_items`. */
type PricedOrderItem = {
  product_id: string;
  product_name: string;
  product_slug: string;
  variant: string | null;
  color: string | null;
  unit_price: number;
  quantity: number;
  line_total: number;
};

/**
 * Turns the requested lines into order items, calculating every amount here.
 *
 * A product the admin gave sizes or colours to must be ordered in one of those
 * options, which is checked against the product's own free-text list rather
 * than trusted from the request.
 */
function priceLines(lines: RequestedLine[], products: Map<string, SellableProduct>) {
  const items: PricedOrderItem[] = [];

  let subtotal = 0;

  for (const line of lines) {
    const row = products.get(line.productId);
    if (!row) {
      throw new OrderRejected("One or more items in your cart are no longer available.");
    }

    const sizes = parseOptionList(row.sizes);
    if (sizes.length > 0) {
      const matches =
        line.size !== null &&
        sizes.some((size) => size.toLowerCase() === line.size!.toLowerCase());

      if (!matches) {
        throw new OrderRejected(`Please choose a size for ${row.name}.`);
      }
    }

    const colors = parseOptionList(row.color);
    if (colors.length > 0) {
      const matches =
        line.color !== null &&
        colors.some((color) => color.toLowerCase() === line.color!.toLowerCase());

      if (!matches) {
        throw new OrderRejected(`Please choose a color for ${row.name}.`);
      }
    }

    const unitPrice = currentUnitPrice(row);
    const lineTotal = round(unitPrice * line.quantity);
    subtotal = round(subtotal + lineTotal);

    items.push({
      product_id: row.id,
      product_name: row.name,
      product_slug: row.slug,
      variant: line.size,
      color: colors.length > 0 ? line.color : null,
      unit_price: unitPrice,
      quantity: line.quantity,
      line_total: lineTotal,
    });
  }

  return { items, subtotal };
}

/**
 * True when the insert failed only because `order_items.color` does not exist —
 * i.e. migration 009 has not been applied yet. Code 42703 is Postgres's
 * "undefined column"; the message is checked too so a rename or a different
 * missing column is not mistaken for this one.
 */
function isMissingOrderColorColumnError(error: {
  message: string;
}): boolean {
  // Only the exact missing-column message counts. A bare 42703 could be any
  // undefined column; misreading it would strip a field from an otherwise
  // valid insert for nothing.
  return /column "color" of relation "order_items" does not exist/.test(
    error.message,
  );
}

/** The same row minus the `color` field, for an order_items table without it. */
function withoutColor(item: PricedOrderItem): Omit<PricedOrderItem, "color"> {
  return {
    product_id: item.product_id,
    product_name: item.product_name,
    product_slug: item.product_slug,
    variant: item.variant,
    unit_price: item.unit_price,
    quantity: item.quantity,
    line_total: item.line_total,
  };
}

/**
 * The secret the confirmation link carries, minted here and nowhere else.
 *
 * 32 bytes of CSPRNG output, base64url-encoded so it survives a URL untouched,
 * is far too large to guess and is never shown as the order number. It is
 * stored on the order and required again by the confirmation page.
 */
function newConfirmationToken(): string {
  return randomBytes(32).toString("base64url");
}

async function nextOrderNumber(admin: AdminClient): Promise<string> {
  const { data, error } = await admin.rpc("generate_order_number");

  if (error) {
    console.error("[orders] generate_order_number failed.", error);
    throw new Error(GENERIC_FAILURE);
  }

  if (typeof data !== "string" || !data) {
    throw new Error(GENERIC_FAILURE);
  }

  return data;
}

// -----------------------------------------------------------------------------
// Customer: one row per shopper, as `customers` is modelled in migration 001
// -----------------------------------------------------------------------------

/**
 * The signed-in shopper's id, or null for a guest.
 *
 * Checkout must work without an account, so an auth failure here is reported and
 * downgraded to a guest order rather than blocking the purchase.
 */
async function currentUserId(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    return user?.id ?? null;
  } catch (error) {
    console.error(
      "[orders] could not read the session; placing the order as a guest.",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

async function findCustomerId(
  admin: AdminClient,
  match: { byUser: string } | { byEmail: string },
): Promise<string | null> {
  const query =
    "byUser" in match
      ? admin.from("customers").select("id").eq("user_id", match.byUser).limit(1)
      : admin
          .from("customers")
          .select("id")
          .eq("email", match.byEmail)
          .is("user_id", null)
          .limit(1);

  const { data, error } = await query;
  if (error || !data || data.length === 0) return null;

  return data[0].id;
}

/**
 * Finds or creates the `customers` row for this shopper and keeps their contact
 * details on it up to date.
 *
 * `customers.user_id` is unique in migration 001, so a signed-in shopper always
 * resolves to the same row. Before that, the same email may have checked out as a
 * guest; that row is adopted rather than duplicated, so one person never ends up
 * with two profiles. A failure here never blocks the order — `customer_id` simply
 * stays null, exactly as it would for a guest with no profile yet.
 */
async function resolveCustomerId(
  admin: AdminClient,
  details: ContactDetails,
  userId: string | null,
): Promise<string | null> {
  const email = details.email.toLowerCase();
  const profile = {
    email,
    full_name: details.name,
    phone: details.phone,
    address_line1: details.address,
    // Only filled in by the admin dashboard (Phase 9); a checkout never sets them.
    address_line2: null,
    city: details.city,
    state: null,
    postal_code: null,
    country: null,
    is_guest: userId === null,
  };

  try {
    if (userId) {
      const existing = await findCustomerId(admin, { byUser: userId });
      if (existing) {
        await admin.from("customers").update(profile).eq("id", existing);
        return existing;
      }
    }

    const guestRow = await findCustomerId(admin, { byEmail: email });
    if (guestRow) {
      await admin
        .from("customers")
        .update({ ...profile, is_guest: userId === null, user_id: userId })
        .eq("id", guestRow);
      return guestRow;
    }

    const { data, error } = await admin
      .from("customers")
      .insert({ ...profile, user_id: userId })
      .select("id")
      .single();

    return error || !data ? null : data.id;
  } catch (error) {
    console.error(
      "[orders] could not resolve the customer row; the order keeps a null customer_id.",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}