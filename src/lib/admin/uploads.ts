"use server";

/**
 * Step one of the image upload: the server issues a signed upload URL, the
 * browser uploads the file straight to Storage.
 *
 * WHY NOT A SERVER ACTION UPLOAD: Next.js caps a server action body well below a
 * 5 MB photo, so pushing image bytes through one would fail on exactly the files
 * that matter. Instead this action authorises the admin and signs a short-lived
 * URL for a path the server chose; the browser then PUTs the file to that URL and
 * gets real upload progress out of it. That is also why migration 007 gives
 * `anon` and `authenticated` no write policy on the bucket: the signed URL is the
 * capability, and it is only ever minted for an authenticated admin.
 *
 * Nothing else in the dashboard is allowed to write to Storage directly.
 */

import {
  actionFail,
  isUploadFolder,
  MAX_GALLERY_IMAGES,
  MAX_IMAGE_BYTES,
  type ActionError,
  type UploadFolder,
} from "@/lib/admin/validation";
import { getAdminDb, type AdminDb } from "@/lib/admin/db";
import { requireAdmin } from "@/lib/admin/guard";
import {
  buildUploadPath,
  IMAGE_EXTENSIONS,
  publicImageUrl,
  STORE_IMAGE_BUCKET,
} from "@/lib/admin/storage";

/** Everything the browser needs to perform and identify the upload. */
export type UploadTicket = {
  /** Short-lived PUT target. Never send this to a database. */
  signedUrl: string;
  /** The permanent URL to store on the row. */
  publicUrl: string;
  /** Bucket-relative path, used to delete the file later. */
  path: string;
};

export type UploadTicketResult =
  | { ok: true; ticket: UploadTicket }
  | ActionError;

/**
 * Signs one image upload. The size and type are checked here as well as in the
 * browser, because the browser check is a convenience and this is the boundary:
 * the bucket's own limits are the backstop behind it.
 */
async function signOneFile(
  db: AdminDb,
  folder: UploadFolder,
  contentType: string,
  size: number,
): Promise<UploadTicketResult> {
  const extension = IMAGE_EXTENSIONS[contentType];

  if (!extension) {
    return actionFail("Images must be JPEG, PNG or WebP.");
  }

  if (!Number.isFinite(size) || size <= 0) {
    return actionFail("That image looks empty. Please choose another file.");
  }

  if (size > MAX_IMAGE_BYTES) {
    return actionFail("Images must be 5 MB or smaller.");
  }

  const path = buildUploadPath(folder, extension);

  const { data, error } = await db.storage
    .from(STORE_IMAGE_BUCKET)
    .createSignedUploadUrl(path, { upsert: true });

  if (error || !data) {
    console.error("[admin] could not sign an image upload.", error?.message);

    // The most likely cause by far: migration 007 has not been run yet.
    return actionFail(
      `The "${STORE_IMAGE_BUCKET}" bucket is not available. Run supabase/migrations/007_store_images_bucket.sql first.`,
    );
  }

  return {
    ok: true,
    ticket: { signedUrl: data.signedUrl, publicUrl: publicImageUrl(db, path), path },
  };
}

/**
 * Signs an upload for one image.
 */
export async function requestImageUpload(input: {
  folder: unknown;
  contentType: unknown;
  size: unknown;
}): Promise<UploadTicketResult> {
  await requireAdmin();

  if (!isUploadFolder(input?.folder)) {
    return actionFail("That upload folder is not allowed.");
  }

  const folder: UploadFolder = input.folder;
  const contentType = typeof input.contentType === "string" ? input.contentType : "";
  const size = typeof input.size === "number" ? input.size : Number(input.size);

  return signOneFile(getAdminDb(), folder, contentType, size);
}

/** One signed URL per file in the gallery, issued in a single call. */
export type UploadBatchResult =
  | { ok: true; tickets: UploadTicketResult[] }
  | ActionError;

/**
 * Signs uploads for a whole gallery up front, so the browser can PUT the files in
 * parallel. A gallery of N files previously cost N server-action round trips;
 * this costs one.
 */
export async function requestImageUploads(input: {
  folder: unknown;
  files: Array<{ contentType: unknown; size: unknown }>;
}): Promise<UploadBatchResult> {
  await requireAdmin();

  if (!isUploadFolder(input?.folder)) {
    return actionFail("That upload folder is not allowed.");
  }

  if (!Array.isArray(input?.files) || input.files.length === 0) {
    return actionFail("Choose an image to upload first.");
  }

  if (input.files.length > MAX_GALLERY_IMAGES) {
    return actionFail(`A product can have at most ${MAX_GALLERY_IMAGES} images.`);
  }

  const db = getAdminDb();
  const folder: UploadFolder = input.folder;

  const tickets = await Promise.all(
    input.files.map((file) =>
      signOneFile(
        db,
        folder,
        typeof file?.contentType === "string" ? file.contentType : "",
        typeof file?.size === "number" ? file.size : Number(file?.size),
      ),
    ),
  );

  return { ok: true, tickets };
}
