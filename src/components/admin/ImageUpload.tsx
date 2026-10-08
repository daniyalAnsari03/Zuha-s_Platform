"use client";

/* Admin previews are deliberately plain <img> — see the note at the top. */
/* eslint-disable @next/next/no-img-element */

import { useEffect, useId, useRef, useState } from "react";

import {
  ADMIN_LABEL_CLASS,
  ADMIN_QUIET_BUTTON_CLASS,
} from "@/components/admin/admin-fields";
import {
  requestImageUpload,
  requestImageUploads,
  type UploadTicket,
} from "@/lib/admin/uploads";
import {
  describeImageProblem,
  MAX_GALLERY_IMAGES,
  type UploadFolder,
} from "@/lib/admin/validation";
import { getSupabasePublicEnv } from "@/lib/supabase/env";
import { cn } from "@/lib/utils";

/**
 * Uploading an image from the dashboard.
 *
 * The file never passes through a server action: `requestImageUpload` signs a
 * short-lived URL and this component PUTs the bytes straight to Supabase Storage.
 * That is what keeps a 5 MB photo working (Next.js caps a server action body well
 * below that) and what makes a real progress bar possible — `XMLHttpRequest`
 * reports upload progress, `supabase.storage.uploadToSignedUrl` does not.
 *
 * Type and size are checked twice: here so the admin finds out at once, and again
 * in the action, because this check is a convenience and the action is the
 * boundary. The bucket's own limits (migration 007) sit behind both.
 *
 * The preview, which is the whole point of this file:
 *
 * 1. The moment a file is chosen, `URL.createObjectURL` shows it — through a
 *    plain `<img>`, never `next/image`, because the optimizer would fetch and
 *    re-encode before anything appeared. Progress sits on top of that preview.
 * 2. When the upload finishes, the form value takes the public URL at once, so
 *    Save works immediately — but the local preview stays on screen. It is only
 *    swapped out once the public URL has really loaded in the browser (preloaded
 *    with a plain `Image()`), so there is no blank frame between the two. If the
 *    public URL never loads, the local preview stays and the reason is shown.
 * 3. Object URLs are revoked when the preview is replaced, cleared, or the
 *    field unmounts.
 *
 * `ImageUpload` is the single-image field — a category's desktop or mobile image,
 * a sub-category's image, a team member's portrait. `ImageGalleryUpload` is the
 * multi-image variant, where the first image is the main one everywhere on the
 * storefront: every chosen file gets its own card, progress and failure, in the
 * order it was picked.
 */

export type ImageUploadProps = {
  label: string;
  /** The stored public URL, or null when there is no image yet. */
  value: string | null;
  onChange: (value: string | null) => void;
  /** Bucket folder the file belongs in. */
  folder: UploadFolder;
  hint?: string;
  required?: boolean;
  className?: string;
  /**
   * Reports true while this field has an upload in flight, so the form can hold
   * Save: a row saved mid-upload would lose the image the admin can already see.
   */
  onBusyChange?: (busy: boolean) => void;
};

export function ImageUpload({
  label,
  value,
  onChange,
  folder,
  hint,
  required,
  className,
  onBusyChange,
}: ImageUploadProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <span className={ADMIN_LABEL_CLASS}>
        {label}
        {required ? <span className="text-plum"> *</span> : null}
      </span>

      <ImageSlot
        value={value}
        onChange={onChange}
        folder={folder}
        label={label}
        onBusyChange={onBusyChange}
      />

      {hint ? <p className="text-xs text-black/45">{hint}</p> : null}
    </div>
  );
}

export type ImageGalleryUploadProps = {
  label: string;
  /** Stored public URLs in display order; the first one is the main image. */
  value: string[];
  onChange: (value: string[]) => void;
  folder: UploadFolder;
  hint?: string;
  className?: string;
  /** Same contract as `ImageUpload`. */
  onBusyChange?: (busy: boolean) => void;
};

/** A file that has been chosen but is not a stored URL yet. */
type PendingImage = {
  id: string;
  /** Object URL of the chosen file, or null when it could not be previewed. */
  localUrl: string | null;
  /** Set the moment the upload succeeds, before the browser has loaded it. */
  uploadedUrl: string | null;
  progress: number | null;
  status: "uploading" | "settling" | "failed";
  error: string | null;
};

