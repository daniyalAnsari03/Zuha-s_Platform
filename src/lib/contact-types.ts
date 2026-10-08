/**
 * Contact-form rules shared by the browser and the server.
 *
 * Deliberately free of any server-only import (no Supabase, no `next/headers`),
 * exactly like `order-types.ts`, so the contact form, the /contact page and the
 * `sendContactMessage` server action all hold to one set of limits and one set
 * of messages. Nothing here talks to the network.
 */

export const CONTACT_FIELDS = ["name", "phone", "email", "message"] as const;

export type ContactField = (typeof CONTACT_FIELDS)[number];

export type ContactValues = Record<ContactField, string>;

/** Labels shown above the inputs, reused by the fields and the error summary. */
export const CONTACT_FIELD_LABELS: Record<ContactField, string> = {
  name: "Name",
  phone: "Phone",
  email: "Email address",
  message: "Comment",
};

/** Which fields a visitor must actually fill in (spec: email and comment). */
export const CONTACT_REQUIRED_FIELDS: readonly ContactField[] = [
  "email",
  "message",
];

export const MAX_CONTACT_NAME_LENGTH = 100;
export const MAX_CONTACT_PHONE_LENGTH = 30;
export const MAX_CONTACT_EMAIL_LENGTH = 200;
export const MAX_CONTACT_MESSAGE_LENGTH = 2000;

export const CONTACT_MAX_LENGTHS: Record<ContactField, number> = {
  name: MAX_CONTACT_NAME_LENGTH,
  phone: MAX_CONTACT_PHONE_LENGTH,
  email: MAX_CONTACT_EMAIL_LENGTH,
  message: MAX_CONTACT_MESSAGE_LENGTH,
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export type ContactFormErrors = Partial<Record<ContactField, string>>;

/**
 * What the form and the server action both show: a success message is returned
 * rather than thrown, because Next.js replaces a thrown server-action error
 * with a generic digest in production builds and the visitor would never see
 * the real reason (see `PlaceOrderResult`).
 */
export type ContactFormResult =
  | { ok: true; message: string }
  | { ok: false; message: string; errors?: ContactFormErrors };

/** The exact sentence the form shows once a message has been stored. */
export const CONTACT_SUCCESS_MESSAGE =
  "Thank you, your message has been sent.";

/**
 * Validates one field and returns a message the visitor can act on, or `null`
 * when the value is acceptable.
 *
 * Shared on purpose: the form checks as the visitor types and again on submit,
 * and `sendContactMessage` runs the very same rules over the payload it was
 * handed, so a hand-crafted request is held to exactly one standard.
 */
export function validateContactField(
  field: ContactField,
  value: string,
): string | null {
  const trimmed = value.trim();
  const maxLength = CONTACT_MAX_LENGTHS[field];

  if (!trimmed) {
    return CONTACT_REQUIRED_FIELDS.includes(field)
      ? `${CONTACT_FIELD_LABELS[field]} is required.`
      : null;
  }

  if (trimmed.length > maxLength) {
    return `${CONTACT_FIELD_LABELS[field]} must be ${maxLength} characters or fewer.`;
  }

  if (field === "email" && !EMAIL_PATTERN.test(trimmed)) {
    return "Please enter a valid email address.";
  }

  return null;
}

/** Every problem in one pass, keyed by field. An empty object means "valid". */
export function validateContactForm(
  values: ContactValues,
): ContactFormErrors {
  const errors: ContactFormErrors = {};

  for (const field of CONTACT_FIELDS) {
    const message = validateContactField(field, values[field]);
    if (message) errors[field] = message;
  }

  return errors;
}

/** First invalid field, so the form can move focus to whatever needs fixing. */
export function firstInvalidContactField(
  errors: ContactFormErrors,
): ContactField | null {
  return CONTACT_FIELDS.find((field) => errors[field]) ?? null;
}
