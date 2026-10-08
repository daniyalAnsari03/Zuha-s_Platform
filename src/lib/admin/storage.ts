import "server-only";

/**
 * Everything the dashboard does with Supabase Storage.
 *
 * Writes never travel through a server action: Next.js caps a server action body
 * well below a 5 MB photo, so `requestImageUpload` (in `uploads.ts`) signs a
 * short-lived upload URL with the service role and the browser PUTs the file
 * straight to Storage. That is why the bucket in migration 007 needs no write
 * policy for `anon` or `authenticated` — the signed URL is the capability, and
 * the server only issues it after `requireAdmin()`.
 *
 * Deletes do run on the server, through the service role, so a removed image
 * does not stay in the bucket forever.
 */

import type { AdminDb } from "@/lib/admin/db";

/** The single bucket created by migration 007. */
export const STORE_IMAGE_BUCKET = "store-images";

/**
 * The public URL for a file in the bucket, built by Storage itself rather than
 * by string-hand, so it always matches the bucket's own public path.
 */
export function publicImageUrl(db: AdminDb, path: string): string {
  return db.storage.from(STORE_IMAGE_BUCKET).getPublicUrl(path).data.publicUrl;
}

/**
 * A fresh, collision-proof path inside a folder. The admin's filename is
 * deliberately not part of the path: it would need sanitising, and it buys
 * nothing once the path is unique.
 */
export function buildUploadPath(folder: string, extension: string): string {
  return `${folder}/${crypto.randomUUID()}.${extension}`;
}

/** The file extension for an upload's content type. */
export const IMAGE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/**
 * Deletes files from the bucket, ignoring anything that is not one of ours.
 *
 * A category or product may hold an image URL that predates the dashboard (a
 * row added straight in the Supabase UI, for instance), so a URL from another
 * bucket or an external host is left alone rather than guessed at.
 *
 * Never fatal: a leftover file is untidy, but a failed delete must not turn a
 * successful save into an error the admin sees.
 */
export async function deleteStoredImages(
  db: AdminDb,
  urls: readonly (string | null | undefined)[],
): Promise<void> {
  const paths = urls
    .map((url) => storedPath(url))
    .filter((path): path is string => path !== null);

  if (paths.length === 0) return;

  const { error } = await db.storage.from(STORE_IMAGE_BUCKET).remove(paths);

  if (error) {
    console.error("[admin] could not remove image files.", error.message);
  }
}

/**
 * The bucket-relative path of a public URL, or null when the URL points
 * somewhere else.
 */
function storedPath(url: string | null | undefined): string | null {
  if (!url) return null;

  const marker = `/storage/v1/object/public/${STORE_IMAGE_BUCKET}/`;
  const index = url.indexOf(marker);

  if (index === -1) return null;

  return decodeURIComponent(url.slice(index + marker.length));
}
