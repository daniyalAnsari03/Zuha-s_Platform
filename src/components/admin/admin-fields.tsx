"use client";

/**
 * The dashboard's form primitives.
 *
 * Deliberately plain and local: a label, an input, a textarea, a select, a button
 * and a feedback line. The storefront builds its forms the same way (see
 * `app/(site)/login/page.tsx`), so the dashboard matches it without either side
 * depending on the other.
 *
 * Same design system as the shop — white, black text, plum for the action and the
 * focus ring, 44px touch targets, uppercase tracked labels.
 */

import { AnimatePresence, motion } from "framer-motion";
import { useRef, useState, type ReactNode } from "react";

import { TRANSITION_BACKDROP } from "@/lib/motion";
import { cn } from "@/lib/utils";

export const ADMIN_LABEL_CLASS =
  "block text-xs tracking-[0.16em] text-black/60 uppercase";

export const ADMIN_INPUT_CLASS =
  "min-h-11 w-full min-w-0 border border-black/15 bg-white px-3 py-2 text-sm transition-colors placeholder:text-black/30 focus:border-plum focus-visible:border-plum focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-plum";

export const ADMIN_TEXTAREA_CLASS = `${ADMIN_INPUT_CLASS} min-h-28 py-2.5 leading-relaxed`;

export const ADMIN_BUTTON_CLASS =
  "inline-flex min-h-11 items-center justify-center gap-2 px-5 text-xs tracking-[0.16em] uppercase transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum disabled:cursor-not-allowed disabled:opacity-50";

export const ADMIN_PRIMARY_BUTTON_CLASS = cn(
  ADMIN_BUTTON_CLASS,
  "bg-plum text-white hover:bg-plum-dark",
);

export const ADMIN_SECONDARY_BUTTON_CLASS = cn(
  ADMIN_BUTTON_CLASS,
  "border border-black/20 text-black hover:border-black",
);

export const ADMIN_DANGER_BUTTON_CLASS = cn(
  ADMIN_BUTTON_CLASS,
  "border border-plum text-plum hover:bg-plum hover:text-white",
);

export const ADMIN_QUIET_BUTTON_CLASS = cn(
  ADMIN_BUTTON_CLASS,
  "px-3 text-black/50 hover:text-plum",
);

/** A labelled control. `hint` sits under the field in muted text. */
export function AdminField({
  label,
  htmlFor,
  hint,
  required,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className={ADMIN_LABEL_CLASS}>
        {label}
        {required ? <span className="text-plum"> *</span> : null}
      </label>

      {children}

      {hint ? <p className="text-xs text-black/45">{hint}</p> : null}
    </div>
  );
}

/** The single place a form reports success or failure. */
export function AdminFeedback({
  status,
}: {
  status: { tone: "success" | "error"; message: string } | null;
}) {
  return (
    <AnimatePresence initial={false}>
      {status ? (
        <motion.p
          key={`${status.tone}:${status.message}`}
          role={status.tone === "error" ? "alert" : "status"}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={TRANSITION_BACKDROP}
          className={cn(
            "border-l-2 py-1 pl-3 text-sm",
            status.tone === "error"
              ? "border-plum bg-plum/5 text-plum"
              : "border-black/20 bg-black/[0.02] text-black/70",
          )}
        >
          {status.message}
        </motion.p>
      ) : null}
    </AnimatePresence>
  );
}

/** A plain section heading inside a dialog or a card. */
export function AdminSectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="text-xs tracking-[0.2em] text-black/50 uppercase">
      {children}
    </h3>
  );
}

/**
 * Tracks image uploads in flight across a form's image fields.
 *
 * Give `reportUploadBusy` to every field's `onBusyChange`; a field reports only
 * when its own state changes, so the count stays honest with two image slots in
 * one form. The form then holds Save until nothing is uploading, because a row
 * saved mid-upload would store the old image while the admin watches the new one.
 */
export function useUploadBusy() {
  const busyCount = useRef(0);
  const [uploadsBusy, setUploadsBusy] = useState(false);

  const reportUploadBusy = (busy: boolean) => {
    busyCount.current = Math.max(0, busyCount.current + (busy ? 1 : -1));
    setUploadsBusy(busyCount.current > 0);
  };

  return { uploadsBusy, reportUploadBusy };
}

/**
 * Sits in a dialog footer, beside Save, for as long as an upload is running —
 * the visible half of a disabled button.
 */
export function AdminUploadBusyNotice({ busy }: { busy: boolean }) {
  if (!busy) return null;

  return (
    <p className="w-full text-xs text-black/55 sm:mr-auto sm:w-auto">
      Image upload in progress — saving is disabled until it finishes.
    </p>
  );
}
