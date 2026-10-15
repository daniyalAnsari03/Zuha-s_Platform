import { renderBoldText } from "@/lib/bold-text";
import { cn } from "@/lib/utils";

/**
 * The product description, exactly as the admin typed it — used by BOTH the
 * product detail page and the Quick View modal (they share `ProductDetailContent`,
 * which is the only place on the storefront that renders this text).
 *
 * `whitespace-pre-line` keeps every line break and blank gap the admin wrote,
 * `break-words` + `overflow-wrap: anywhere` stop a long word from overflowing
 * on mobile, and `renderBoldText` turns each `**run**` into a `<strong>` as
 * React nodes — never `dangerouslySetInnerHTML`, so stored text can never
 * become markup.
 */
export default function FormattedDescription({
  description,
  className,
}: {
  description: string;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "max-w-prose min-w-0 break-words whitespace-pre-line text-sm leading-relaxed text-black/80 [overflow-wrap:anywhere] sm:text-base",
        className,
      )}
    >
      {renderBoldText(description)}
    </p>
  );
}