/** A file the gallery is uploading right now, plus its preview card id. */
type AsyncUploadItem = {
  id: string;
  file: File;
  localUrl: string | null;
};

// A gallery uploads as a batch, but a cap keeps a very large pick from PUTing
// every file at Storage in the exact same instant.
const GALLERY_UPLOAD_PARALLELISM = 3;

export function ImageGalleryUpload({
  label,
  value,
  onChange,
  folder,
  hint,
  className,
  onBusyChange,
}: ImageGalleryUploadProps) {
  const [pending, setPending] = useState<PendingImage[]>([]);
  const [batchBusy, setBatchBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const nextIdRef = useRef(0);

  useBusyReporter(batchBusy, onBusyChange);

  // Uploads report back one URL at a time, so the latest array is kept here:
  // a callback captured before an earlier upload finished must not put the
  // gallery back to what it was when the batch started.
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const pendingRef = useRef(pending);
  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  // Every object URL still on screen is revoked when the field goes away.
  useEffect(() => {
    return () => {
      for (const item of pendingRef.current) {
        if (item.localUrl) URL.revokeObjectURL(item.localUrl);
      }
    };
  }, []);

  const append = (url: string) => {
    const next = [...valueRef.current, url];
    valueRef.current = next;
    onChange(next);
  };

  const patch = (id: string, changes: Partial<PendingImage>) => {
    setPending((current) =>
      current.map((item) => (item.id === id ? { ...item, ...changes } : item)),
    );
  };

  /** Drops a preview card, revoking the object URL it was showing. */
  const dropCard = (id: string, localUrl: string | null) => {
    if (localUrl) URL.revokeObjectURL(localUrl);
    setPending((current) => current.filter((entry) => entry.id !== id));
  };

  /** The Remove button on a card that never made it into `value`. */
  const removePending = (id: string) => {
    const item = pendingRef.current.find((entry) => entry.id === id);
    if (!item) return;

    if (item.uploadedUrl) {
      // The upload succeeded but the preview could not be loaded: take the URL
      // back out of the form value as well, so Save cannot keep it unseen.
      const next = valueRef.current.filter((url) => url !== item.uploadedUrl);
      valueRef.current = next;
      onChange(next);
    }

    dropCard(id, item.localUrl);
  };

  const uploadFiles = async (files: File[]) => {
    if (batchBusy) return;

    setBatchBusy(true);
    setNotice(null);

    // One signed-URL request covers the whole batch, then the files PUT with a
    // small parallelism cap. Every file gets its preview card up front, in pick
    // order, so the grid reads top-to-bottom as chosen even though the uploads
    // finish out of order.
    const items = files.map((file) => ({
      id: String(nextIdRef.current++),
      file,
      localUrl: previewObjectUrl(file),
    }));

    for (const item of items) {
      setPending((current) => [
        ...current,
        {
          id: item.id,
          localUrl: item.localUrl,
          uploadedUrl: null,
          progress: item.localUrl ? 0 : null,
          status: "uploading",
          error: null,
        },
      ]);
    }

    try {
      await uploadItems(items);
    } finally {
      setBatchBusy(false);
    }
  };

  const uploadItems = async (items: AsyncUploadItem[]) => {
    let failed = false;

    // Files that could not be previewed are already failed; do not waste a
    // signed URL or a PUT on them.
    const uploadable = items.filter((item) => item.localUrl !== null);

    for (const item of items) {
      if (item.localUrl) continue;
      patch(item.id, {
        status: "failed",
        error: "That file could not be previewed. Please choose another image.",
      });
      failed = true;
    }

    if (uploadable.length === 0) {
      if (!failed) setNotice("All images uploaded");
      return;
    }

    const ticketResult = await requestImageUploads({
      folder,
      files: uploadable.map((item) => ({
        contentType: item.file.type,
        size: item.file.size,
      })),
    });

    if (!ticketResult.ok) {
      for (const item of uploadable) {
        patch(item.id, {
          status: "failed",
          progress: null,
          error: ticketResult.error,
        });
      }
      return;
    }

    // Results come back in pick order regardless of when each PUT finished, so
    // the success list never shuffles the gallery.
    const results = await mapPool(
      uploadable.length,
      GALLERY_UPLOAD_PARALLELISM,
      async (index) => {
        const ticket = ticketResult.tickets[index];

        if (!ticket?.ok) {
          return {
            index,
            outcome: {
              ok: false as const,
              error:
                ticket?.error ??
                "That image could not be uploaded. Please try again.",
            },
          };
        }

        return {
          index,
          outcome: await uploadWithSignedUrl(
            ticket.ticket,
            uploadable[index].file,
            (percent) => patch(uploadable[index].id, { progress: percent }),
          ),
        };
      },
    );

    for (const { index, outcome } of results) {
      const item = uploadable[index];

      if (!outcome.ok) {
        patch(item.id, { status: "failed", progress: null, error: outcome.error });
        failed = true;
        continue;
      }

      // The form value takes the URL now; the card stays until it has loaded.
      patch(item.id, { uploadedUrl: outcome.url, progress: 100, status: "settling" });
      append(outcome.url);

      if (await preloadStoredImage(outcome.url)) {
        dropCard(item.id, item.localUrl);
      } else {
        patch(item.id, {
          status: "failed",
          progress: null,
          error:
            "Uploaded, but that image could not be loaded here. Remove it and try again.",
        });
        failed = true;
      }
    }

    if (!failed) setNotice("All images uploaded");
  };

  // A settling card already sits in `value`, so it must be counted only once.
  const pendingCount = pending.filter((item) => item.uploadedUrl === null).length;
  const full = value.length + pendingCount >= MAX_GALLERY_IMAGES;
  const disabled = full || batchBusy;

  // Cards that are still pending hide their stored twin in `value`, so the two
  // never render side by side.
  const settledUrls = new Set(
    pending
      .map((item) => item.uploadedUrl)
      .filter((url): url is string => url !== null),
  );
  const cards: Array<
    { kind: "stored"; url: string } | { kind: "pending"; item: PendingImage }
  > = [
    ...value
      .filter((url) => !settledUrls.has(url))
      .map((url) => ({ kind: "stored" as const, url })),
    ...pending.map((item) => ({ kind: "pending" as const, item })),
  ];

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= value.length) return;

    const next = [...value];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <span className={ADMIN_LABEL_CLASS}>
        {label}
        <span className="text-plum"> *</span>
      </span>

      <p className="text-xs text-black/45">
        The first image is the main image. {MAX_GALLERY_IMAGES} images maximum.
      </p>

      {cards.length > 0 ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {cards.map((card, index) =>
            card.kind === "stored" ? (
              <li
                key={`stored-${card.url}`}
                className="flex flex-col gap-2 border border-black/10 p-2"
              >
                <div className="relative aspect-square w-full overflow-hidden bg-black/5">
                  <img
                    src={card.url}
                    alt={index === 0 ? "Main image" : `Image ${index + 1}`}
                    className="absolute inset-0 size-full object-cover"
                  />

                  {index === 0 ? (
                    <span className="absolute top-0 left-0 bg-plum px-2 py-1 text-[10px] tracking-[0.1em] text-white uppercase">
                      Main
                    </span>
                  ) : null}
                </div>

                <div className="flex items-center justify-between gap-1">
                  <div className="flex">
                    <button
                      type="button"
                      onClick={() => move(value.indexOf(card.url), -1)}
                      disabled={value.indexOf(card.url) === 0}
                      aria-label={`Move image ${index + 1} left`}
                      className={cn(
                        ADMIN_QUIET_BUTTON_CLASS,
                        "min-h-9 min-w-9 px-1",
                        value.indexOf(card.url) === 0 &&
                          "pointer-events-none opacity-30",
                      )}
                    >
                      &larr;
                    </button>

                    <button
                      type="button"
                      onClick={() => move(value.indexOf(card.url), 1)}
                      disabled={value.indexOf(card.url) === value.length - 1}
                      aria-label={`Move image ${index + 1} right`}
                      className={cn(
                        ADMIN_QUIET_BUTTON_CLASS,
                        "min-h-9 min-w-9 px-1",
                        value.indexOf(card.url) === value.length - 1 &&
                          "pointer-events-none opacity-30",
                      )}
                    >
                      &rarr;
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      onChange(value.filter((entry) => entry !== card.url))
                    }
                    aria-label={`Remove image ${index + 1}`}
                    className={cn(ADMIN_QUIET_BUTTON_CLASS, "min-h-9 px-1")}
                  >
                    Remove
                  </button>
                </div>
              </li>
            ) : (
              <li
                key={`pending-${card.item.id}`}
                className="flex flex-col gap-2 border border-black/10 p-2"
              >
                <div className="relative aspect-square w-full overflow-hidden bg-black/5">
                  {card.item.localUrl ? (
                    <img
                      src={card.item.localUrl}
                      alt="New image"
                      className="absolute inset-0 size-full object-cover"
                    />
                  ) : (
                    <span className="flex h-full items-center justify-center px-3 text-center text-[10px] tracking-[0.1em] text-black/30 uppercase">
                      No preview
                    </span>
                  )}

                  {card.item.status === "uploading" ||
                  card.item.status === "settling" ? (
                    <UploadOverlay
                      progress={card.item.progress}
                      finished={card.item.status === "settling"}
                    />
                  ) : null}

                  {index === 0 ? (
                    <span className="absolute top-0 left-0 bg-plum px-2 py-1 text-[10px] tracking-[0.1em] text-white uppercase">
                      Main
                    </span>
                  ) : null}
                </div>

                {card.item.status === "failed" && card.item.error ? (
                  <p role="alert" className="text-xs text-plum">
                    {card.item.error}
                  </p>
                ) : null}

                {card.item.status === "failed" ? (
                  <button
                    type="button"
                    onClick={() => removePending(card.item.id)}
                    aria-label="Remove this image"
                    className={cn(ADMIN_QUIET_BUTTON_CLASS, "min-h-9 self-start px-1")}
                  >
                    Remove
                  </button>
                ) : null}
              </li>
            ),
          )}
        </ul>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={disabled}
            className={cn(
              "inline-flex min-h-11 items-center justify-center border border-dashed border-black/30 px-5 text-xs tracking-[0.16em] text-black/60 uppercase transition-colors hover:border-plum hover:text-plum",
              disabled && "pointer-events-none opacity-40",
            )}
          >
            Add image
          </button>

          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="sr-only"
            disabled={disabled}
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              // Lets the same file be chosen again after a failure.
              event.target.value = "";
              if (!files.length) return;

              void uploadFiles(files);
            }}
          />
        </div>

        {batchBusy ? (
          <p className="text-xs text-black/50">Uploading…</p>
        ) : null}

        {!batchBusy && notice ? (
          <p className="text-xs text-plum">{notice}</p>
        ) : null}
      </div>

      {full ? (
        <p className="text-xs text-plum">
          This gallery is full. Remove an image to add another.
        </p>
      ) : null}

      {hint ? <p className="text-xs text-black/45">{hint}</p> : null}
    </div>
  );
}

