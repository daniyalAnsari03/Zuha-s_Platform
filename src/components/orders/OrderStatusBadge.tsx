import { CLOSED_ORDER_STATUSES, type OrderStatus } from "@/lib/order-types";
import { cn } from "@/lib/utils";

/**
 * An order status as a square plum-outlined label.
 *
 * A closed order (delivered or cancelled) drops to plain grey so the orders still
 * moving are the ones that catch the eye.
 */
export default function OrderStatusBadge({
  status,
  className,
}: {
  status: OrderStatus;
  className?: string;
}) {
  const closed = CLOSED_ORDER_STATUSES.includes(status);

  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-1 text-[11px] tracking-[0.16em] uppercase",
        closed
          ? "border border-black/15 text-black/50"
          : "border border-plum text-plum",
        className,
      )}
    >
      {status}
    </span>
  );
}