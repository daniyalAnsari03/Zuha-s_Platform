import FadeInImage from "@/components/ui/FadeInImage";
import { formatAmount } from "@/lib/order-types";
import { IMAGE_QUALITY } from "@/lib/images";
import { cn } from "@/lib/utils";

export type OrderLineView = {
  /** React key; stable across re-renders. */
  key: string;
  name: string;
  /** First gallery image. Absent on a placed order, which snapshots no art. */
  image?: string | null;
  /** The size the shopper chose, free text as the admin typed it. */
  variant?: string | null;
  /** The colour the shopper chose, free text as the admin typed it. */
  color?: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

type OrderSummaryCardProps = {
  lines: OrderLineView[];
  subtotal: number;
  total: number;
  /** Hidden where the totals are already shown next to the card. */
  showTotals?: boolean;
  className?: string;
};

/** Matches the thumbnail's width at each step, not its height. */
const THUMB_SIZES = "(max-width: 639px) 3.375rem, 3.75rem";

/**
 * The order lines and the money, shown wherever an order is displayed: the
 * checkout summary, the confirmation page and "My Orders".
 *
 * One component for all three so the three can never disagree about what a line
 * looks like. Square throughout — no rounded corners, borders or shadows on the
 * card or its rows — matching the listing cards.
 */
export default function OrderSummaryCard({
  lines,
  subtotal,
  total,
  showTotals = true,
  className,
}: OrderSummaryCardProps) {
  return (
    <div className={cn("w-full", className)}>
      <ul className="divide-y divide-black/10">
        {lines.map((line) => (
          <li key={line.key} className="flex gap-3 py-4 first:pt-0 sm:gap-4">
            {line.image ? (
              <div className="relative h-[4.5rem] w-[3.375rem] shrink-0 overflow-hidden bg-black/5 sm:h-20 sm:w-15">
                <FadeInImage
                  src={line.image}
                  alt={line.name}
                  sizes={THUMB_SIZES}
                  quality={IMAGE_QUALITY}
                  className="object-cover"
                />
              </div>
            ) : null}

            <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm leading-snug">{line.name}</p>
                  {line.variant || line.color ? (
                    <p className="mt-0.5 text-xs text-black/50">
                      {[line.variant ? `Size: ${line.variant}` : null, line.color ? `Color: ${line.color}` : null]
                        .filter((part): part is string => part !== null)
                        .join(" · ")}
                    </p>
                  ) : null}
                </div>

                <p className="shrink-0 text-sm font-medium">
                  {formatAmount(line.lineTotal)}
                </p>
              </div>

              <p className="text-xs text-black/50">
                {formatAmount(line.unitPrice)} each &times; {line.quantity}
              </p>
            </div>
          </li>
        ))}
      </ul>

      {showTotals ? (
        <dl className="mt-2 space-y-2 border-t border-black/10 pt-4 text-sm">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-black/60">Subtotal</dt>
            <dd>{formatAmount(subtotal)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 text-base">
            <dt className="font-medium">Total</dt>
            <dd className="font-medium text-plum">{formatAmount(total)}</dd>
          </div>
        </dl>
      ) : null}
    </div>
  );
}