/**
 * One image: preview, replace, remove, upload progress and errors.
 *
 * The saved image is a plain URL string and is rendered as-is; only a freshly
 * chosen file ever gets an object URL, and only when it really is a Blob.
 */
function ImageSlot({
  value,
  onChange,
  folder,
  label,
  onBusyChange,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
  folder: UploadFolder;
  label: string;
  onBusyChange?: (busy: boolean) => void;
}) {
  const inputId = useId();
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [swapError, setSwapError] = useState<string | null>(null);
  const [localUrl, setLocalUrl] = useState<string | null>(null);
  const [settledUrl, setSettledUrl] = useState<string | null>(null);

  // Bumped whenever the preview is replaced or cleared, so an upload or a preload
  // that finishes afterwards knows to leave the newer preview alone.
  const generationRef = useRef(0);

  const busy = progress !== null;
  useBusyReporter(busy, onBusyChange);

  // `localUrl` only ever holds an object URL this slot created for the file
  // that was just chosen. It is revoked here whenever the preview is replaced
  // or cleared, and when the slot unmounts, so nothing leaks.
  useEffect(() => {
    if (!localUrl) return;
    return () => URL.revokeObjectURL(localUrl);
  }, [localUrl]);

  // The local preview wins until the URL it produced has actually loaded —
  // that is what stops the box going blank between the two.
  const showLocal =
    localUrl !== null && !(settledUrl !== null && settledUrl === value);
  const displayUrl = showLocal ? localUrl : value;

  /** Clears the preview *and* the stored value behind it. */
  const clearSlot = () => {
    generationRef.current += 1;
    setLocalUrl(null);
    setSettledUrl(null);
    setError(null);
    setSwapError(null);
    setProgress(null);
    onChange(null);
  };

  const chooseFile = async (file: File) => {
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    const isCurrent = () => generationRef.current === generation;

    const url = previewObjectUrl(file);
    setLocalUrl(url);
    setSettledUrl(null);
    setError(null);
    setSwapError(null);
    setProgress(url ? 0 : null);

    if (!url) {
      setError("That file could not be previewed. Please choose another image.");
      return;
    }

    const outcome = await runUpload(folder, file, (percent) =>
      setProgress(percent),
    );
    if (!isCurrent()) return;

    setProgress(null);

    if (!outcome.ok) {
      // The preview stays: the admin can see what was rejected and choose again.
      setError(outcome.error);
      return;
    }

    // The form gets the public URL straight away, so Save works from now on.
    onChange(outcome.url);

    const loaded = await preloadStoredImage(outcome.url);
    if (!isCurrent()) return;

    if (loaded) {
      // The stored URL is in the browser cache now, so swapping to it is
      // instant — no empty frame between the preview and the saved image.
      setSettledUrl(outcome.url);
    } else {
      setSwapError(
        "Uploaded, but that image could not be loaded here. The preview is kept — remove it and try again if it looks wrong.",
      );
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="relative aspect-[4/3] w-full overflow-hidden border border-black/10 bg-black/5">
        {displayUrl ? (
          <img
            src={displayUrl}
            alt={label}
            className="absolute inset-0 size-full object-cover"
          />
        ) : (
          <span className="flex h-full items-center justify-center text-xs tracking-[0.16em] text-black/30 uppercase">
            No image
          </span>
        )}

        {busy ? <UploadOverlay progress={progress} /> : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          id={inputId}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;

            void chooseFile(file);
          }}
        />

        <label
          htmlFor={inputId}
          className={cn(
            "inline-flex min-h-11 cursor-pointer items-center justify-center border border-black/20 px-4 text-xs tracking-[0.16em] text-black uppercase transition-colors hover:border-black",
            busy && "pointer-events-none opacity-50",
          )}
        >
          {value || localUrl ? "Replace image" : "Choose image"}
        </label>

        {value || localUrl ? (
          <button
            type="button"
            onClick={clearSlot}
            disabled={busy}
            className={cn(
              ADMIN_QUIET_BUTTON_CLASS,
              "px-3",
              busy && "pointer-events-none opacity-50",
            )}
          >
            Remove
          </button>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="text-xs text-plum">
          {error}
        </p>
      ) : null}

      {swapError ? (
        <p className="text-xs text-black/55">{swapError}</p>
      ) : null}
    </div>
  );
}

