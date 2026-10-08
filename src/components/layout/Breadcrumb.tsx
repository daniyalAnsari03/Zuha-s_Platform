import Link from "next/link";
import { Fragment } from "react";

export type BreadcrumbItem = {
  label: string;
  /** Omitted on the last crumb, which is plain text. */
  href?: string;
};

type BreadcrumbProps = {
  items: BreadcrumbItem[];
  className?: string;
};

/**
 * The standard trail: small uppercase text with ">" separators, every crumb but
 * the last linking to its page.
 *
 * Shared by the product listing and the wishlist page so the two can never drift
 * apart.
 */
export default function Breadcrumb({ items, className }: BreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] tracking-[0.16em] uppercase sm:text-xs">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <Fragment key={`${item.label}-${index}`}>
              {index > 0 ? (
                <li aria-hidden="true" className="text-black/25">
                  &gt;
                </li>
              ) : null}

              <li
                aria-current={isLast ? "page" : undefined}
                className={isLast ? "text-black" : undefined}
              >
                {item.href ? (
                  <Link
                    href={item.href}
                    className="text-black/50 transition-colors hover:text-plum focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum"
                  >
                    {item.label}
                  </Link>
                ) : (
                  item.label
                )}
              </li>
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}