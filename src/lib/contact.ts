"use server";

/**
 * The contact form's only write path.
 *
 * SECURITY / ABUSE DESIGN
 * -----------------------
 * The browser sends four strings and nothing that matters:
 *
 *  - every value is trimmed and re-validated here with the very same rules the
 *    form uses (`validateContactForm`), so a hand-crafted request cannot store
 *    an oversized or malformed row;
 *  - a hidden honeypot field that a real visitor never sees: if it comes back
 *    filled, the request is answered with the normal thank-you and nothing is
 *    written, so a bot learns nothing and is not told it failed;
 *  - a basic per-IP rate limit (5 messages per hour) held in memory on this
 *    server process. That is deliberately lightweight — it stops a form being
 *    hammered without adding a table, a job or a dependency, which is all this
 *    store needs;
 *  - the write runs on the service-role key, because RLS on
 *    `contact_messages` has no policy at all (migration 013): anon and
 *    authenticated cannot insert a row even if they reached the table.
 *
 * Nothing internal is ever put in a message the visitor sees. Errors are logged
 * for the operator and answered with a plain sentence.
 */

import { headers } from "next/headers";

import {
  CONTACT_SUCCESS_MESSAGE,
  validateContactForm,
  type ContactFormResult,
  type ContactValues,
} from "@/lib/contact-types";
import { createAdminClient } from "@/lib/supabase/admin";

/** At most this many messages from one address… */
const RATE_LIMIT_MAX_MESSAGES = 5;

/** …per this window. One hour, measured from the first counted message. */
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

/** Anything above this many tracked addresses gets pruned (memory hygiene). */
const RATE_LIMIT_TRACKED_ADDRESSES = 1_000;

/**
 * address -> the moments that address submitted, oldest first.
 *
 * In-memory on purpose: one small Map costs nothing, needs no table and no
 * dependency, and a single-instance store does not need a shared counter. The
 * window is enforced on read, so entries expire by themselves.
 */
const recentSubmissions = new Map<string, number[]>();

/**
 * Stores one message from the contact form.
 *
 * Returns the success sentence for a message that was stored *and* for a
 * honeypot hit, so the two are indistinguishable from the outside.
 */
export async function sendContactMessage(input: {
  name?: unknown;
  phone?: unknown;
  email?: unknown;
  message?: unknown;
  /** Honeypot. Real visitors never see the field, so a filled one is a bot. */
  website?: unknown;
}): Promise<ContactFormResult> {
  if (readText(input?.website)) {
    return { ok: true, message: CONTACT_SUCCESS_MESSAGE };
  }

  const values: ContactValues = {
    name: readText(input?.name),
    phone: readText(input?.phone),
    email: readText(input?.email),
    message: readText(input?.message),
  };

  const errors = validateContactForm(values);

  if (Object.keys(errors).length > 0) {
    return {
      ok: false,
      message: "Please check the highlighted fields and try again.",
      errors,
    };
  }

  const address = await clientAddress();

  if (isRateLimited(address)) {
    return {
      ok: false,
      message:
        "You have sent a few messages in a short time. Please wait a little while and try again.",
    };
  }

  const db = createAdminClient();

  const { error } = await db.from("contact_messages").insert({
    name: values.name || null,
    phone: values.phone || null,
    email: values.email,
    message: values.message,
  });

  if (error) {
    console.error("[contact] could not store the message.", error.message);

    return {
      ok: false,
      message: "We could not send your message right now. Please try again.",
    };
  }

  return { ok: true, message: CONTACT_SUCCESS_MESSAGE };
}

/** One trimmed string, whatever the payload happened to contain. */
function readText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * The caller's address, for the rate limit only. Never stored and never shown.
 *
 * `x-forwarded-for` carries the client chain, so only its first entry is used.
 */
async function clientAddress(): Promise<string> {
  const requestHeaders = await headers();

  const forwarded = requestHeaders.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  if (first) return first;

  return requestHeaders.get("x-real-ip") ?? "unknown";
}

/**
 * True when this address has already spent the window's allowance — and, when
 * it has not, records this submission so the next call sees it.
 */
function isRateLimited(address: string): boolean {
  const now = Date.now();

  const recent = (recentSubmissions.get(address) ?? []).filter(
    (at) => now - at < RATE_LIMIT_WINDOW_MS,
  );

  if (recent.length >= RATE_LIMIT_MAX_MESSAGES) {
    recentSubmissions.set(address, recent);
    return true;
  }

  recent.push(now);
  recentSubmissions.set(address, recent);

  if (recentSubmissions.size > RATE_LIMIT_TRACKED_ADDRESSES) {
    pruneSubmissions(now);
  }

  return false;
}

/** Drops addresses whose whole window has expired. */
function pruneSubmissions(now: number): void {
  for (const [address, moments] of recentSubmissions) {
    const live = moments.filter((at) => now - at < RATE_LIMIT_WINDOW_MS);

    if (live.length === 0) recentSubmissions.delete(address);
    else recentSubmissions.set(address, live);
  }
}