/** The progress state shown on top of a preview while its upload runs. */
function UploadOverlay({
  progress,
  finished,
}: {
  progress: number | null;
  finished?: boolean;
}) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/75 px-6 text-center">
      <div className="h-1 w-full max-w-44 bg-black/10">
        <div
          className="h-1 bg-plum transition-[width] duration-150"
          style={{ width: `${Math.max(progress ?? 0, 4)}%` }}
        />
      </div>
      <p className="text-xs text-black/60">
        {finished ? "Finishing…" : `Uploading… ${progress ?? 0}%`}
      </p>
    </div>
  );
}

/**
 * Tells the form when this field has an upload in flight.
 *
 * Reported only on a real change, and always reported as idle again when the
 * field unmounts, so a form can never be left holding a busy flag it will
 * never see cleared.
 */
function useBusyReporter(
  busy: boolean,
  onBusyChange?: (busy: boolean) => void,
) {
  const callbackRef = useRef(onBusyChange);
  const busyRef = useRef(false);

  useEffect(() => {
    callbackRef.current = onBusyChange;
  });

  useEffect(() => {
    if (busyRef.current === busy) return;
    busyRef.current = busy;
    callbackRef.current?.(busy);
  }, [busy]);

  useEffect(() => {
    return () => {
      if (!busyRef.current) return;
      busyRef.current = false;
      callbackRef.current?.(false);
    };
  }, []);
}

