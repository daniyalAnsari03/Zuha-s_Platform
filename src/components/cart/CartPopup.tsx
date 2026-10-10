"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import type { RefObject } from "react";

import { useCart } from "@/components/cart/CartProvider";
import Price from "@/components/currency/Price";
import { CloseIcon } from "@/components/icons";
import FadeInImage from "@/components/ui/FadeInImage";
import NavbarPopover from "@/components/layout/NavbarPopover";
import { IMAGE_QUALITY } from "@/lib/images";
import {
  MOTION_DURATION,
  fadeUpVariant,
  staggerContainer,
} from "@/lib/motion";
import { cartItemKey } from "@/lib/cart";

type CartPopupProps = {
  open: boolean;
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
};

/** Matches the thumbnail's width at each step, not its height. */
const THUMB_SIZES = "(max-width: 639px) 3.375rem, 3.9375rem";

/**
 * The cart as a popup hanging below the navbar - deliberately not a page, so the
 * customer can check the bag from wherever they were browsing.
 *
 * Every line carries its own quantity stepper and a remove button, and the
 * footer shows the total plus the checkout button. Each line stores the
 * effective price captured when it was added, so the total needs no catalog
 * lookup. The checkout page re-prices everything server-side, so a price that
 * changed since the item was added is corrected on the way through.
 */
export default function CartPopup({ open, onClose, anchorRef }: CartPopupProps) {
  const { items, count, subtotal, hydrated, increment, decrement, removeItem } =
    useCart();

  return (
    <NavbarPopover open={open} onClose={onClose} anchorRef={anchorRef} label="Cart">
      <header className="flex items-center justify-between gap-4 border-b border-black/10 px-4 py-3 sm:px-6 sm:py-4">
        <h2 className="text-sm font-semibold tracking-[0.2em] uppercase">
          Your Cart
          {count > 0 ? (
            <span className="ml-2 text-xs font-normal tracking-normal text-black/50">
              {count} {count === 1 ? "item" : "items"}
            </span>
          ) : null}
        </h2>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close cart"
          className="flex h-11 w-11 shrink-0 items-center justify-center text-black transition-colors hover:text-plum focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum"
        >
          <CloseIcon />
        </button>
      </header>

      {!hydrated ? (
        <p className="px-4 py-8 text-center text-sm text-black/50 sm:px-6">
          Loading your cart...
        </p>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-4 px-4 py-10 text-center sm:px-6">
          <p className="text-sm text-black/60">Your cart is empty.</p>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 border border-plum px-6 text-xs tracking-[0.16em] text-plum uppercase transition-colors hover:bg-plum hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum"
          >
            Continue shopping
          </button>
        </div>
      ) : (
        <>
          <motion.ul
            variants={staggerContainer(MOTION_DURATION.popupItemStagger)}
            initial="hidden"
            animate="show"
            className="divide-y divide-black/10"
          >
            {items.map((item) => {
              const key = cartItemKey(item.productId, item.size, item.color);

              return (
                <motion.li
                  key={key}
                  variants={fadeUpVariant}
                  className="flex gap-3 px-4 py-4 sm:gap-4 sm:px-6"
                >
                  <div className="relative h-[4.5rem] w-[3.375rem] shrink-0 overflow-hidden bg-black/5 sm:h-[5.25rem] sm:w-[3.9375rem]">
                    {item.image ? (
                      <FadeInImage
                        src={item.image}
                        alt={item.name}
                        sizes={THUMB_SIZES}
                        quality={IMAGE_QUALITY}
                        className="object-cover"
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-[10px] tracking-[0.2em] text-black/30 uppercase">
                        No image
                      </span>
                    )}
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{item.name}</p>
                        {item.size || item.color ? (
                          <p className="mt-0.5 text-xs text-black/50">
                            {item.size ? `Size: ${item.size}` : null}
                            {item.size && item.color ? " · " : null}
                            {item.color ? `Colour: ${item.color}` : null}
                          </p>
                        ) : null}
                      </div>

                      <button
                        type="button"
                        onClick={() => removeItem(key)}
                        aria-label={`Remove ${item.name} from cart`}
                        className="shrink-0 p-2 text-black/40 transition-colors hover:text-plum focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum"
                      >
                        <CloseIcon width={16} height={16} />
                      </button>
                    </div>

                    <div className="mt-auto flex items-center justify-between gap-3">
                      <div className="flex items-center border border-black/15">
                        <button
                          type="button"
                          onClick={() => decrement(key)}
                          aria-label={`Decrease quantity of ${item.name}`}
                          className="flex h-11 w-11 items-center justify-center text-base transition-colors hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum"
                        >
                          -
                        </button>
                        <span className="flex h-11 min-w-10 items-center justify-center px-1 text-xs">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => increment(key)}
                          aria-label={`Increase quantity of ${item.name}`}
                          className="flex h-11 w-11 items-center justify-center text-base transition-colors hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum"
                        >
                          +
                        </button>
                      </div>

                      <Price
                        amount={item.price * item.quantity}
                        className="text-sm font-medium"
                      />
                    </div>
                  </div>
                </motion.li>
              );
            })}
          </motion.ul>

          <footer className="flex flex-col gap-3 border-t border-black/10 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p className="text-sm">
              <span className="text-black/50">Total</span>{" "}
              <Price amount={subtotal} className="ml-2 font-medium" />
            </p>

            <Link
              href="/checkout"
              onClick={onClose}
              className="inline-flex min-h-11 items-center justify-center bg-plum px-8 text-xs tracking-[0.16em] text-white uppercase transition-colors hover:bg-plum-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum"
            >
              Checkout
            </Link>
          </footer>
        </>
      )}
    </NavbarPopover>
  );
}