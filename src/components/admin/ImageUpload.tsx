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
  type UploadBatchResult,
  type UploadTicket,
  type UploadTicketResult,
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
    } catch (caught) {
      // Nothing in `uploadItems` should reach this line any more, but a batch
      // must never be left with cards stuck on "Uploading…" forever.
      console.error("[admin] image upload batch failed.", caught);
      const message = describeUploadError(caught);
      for (const card of pendingRef.current) {
        if (card.uploadedUrl !== null || card.status === "failed") continue;
        patch(card.id, { status: "failed", progress: null, error: message });
      }
    } finally {
      setBatchBusy(false);
    }
  };

  const uploadItems = async (items: AsyncUploadItem[]) => {
    let failed = false;

    /** Fails one preview card, showing and logging the real reason. */
    const failItem = (item: AsyncUploadItem, message: string) => {
      console.error(`[admin] image upload failed (${item.file.name}).`, message);
      patch(item.id, { status: "failed", progress: null, error: message });
      failed = true;
    };

    // Files that could not be previewed are already failed; do not waste a
    // signed URL or a PUT on them.
    const uploadable = items.filter((item) => item.localUrl !== null);

    for (const item of items) {
      if (item.localUrl) continue;
      failItem(
        item,
        "That file could not be previewed. Please choose another image.",
      );
    }

    if (uploadable.length === 0) {
      if (!failed) setNotice("All images uploaded");
      return;
    }

    // One signed-URL request covers the whole batch. It can fail as a whole
    // (a missing env var, a missing bucket, a rejected admin session) or come
    // back without a ticket for a particular file — both are reported on the
    // affected cards instead of throwing the whole batch away.
    let ticketResult: UploadBatchResult | undefined;

    try {
      ticketResult = await requestImageUploads({
        folder,
        files: uploadable.map((item) => ({
          contentType: item.file.type,
          size: item.file.size,
        })),
      });
    } catch (caught) {
      console.error("[admin] could not request upload tickets.", caught);
      const message = describeUploadError(caught);
      for (const item of uploadable) {
        failItem(item, message);
      }
      return;
    }

    const tickets =
      ticketResult?.ok === true && Array.isArray(ticketResult.tickets)
        ? ticketResult.tickets
        : null;

    if (tickets === null) {
      const message =
        ticketResult !== undefined && ticketResult.ok === false
          ? ticketResult.error
          : "The server did not issue upload tickets. Please try again.";
      console.error("[admin] upload tickets were not issued.", message);
      for (const item of uploadable) {
        failItem(item, message);
      }
      return;
    }

    if (tickets.length !== uploadable.length) {
      console.error(
        `[admin] expected ${uploadable.length} upload ticket(s), received ${tickets.length}.`,
      );
    }

    // Results come back in pick order regardless of when each PUT finished, so
    // the success list never shuffles the gallery. `mapPool` guarantees one
    // entry per file, so a failure on one image cannot hide the others.
    const results = await mapPool(
      uploadable.length,
      GALLERY_UPLOAD_PARALLELISM,
      async (index) => {
        const item = uploadable[index];

        if (!item) {
          return {
            ok: false as const,
            error: "That image is no longer part of this upload. Please try again.",
          };
        }

        const ticket: UploadTicketResult | undefined = tickets[index];

        if (!ticket) {
          return {
            ok: false as const,
            error: `The server did not issue an upload ticket for image ${index + 1} of ${uploadable.length}. Please try again.`,
          };
        }

        if (!ticket.ok) {
          return { ok: false as const, error: ticket.error };
        }

        if (typeof ticket.ticket?.signedUrl !== "string" || !ticket.ticket.publicUrl) {
          return {
            ok: false as const,
            error: "The server issued an unusable upload ticket. Please try again.",
          };
        }

        return uploadWithSignedUrl(ticket.ticket, item.file, (percent) =>
          patch(item.id, { progress: percent }),
        );
      },
    );

    for (let index = 0; index < uploadable.length; index += 1) {
      const item = uploadable[index];
      const outcome = results[index]?.outcome;

      if (!item) continue;

      if (!outcome) {
        failItem(item, "No result came back for this image. Please try again.");
        continue;
      }

      if (!outcome.ok) {
        failItem(item, outcome.error);
        continue;
      }

      // The form value takes the URL now; the card stays until it has loaded.
      try {
        patch(item.id, {
          uploadedUrl: outcome.url,
          progress: 100,
          status: "settling",
        });
        append(outcome.url);

        if (await preloadStoredImage(outcome.url)) {
          dropCard(item.id, item.localUrl);
        } else {
          failItem(
            item,
            "Uploaded, but that image could not be loaded here. Remove it and try again.",
          );
        }
      } catch (caught) {
        console.error("[admin] could not finish an uploaded image.", caught);
        failItem(item, describeUploadError(caught));
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
      console.error(
        "[admin] uploaded image could not be loaded here.",
        outcome.url,
      );
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

/** What an exception or a server refusal looks like to the admin. */
function describeUploadError(caught: unknown): string {
  if (caught instanceof Error && caught.message) return caught.message;
  if (typeof caught === "string" && caught.trim()) return caught;
  return "That image could not be uploaded. Please try again.";
}

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

    if (!ticket.ok) {
      console.error(`[admin] upload was not signed (${file.name}).`, ticket.error);
      return { ok: false, error: ticket.error };
    }

    return await uploadWithSignedUrl(ticket.ticket, file, onProgress);
  } catch (caught) {
    console.error(`[admin] image upload failed (${file.name}).`, caught);
    return { ok: false, error: describeUploadError(caught) };
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
  try {
    await putToSignedUrl(ticket.signedUrl, file, onProgress);
  } catch (caught) {
    console.error(`[admin] storage rejected the upload (${file.name}).`, describeUploadError(caught));
    return { ok: false, error: describeUploadError(caught) };
  }

  onProgress(100);

  return { ok: true, url: ticket.publicUrl };
}

/**
 * One indexed result of the pool below.
 */
type IndexedOutcome = { index: number; outcome: UploadOutcome };

/**
 * Runs `count` units of work with at most `limit` of them in flight at once.
 *
 * Guarantees, whatever the workers do:
 *
 * - exactly `count` entries, in input order — never a hole and never a longer
 *   array (an out-of-range index used to be launched, which let the pool report
 *   itself finished while a real upload was still in flight and left the hole
 *   the caller then crashed on);
 * - a worker that throws or rejects becomes a failure entry for *its own* index
 *   only — it never rejects the pool and never disturbs the other files;
 * - `count <= 0` returns immediately instead of waiting forever.
 */
async function mapPool(
  count: number,
  limit: number,
  work: (index: number) => Promise<UploadOutcome>,
): Promise<IndexedOutcome[]> {
  const total = Number.isFinite(count) ? Math.max(Math.floor(count), 0) : 0;
  const results = new Array<IndexedOutcome | undefined>(total);

  // A plain cursor: read and bumped in the same synchronous step, so no two
  // workers can take the same index and none can be skipped.
  let cursor = 0;

  const runWorker = async (): Promise<void> => {
    for (;;) {
      const index = cursor;
      if (index >= total) return;
      cursor += 1;

      let outcome: UploadOutcome;
      try {
        const value = await work(index);
        outcome = value ?? {
          ok: false,
          error: "That image could not be uploaded. Please try again.",
        };
      } catch (caught) {
        console.error(`[admin] image upload worker ${index} failed.`, caught);
        outcome = { ok: false, error: describeUploadError(caught) };
      }

      results[index] = { index, outcome };
    }
  };

  const workerCount = Math.min(
    Number.isFinite(limit) ? Math.max(Math.floor(limit), 1) : 1,
    total,
  );

  await Promise.all(
    Array.from({ length: workerCount }, () => runWorker()),
  );

  // Defence in depth: no slot may ever come back missing.
  return Array.from({ length: total }, (_, index) => {
    const entry = results[index];
    if (entry) return entry;
    return {
      index,
      outcome: {
        ok: false,
        error: "No result came back for this image. Please try again.",
      },
    };
  });
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
      reject(
        new Error(
          "Network error while uploading to storage. Check the connection and try again.",
        ),
      );

    request.onabort = () =>
      reject(new Error("The upload was interrupted. Please try again."));

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

  return message
    ? `Upload failed: ${status} - ${message}`
    : `Upload failed: ${status}. Please try again.`;
}