/**
 * An object URL for a freshly chosen file, or null for anything that is not a
 * real File/Blob. A saved image URL string must never reach
 * `URL.createObjectURL` — it throws "Overload resolution failed".
 */
function previewObjectUrl(value: unknown): string | null {
  if (value instanceof File || value instanceof Blob) {
    return URL.createObjectURL(value);
  }

  return null;
}

/** True once the browser has really loaded the image, false if it never will. */
function preloadStoredImage(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;

    const image = new Image();
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve(false);
    }, 15000);

    image.onload = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(true);
    };

    image.onerror = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(false);
    };

    image.src = url;
  });
}

type UploadOutcome = { ok: true; url: string } | { ok: false; error: string };

/**
 * Validates, signs, uploads and returns the public URL.
 *
 * It touches no component state, which is what lets one copy of it serve both
 * the single slot (one progress number) and the gallery (a progress number per
 * card).
 */
async function runUpload(
  folder: UploadFolder,
  file: File,
  onProgress: (percent: number) => void,
): Promise<UploadOutcome> {
  const problem = describeImageProblem(file);
  if (problem) return { ok: false, error: problem };

  onProgress(0);

  try {
    const ticket = await requestImageUpload({
      folder,
      contentType: file.type,
      size: file.size,
    });

    if (!ticket.ok) return { ok: false, error: ticket.error };

    return await uploadWithSignedUrl(ticket.ticket, file, onProgress);
  } catch (caught) {
    return {
      ok: false,
      error:
        caught instanceof Error && caught.message
          ? caught.message
          : "That image could not be uploaded. Please try again.",
    };
  }
}

