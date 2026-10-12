"use client";

import { AnimatePresence, motion, type Variants } from "framer-motion";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentType,
  type SVGProps,
} from "react";

import { useCurrency } from "@/components/currency/CurrencyProvider";
import { ChevronDownIcon } from "@/components/icons";
import { CURRENCIES, type Currency } from "@/lib/currency";
import {
  TRANSITION_POPOVER,
  TRANSITION_POPUP_EXIT,
  chevronVariant,
} from "@/lib/motion";
import { cn } from "@/lib/utils";

/** The menu rises into place; the exit is the shared quick reverse. */
const MENU_VARIANTS: Variants = {
  hidden: { opacity: 0, y: 10, transition: TRANSITION_POPUP_EXIT },
  show: { opacity: 1, y: 0, transition: TRANSITION_POPOVER },
  exit: { opacity: 0, y: 10, transition: TRANSITION_POPUP_EXIT },
};

/** Each currency's flag, defined once and shared by the button and the menu. */
const FLAGS: Record<Currency, ComponentType> = {
  PKR: PakistanFlag,
  USD: UsaFlag,
  EUR: EuroFlag,
  GBP: UkFlag,
  AED: UaeFlag,
  CAD: CanadaFlag,
};

/**
 * The storefront's currency switcher: a small white pill fixed at the bottom
 * left of every storefront page (including the homepage and the footer slide),
 * never in `/admin`.
 *
 * It lists PKR plus every currency the admin has set a rate for (see
 * `src/lib/currency.ts`), and renders nothing at all when PKR is the only
 * option, because there is then nothing to switch to. The menu opens *upward*
 * above the button, scrolls if it grows past the viewport, closes on an outside
 * click and on Escape, and the chevron flips while it is open.
 *
 * It sits at `z-30`, below every popup/drawer/modal (the navbar's panels are
 * `z-40`, the drawers and quick view `z-50`), so it can never cover a dialog. On
 * mobile it is offset above the bottom safe area.
 */
export default function CurrencySwitcher() {
  const { currency, availableCurrencies, setCurrency } = useCurrency();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const close = useCallback((restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) buttonRef.current?.focus();
  }, []);

  // Outside click and Escape close the menu; an outside click just dismisses.
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && !containerRef.current?.contains(target)) setOpen(false);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close(true);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);

  // Move focus onto the current option so the keyboard lands inside the menu.
  useEffect(() => {
    if (!open) return;

    const frame = requestAnimationFrame(() => {
      const selected = menuRef.current?.querySelector<HTMLButtonElement>(
        '[aria-checked="true"]',
      );
      const first = menuRef.current?.querySelector<HTMLButtonElement>("button");
      (selected ?? first)?.focus();
    });

    return () => cancelAnimationFrame(frame);
  }, [open]);

  // PKR alone is not a choice: hide the switcher entirely.
  if (availableCurrencies.length <= 1) return null;

  const options = CURRENCIES.filter((code) =>
    availableCurrencies.includes(code),
  );
  const ActiveFlag = FLAGS[currency];

  return (
    <div
      ref={containerRef}
      className="fixed left-3 z-30 sm:left-4"
      style={{ bottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}
    >
      <div className="relative">
        <AnimatePresence>
          {open ? (
            <motion.div
              ref={menuRef}
              id={menuId}
              role="menu"
              aria-label="Currency"
              variants={MENU_VARIANTS}
              initial="hidden"
              animate="show"
              exit="exit"
              className="absolute bottom-full left-0 mb-2 max-h-[min(60vh,20rem)] w-40 overflow-y-auto overscroll-contain rounded-xl border border-black/10 bg-white p-1 shadow-[0_10px_30px_rgba(0,0,0,0.16)]"
            >
              {options.map((code) => {
                const selected = currency === code;
                const Flag = FLAGS[code];

                return (
                  <button
                    key={code}
                    type="button"
                    role="menuitemradio"
                    aria-checked={selected}
                    onClick={() => {
                      setCurrency(code);
                      close(true);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-plum",
                      selected
                        ? "bg-plum/5 font-medium text-plum"
                        : "text-black hover:bg-black/[0.04]",
                    )}
                  >
                    <Flag />
                    <span className="min-w-0 flex-1">{code}</span>
                    {selected ? (
                      <CheckIcon className="h-4 w-4 shrink-0" />
                    ) : null}
                  </button>
                );
              })}
            </motion.div>
          ) : null}
        </AnimatePresence>

        <button
          ref={buttonRef}
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={open ? menuId : undefined}
          aria-label={`Change currency, currently ${currency}`}
          onClick={() => setOpen((current) => !current)}
          className="flex min-h-11 items-center gap-2 rounded-full border border-black/10 bg-white py-1.5 pr-2.5 pl-3 text-xs font-medium tracking-[0.08em] text-black shadow-[0_2px_10px_rgba(0,0,0,0.18)] transition-colors hover:text-plum focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum"
        >
          <ActiveFlag />
          <span>{currency}</span>
          {/*
            The menu opens upward, so the chevron rests pointing *up* (the
            shared variant's "open" 180deg state) and swings down when the menu
            is open — the rotate token, reused rather than redefined.
          */}
          <motion.span
            variants={chevronVariant}
            animate={open ? "closed" : "open"}
            className="flex items-center"
          >
            <ChevronDownIcon className="h-4 w-4" />
          </motion.span>
        </button>
      </div>
    </div>
  );
}

