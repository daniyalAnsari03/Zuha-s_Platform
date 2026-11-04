"use server";

/**
 * Orders: the one thing the dashboard may change about an order — its status.
 *
 * Same contract as every other admin action: `requireAdmin()` first, the payload
 * re-validated here rather than trusted, the write on the service-role client.
 *
 * Customers never touch this. Migration 006 took away the shopper-side UPDATE
 * policy on `orders` (what is left is admin-only) and revoked the browser's
 * insert/update privileges outright, so the only path from a browser to a status
 * change is this action behind the guard.
 */

import { revalidatePath } from "next/cache";

import { getAdminDb } from "@/lib/admin/db";
import { requireAdmin } from "@/lib/admin/guard";
import { revalidateStorefront } from "@/lib/admin/revalidate";
import {
  actionFail,
  actionOk,
  readOptionalId,
  type ActionResult,
} from "@/lib/admin/validation";
import { isOrderStatus, type OrderStatus } from "@/lib/order-types";

/** Moves one order to another status. */
export async function updateOrderStatus(input: {
  orderId: unknown;
  status: unknown;
}): Promise<ActionResult> {
  await requireAdmin();

  const orderId = readOptionalId(input?.orderId);
  if (!orderId) return actionFail("That order no longer exists.");

  if (!isOrderStatus(input?.status)) {
    return actionFail("That is not a valid order status.");
  }

  const status: OrderStatus = input.status;
  const db = getAdminDb();

  const { data: order, error: readError } = await db
    .from("orders")
    .select("id, order_number, status")
    .eq("id", orderId)
    .maybeSingle();

  if (readError || !order) return actionFail("That order no longer exists.");

  if (order.status === status) {
    return actionOk(`Order ${order.order_number} is already “${status}”.`);
  }

  const { data: orderItems, error: itemsError } = await db
    .from("order_items")
    .select("product_id, product_name")
    .eq("order_id", orderId);

  if (itemsError) {
    console.error("[admin] could not read order items for stock update.", itemsError);
    return actionFail("Could not update the order status. Please try again.");
  }

  const { data: updatedOrders, error } = await db.rpc(
    "update_order_status_with_stock",
    { p_order_id: orderId, p_status: status },
  );

  if (error) {
    const stockRefusal = /^STOCK_REACTIVATE:([0-9a-f-]{36})$/i.exec(
      error.message,
    );
    if (stockRefusal) {
      const productName =
        orderItems?.find((item) => item.product_id === stockRefusal[1])
          ?.product_name ?? "a product in this order";
      return actionFail(`Not enough stock for ${productName}.`);
    }

    if (error.message === "ORDER_NOT_FOUND") {
      return actionFail("That order no longer exists.");
    }

    console.error("[admin] could not update the order status.", error);
    return actionFail("Could not update the order status. Please try again.");
  }

  const updatedOrder = updatedOrders?.[0];
  if (!updatedOrder) {
    return actionFail("Could not update the order status. Please try again.");
  }

  // The list, this order's detail page and the Dashboard home's status counts
  // all read the same status, while inventory and the storefront also reflect
  // any stock that was restored or deducted in the same database transaction.
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin");
  revalidatePath("/admin/inventory");
  revalidateStorefront({});

  return actionOk(`Order ${updatedOrder.order_number} is now “${updatedOrder.status}”.`);
}