/**
 * PUTs a signed ticket's file and reports its progress. Shared by the single
 * slot and the gallery's parallel pool.
 */
async function uploadWithSignedUrl(
  ticket: UploadTicket,
  file: File,
  onProgress: (percent: number) => void,
): Promise<UploadOutcome> {
  await putToSignedUrl(ticket.signedUrl, file, onProgress);
  onProgress(100);

  return { ok: true, url: ticket.publicUrl };
}

/**
 * Runs `count` units of work with at most `limit` of them in flight at once.
 * Results come back in input order, never the order they finished in.
 */
async function mapPool<T>(
  count: number,
  limit: number,
  work: (index: number) => Promise<T>,
): Promise<T[]> {
  const results = new Array<T>(count);
  let cursor = 0;
  let settled = 0;

  await new Promise<void>((resolve, reject) => {
    const launch = () => {
      while (settled < count && cursor - settled < limit) {
        const index = cursor;
        cursor += 1;

        void work(index).then(
          (value) => {
            results[index] = value;
            settled += 1;
            if (settled === count) resolve();
            else launch();
          },
          (error: unknown) => reject(error),
        );
      }
    };

    launch();
  });

  return results;
}

/**
 * PUTs the file to the signed upload URL.
 *
 * This is what `supabase.storage.uploadToSignedUrl` does internally, written with
 * `XMLHttpRequest` rather than `fetch` purely for `upload.onprogress`. The
 * `Authorization` header carries the project's public key — the same browser-safe
 * key the storefront already uses — and the token in the URL is what authorises
 * this one object.
 */
function putToSignedUrl(
  signedUrl: string,
  file: File,
  onProgress: (percent: number) => void,
): Promise<void> {
  const { anonKey } = getSupabasePublicEnv();

  if (!anonKey) {
    return Promise.reject(new Error("Supabase is not configured."));
  }

  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", signedUrl);
    request.setRequestHeader("Authorization", `Bearer ${anonKey}`);
    request.setRequestHeader("apikey", anonKey);
    request.setRequestHeader("content-type", file.type);
    request.setRequestHeader("cache-control", "max-age=3600");
    request.setRequestHeader("x-upsert", "true");

    request.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress(100);
        resolve();
        return;
      }

      reject(new Error(uploadErrorMessage(request.status, request.responseText)));
    };

    request.onerror = () =>
      reject(new Error("That image could not be uploaded. Please try again."));

    request.send(file);
  });
}

/** Turns a Storage error body into something an admin can act on. */
function uploadErrorMessage(status: number, body: string): string {
  if (status === 413) return "That image is larger than 5 MB.";
  if (status === 415) return "Images must be JPEG, PNG or WebP.";

  let message = "";

  try {
    const parsed = JSON.parse(body) as { error?: string; message?: string };
    message = parsed.error ?? parsed.message ?? "";
  } catch {
    message = "";
  }

  return message || "That image could not be uploaded. Please try again.";
}
