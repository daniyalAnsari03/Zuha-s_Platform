"use client";

import { useState, useTransition } from "react";

import { ADMIN_INPUT_CLASS } from "@/components/admin/admin-fields";
import { updateOrderStatus } from "@/lib/admin/orders";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/order-types";
import { cn } from "@/lib/utils";

/**
 * The order-status dropdown on the detail screen.
 *
 * Picking a status calls the server action straight away — there is nothing
 * else on this control to save — and the action's own message is what the
 * admin reads back, whether it succeeded or was refused. The action revalidates
 * this route immediately, so the badge beside the dropdown is re-rendered from
 * the action's response and always matches what the database holds.
 *
 * Customers have no path to this code: migration 006 left `orders` UPDATE to
 * the service role and `requireAdmin()` gates the action itself.
 */
export default function OrderStatusControl({
  orderId,
  currentStatus,
}: {
  orderId: string;
  currentStatus: OrderStatus;
}) {
  const [status, setStatus] = useState<OrderStatus>(currentStatus);
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const [pending, startTransition] = useTransition();

  const change = (next: OrderStatus) => {
    if (next === status) return;

    setStatus(next);
    setFeedback(null);

    startTransition(async () => {
      const result = await updateOrderStatus({ orderId, status: next });

      if (!result.ok) {
        // The select already moved, so put the old value back on screen.
        setStatus(currentStatus);
        setFeedback({ tone: "error", message: result.error });
        return;
      }

      setFeedback({ tone: "success", message: result.message });
    });
  };

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor="order-status"
        className="block text-xs tracking-[0.16em] text-black/60 uppercase"
      >
        Status
      </label>

      <select
        id="order-status"
        value={status}
        disabled={pending}
        onChange={(event) => change(event.target.value as OrderStatus)}
        className={cn(
          ADMIN_INPUT_CLASS,
          "cursor-pointer sm:max-w-64",
          pending && "opacity-60",
        )}
      >
        {ORDER_STATUSES.map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </select>

      {pending ? (
        <p role="status" className="text-xs text-black/50">
          Saving&hellip;
        </p>
      ) : null}

      {feedback ? (
        <p
          role={feedback.tone === "error" ? "alert" : "status"}
          className={cn(
            "text-xs",
            feedback.tone === "error" ? "text-plum" : "text-black/50",
          )}
        >
          {feedback.message}
        </p>
      ) : null}
    </div>
  );
}
