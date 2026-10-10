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
import { type Currency } from "@/lib/currency";
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

const OPTIONS: { code: Currency; label: string; Flag: ComponentType }[] = [
  { code: "PKR", label: "PKR", Flag: PakistanFlag },
  { code: "USD", label: "USD", Flag: UsaFlag },
];

/**
 * The storefront's currency switcher: a small white pill fixed at the bottom
 * left of every storefront page (including the homepage and the footer slide),
 * never in `/admin`.
 *
 * It renders nothing at all when the admin has not set a USD rate, because there
 * is then nothing to switch to. The menu opens *upward* above the button, closes
 * on an outside click and on Escape, and the chevron flips while it is open.
 *
 * It sits at `z-30`, below every popup/drawer/modal (the navbar's panels are
 * `z-40`, the drawers and quick view `z-50`), so it can never cover a dialog. On
 * mobile it is offset above the bottom safe area.
 */
export default function CurrencySwitcher() {
  const { currency, usdAvailable, setCurrency } = useCurrency();
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

  if (!usdAvailable) return null;

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
              className="absolute bottom-full left-0 mb-2 w-40 overflow-hidden rounded-xl border border-black/10 bg-white p-1 shadow-[0_10px_30px_rgba(0,0,0,0.16)]"
            >
              {OPTIONS.map(({ code, label, Flag }) => {
                const selected = currency === code;

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
                    <span className="min-w-0 flex-1">{label}</span>
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
          {currency === "USD" ? <UsaFlag /> : <PakistanFlag />}
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

/** Pakistan: green field, white hoist stripe, crescent and star. */
function PakistanFlag() {
  return (
    <svg viewBox="0 0 20 14" className={FLAG_CLASS} aria-hidden="true" focusable="false">
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
    <svg viewBox="0 0 20 14" className={FLAG_CLASS} aria-hidden="true" focusable="false">
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
