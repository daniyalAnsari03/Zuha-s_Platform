/**
 * The field rules every admin form and every admin server action obeys.
 *
 * Shared on purpose: the browser checks a field so the admin gets an instant
 * answer, and the server action re-checks the same limits because it never
 * trusts the payload it was handed. Both sides read the constants here so they
 * cannot drift apart.
 *
 * Nothing in this file imports Supabase or `next/*`, so a Client Component can
 * import it as well as server code.
 */

/** A refusal an admin can act on, safe to render as-is. */
export type ActionError = { ok: false; error: string };

/** What every admin server action returns. */
export type ActionResult = ActionError | { ok: true; message: string };

export function actionOk(message: string): ActionResult {
  return { ok: true, message };
}

export function actionFail(error: string): ActionError {
  return { ok: false, error };
}

// ---------------------------------------------------------------------------
// Images
// ---------------------------------------------------------------------------

/**
 * The only types a customer-facing image may be, matching
 * `storage.buckets.allowed_mime_types` in migration 007.
 */
export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

/** 5 MB, matching `storage.buckets.file_size_limit` in migration 007. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export const MAX_GALLERY_IMAGES = 10;

export const MAX_URL_LENGTH = 2000;

/** Which prefix inside the `store-images` bucket a file belongs in. */
export const UPLOAD_FOLDERS = ["categories", "products", "team"] as const;

export type UploadFolder = (typeof UPLOAD_FOLDERS)[number];

export function isUploadFolder(value: unknown): value is UploadFolder {
  return (
    typeof value === "string" &&
    (UPLOAD_FOLDERS as readonly string[]).includes(value)
  );
}

/** Pre-flight check used by the upload component, with an admin-readable reason. */
export function describeImageProblem(file: File): string | null {
  if (!file || typeof file !== "object") {
    return "No image file was chosen.";
  }

  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return "Images must be JPEG, PNG or WebP.";
  }

  if (file.size > MAX_IMAGE_BYTES) {
    return "Images must be 5 MB or smaller.";
  }

  return null;
}

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

export const MAX_NAME_LENGTH = 80;
export const MAX_SLUG_LENGTH = 60;
export const MAX_CATEGORY_DESCRIPTION_LENGTH = 500;
export const MAX_PRODUCT_DESCRIPTION_LENGTH = 4000;
export const MAX_OPTION_LIST_LENGTH = 200;
export const MAX_PRICE = 10_000_000;

/** One-line details: the Settings screen's fields and an announcement. */
export const MAX_LINE_LENGTH = 200;

/** The longer text a Team Member's description/role allows. */
export const MAX_TEAM_ROLE_LENGTH = 120;
export const MAX_TEAM_BIO_LENGTH = 1000;

/** One policy page's body, typed into the Settings textarea. */
export const MAX_POLICY_LENGTH = 40000;

/**
 * One trimmed line of text, at most `maxLength` characters.
 *
 * `required` decides whether an empty value is a refusal or an accepted "not
 * set yet" — the Settings screen stores empty strings on purpose, because the
 * storefront falls back to `site-config.ts` for a field that is blank.
 */
export function readLine(
  value: unknown,
  label: string,
  maxLength: number = MAX_LINE_LENGTH,
  required = false,
): { ok: true; value: string } | ActionError {
  const line = clean(value);

  if (!line) {
    return required ? actionFail(`${label} is required.`) : { ok: true, value: "" };
  }

  if (line.length > maxLength) {
    return actionFail(`${label} must be ${maxLength} characters or fewer.`);
  }

  return { ok: true, value: line };
}

/**
 * Multi-line text, e.g. one policy page's body. Trimmed at the ends only —
 * internal line breaks and blank lines are preserved exactly, because the
 * storefront splits them into paragraphs. Empty is stored as an empty string
 * (a policy may be cleared back to "not written yet").
 */
export function readLongText(
  value: unknown,
  label: string,
  maxLength: number = MAX_POLICY_LENGTH,
): { ok: true; value: string } | ActionError {
  const text = typeof value === "string" ? value.trim() : "";

  if (text.length > maxLength) {
    return actionFail(`${label} must be ${maxLength} characters or fewer.`);
  }

  return { ok: true, value: text };
}

/**
 * An optional email address. Empty means "not set yet"; anything else has to
 * look like an address, so a typo cannot end up as a dead `mailto:` link in
 * the footer.
 */
export function readOptionalEmail(
  value: unknown,
  label: string,
): { ok: true; value: string } | ActionError {
  const email = clean(value);

  if (!email) return { ok: true, value: "" };
  if (email.length > MAX_LINE_LENGTH) {
    return actionFail(`${label} must be ${MAX_LINE_LENGTH} characters or fewer.`);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return actionFail(`${label} must be a valid email address.`);
  }

  return { ok: true, value: email };
}

/**
 * An optional http(s) link — a social profile. An empty value means "no link
 * yet", which the storefront renders as a disabled placeholder rather than a
 * dead icon.
 */
export function readOptionalLink(
  value: unknown,
  label: string,
): { ok: true; value: string } | ActionError {
  const url = clean(value);

  if (!url) return { ok: true, value: "" };

  const parsed = readImageUrl(url);
  if (!parsed.ok) return { ok: false, error: `${label}: ${parsed.error}` };

  return { ok: true, value: parsed.value ?? "" };
}

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** A required name, e.g. a category or a product. */
export function readName(
  value: unknown,
): { ok: true; value: string } | ActionError {
  const name = clean(value);

  if (!name) return actionFail("Name is required.");
  if (name.length > MAX_NAME_LENGTH) {
    return actionFail(`Name must be ${MAX_NAME_LENGTH} characters or fewer.`);
  }

  return { ok: true, value: name };
}