/** A small tick beside the selected currency. */
function CheckIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="m5 12.5 4.5 4.5L19 7" />
    </svg>
  );
}

const FLAG_CLASS = "h-[14px] w-5 shrink-0 rounded-[2px]";
const FLAG_PROPS = {
  className: FLAG_CLASS,
  "aria-hidden": true,
  focusable: false,
} as const;

/** Pakistan: green field, white hoist stripe, crescent and star. */
function PakistanFlag() {
  return (
    <svg viewBox="0 0 20 14" {...FLAG_PROPS}>
      <rect width="20" height="14" fill="#01411C" />
      <rect width="5" height="14" fill="#FFFFFF" />
      <circle cx="13" cy="7" r="3.1" fill="#FFFFFF" />
      <circle cx="14.15" cy="7" r="3.1" fill="#01411C" />
      <path
        d="M15.5 5.1l.4 1.02 1.09.07-.84.7.27 1.06-.92-.6-.92.6.27-1.06-.84-.7 1.09-.07z"
        fill="#FFFFFF"
      />
    </svg>
  );
}

/** USA: thirteen stripes, blue canton with a scatter of stars. */
function UsaFlag() {
  const stripeHeight = 14 / 13;

  return (
    <svg viewBox="0 0 20 14" {...FLAG_PROPS}>
      <rect width="20" height="14" fill="#FFFFFF" />
      {[0, 2, 4, 6, 8, 10, 12].map((index) => (
        <rect
          key={index}
          y={index * stripeHeight}
          width="20"
          height={stripeHeight}
          fill="#B22234"
        />
      ))}
      <rect width="9" height={stripeHeight * 7} fill="#3C3B6E" />
      {[
        [1.5, 1.5],
        [3.5, 1.5],
        [5.5, 1.5],
        [7.5, 1.5],
        [2.5, 3.2],
        [4.5, 3.2],
        [6.5, 3.2],
        [1.5, 4.9],
        [3.5, 4.9],
        [5.5, 4.9],
        [7.5, 4.9],
      ].map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="0.5" fill="#FFFFFF" />
      ))}
    </svg>
  );
}

/** European Union: blue field, a ring of twelve gold stars. */
function EuroFlag() {
  const stars = Array.from({ length: 12 }, (_, index) => {
    const angle = (index * 30 - 90) * (Math.PI / 180);

    return {
      cx: 10 + Math.cos(angle) * 4.1,
      cy: 7 + Math.sin(angle) * 4.1,
    };
  });

  return (
    <svg viewBox="0 0 20 14" {...FLAG_PROPS}>
      <rect width="20" height="14" fill="#003399" />
      {stars.map((star, index) => (
        <circle key={index} cx={star.cx} cy={star.cy} r="0.62" fill="#FFCC00" />
      ))}
    </svg>
  );
}

/** United Kingdom: the Union Jack, simplified to its diagonals and cross. */
function UkFlag() {
  return (
    <svg viewBox="0 0 20 14" {...FLAG_PROPS}>
      <rect width="20" height="14" fill="#012169" />
      <path d="M0 0 20 14M20 0 0 14" stroke="#FFFFFF" strokeWidth="2.4" />
      <path d="M0 0 20 14M20 0 0 14" stroke="#C8102E" strokeWidth="1.1" />
      <path d="M10 0V14M0 7H20" stroke="#FFFFFF" strokeWidth="3.2" />
      <path d="M10 0V14M0 7H20" stroke="#C8102E" strokeWidth="1.8" />
    </svg>
  );
}

/** United Arab Emirates: red hoist bar, green/white/black horizontal bands. */
function UaeFlag() {
  return (
    <svg viewBox="0 0 20 14" {...FLAG_PROPS}>
      <rect width="20" height="14" fill="#FFFFFF" />
      <rect width="20" height="4.67" fill="#00732F" />
      <rect y="9.33" width="20" height="4.67" fill="#000000" />
      <rect width="5" height="14" fill="#FF0000" />
    </svg>
  );
}

/** Canada: red-white-red vertical bands with a red maple leaf. */
function CanadaFlag() {
  return (
    <svg viewBox="0 0 20 14" {...FLAG_PROPS}>
      <rect width="20" height="14" fill="#FFFFFF" />
      <rect width="5" height="14" fill="#FF0000" />
      <rect x="15" width="5" height="14" fill="#FF0000" />
      <path
        d="M10 2.2 11 4.2 13 4.6 12 5.6 14.2 5.2 13 6.6 15.2 8 12.4 8.2 12.8 10.4 10 9.2 7.2 10.4 7.6 8.2 4.8 8 7 6.6 5.8 5.2 8 5.6 7 4.6 9 4.2Z"
        fill="#FF0000"
      />
    </svg>
  );
}