/** An optional description; an empty value is stored as null. */
export function readDescription(
  value: unknown,
  maxLength: number,
): { ok: true; value: string | null } | ActionError {
  const description = clean(value);

  if (!description) return { ok: true, value: null };
  if (description.length > maxLength) {
    return actionFail(`Description must be ${maxLength} characters or fewer.`);
  }

  return { ok: true, value: description };
}

/**
 * Free text the admin types exactly as they want it shown, e.g. "S, M, L" or
 * "Free Size". Stored as typed (only trimmed) — never split or re-ordered, because
 * the storefront shows these characters verbatim.
 */
export function readOptionList(
  value: unknown,
  label: string,
): { ok: true; value: string | null } | ActionError {
  const options = clean(value);

  if (!options) return { ok: true, value: null };
  if (options.length > MAX_OPTION_LIST_LENGTH) {
    return actionFail(
      `${label} must be ${MAX_OPTION_LIST_LENGTH} characters or fewer.`,
    );
  }

  return { ok: true, value: options };
}

/** An optional image URL: http(s) only, so nothing odd reaches an `img src`. */
export function readImageUrl(
  value: unknown,
): { ok: true; value: string | null } | ActionError {
  const url = clean(value);

  if (!url) return { ok: true, value: null };
  if (url.length > MAX_URL_LENGTH) {
    return actionFail("That image URL is too long.");
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return actionFail("That image URL is not valid.");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return actionFail("Images must be served over http or https.");
  }

  return { ok: true, value: url };
}

/** A required money amount with at most two decimals. */
export function readPrice(
  value: unknown,
  label: string,
): { ok: true; value: number } | ActionError {
  const amount = typeof value === "number" ? value : Number(clean(value));

  if (!Number.isFinite(amount)) return actionFail(`${label} is required.`);
  if (amount < 0) return actionFail(`${label} cannot be negative.`);
  if (amount > MAX_PRICE) return actionFail(`${label} is too large.`);
  if (Math.round(amount * 100) !== amount * 100) {
    return actionFail(`${label} can have at most two decimal places.`);
  }

  return { ok: true, value: amount };
}

/**
 * An optional money amount, e.g. the discount price. An empty field and a `0` both
 * mean "no discount", which is also what a `0` would be worth.
 */
export function readOptionalPrice(
  value: unknown,
  label: string,
): { ok: true; value: number | null } | ActionError {
  if (clean(value) === "" || value === 0) return { ok: true, value: null };

  const price = readPrice(value, label);
  return price.ok ? { ok: true, value: price.value } : price;
}

/** The highest conversion rate the Settings form accepts ("1 <CUR> = X PKR"). */
export const MAX_CURRENCY_RATE = 10_000;

/**
 * An optional currency conversion rate ("1 <CUR> = X PKR").
 *
 * Empty means "no rate yet", which hides that currency on the storefront
 * entirely. A set value has to be positive, no higher than
 * {@link MAX_CURRENCY_RATE} and carry at most two decimals (which the
 * `numeric(12,2)` columns also hold). `label` names the currency in a refusal,
 * e.g. `"USD rate"`.
 */
export function readOptionalCurrencyRate(
  value: unknown,
  label: string,
): { ok: true; value: number | null } | ActionError {
  const raw = clean(value);
  if (!raw) return { ok: true, value: null };

  const rate = Number(raw);

  if (!Number.isFinite(rate)) return actionFail(`${label} must be a number.`);
  if (rate <= 0) return actionFail(`${label} must be greater than zero.`);
  if (rate > MAX_CURRENCY_RATE) {
    return actionFail(`${label} must be ${MAX_CURRENCY_RATE} or less.`);
  }
  if (Math.round(rate * 100) !== rate * 100) {
    return actionFail(`${label} can have at most two decimal places.`);
  }

  return { ok: true, value: rate };
}

/** A whole number of items, e.g. a stock quantity or a low-stock threshold. */
export function readCount(
  value: unknown,
  label: string,
): { ok: true; value: number } | ActionError {
  const raw = typeof value === "number" || typeof value === "string" ? value : "";

  if (typeof raw === "string" && raw.trim() === "") {
    return actionFail(`${label} is required.`);
  }

  const count = typeof raw === "number" ? raw : Number(raw.trim());

  if (!Number.isFinite(count)) return actionFail(`${label} must be a number.`);
  if (!Number.isInteger(count)) return actionFail(`${label} must be a whole number.`);
  if (count < 0) return actionFail(`${label} cannot be negative.`);

  return { ok: true, value: count };
}

// ---------------------------------------------------------------------------
// Ids
// ---------------------------------------------------------------------------

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** An optional uuid column, e.g. a product's sub-category. */
export function readOptionalId(value: unknown): string | null {
  const id = clean(value);

  return UUID_PATTERN.test(id) ? id : null;
}

/** A uuid column that must be present, e.g. the category a product belongs to. */
export function readRequiredId(
  value: unknown,
  label: string,
): { ok: true; value: string } | ActionError {
  const id = readOptionalId(value);
  return id ? { ok: true, value: id } : actionFail(`${label} is required.`);
}
