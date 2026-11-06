"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
/* Admin list thumbnails are plain <img>, not next/image — see ImageUpload.tsx. */
/* eslint-disable @next/next/no-img-element */

import AdminDeleteButton from "@/components/admin/AdminDeleteButton";
import AdminDialog, { AdminDialogCancel } from "@/components/admin/AdminDialog";
import {
  ADMIN_INPUT_CLASS,
  ADMIN_PRIMARY_BUTTON_CLASS,
  ADMIN_SECONDARY_BUTTON_CLASS,
  AdminFeedback,
  AdminField,
  AdminSectionTitle,
  AdminUploadBusyNotice,
  useUploadBusy,
} from "@/components/admin/admin-fields";
import { ImageUpload } from "@/components/admin/ImageUpload";
import {
  deleteHomeSlide,
  moveHomeSlide,
  saveHomeSlide,
  setHomeSlideActive,
} from "@/lib/admin/home-slides";
import type {
  AdminHomeSlide,
  HomeSlidePlacement,
} from "@/lib/admin/queries";

const PLACEMENT_OPTIONS: { value: HomeSlidePlacement; label: string }[] = [
  { value: "first", label: "First (before Sale slide)" },
  { value: "after_sale", label: "After Sale slide, before categories" },
  {
    value: "after_categories",
    label: "After categories (before footer)",
  },
];

const PLACEMENT_LABELS: Record<HomeSlidePlacement, string> =
  Object.fromEntries(
    PLACEMENT_OPTIONS.map(({ value, label }) => [value, label]),
  ) as Record<HomeSlidePlacement, string>;

type SlideDraft = {
  id: string | null;
  desktopImageUrl: string | null;
  mobileImageUrl: string | null;
  placement: HomeSlidePlacement;
  isActive: boolean;
};

const EMPTY_DRAFT: SlideDraft = {
  id: null,
  desktopImageUrl: null,
  mobileImageUrl: null,
  placement: "first",
  isActive: true,
};

type Feedback = { tone: "success" | "error"; message: string } | null;

/**
 * Home Slides: add, edit, reorder, activate and delete the homepage's
 * informational slides.
 *
 * Same shape as the Team Members screen — a list of rows, one dialog form that
 * is remounted per slide so every field starts clean, and a delete that asks
 * first. Both images go through the shared `ImageUpload` into the
 * `store-images` bucket under `home/`, and the actions remove replaced files.
 *
 * Move up / Move down reorders inside the slide's own placement group only,
 * exactly like the resulting homepage stack.
 */
export default function HomeSlidesManager({
  slides,
  total,
  totalPages,
  currentPage,
}: {
  slides: AdminHomeSlide[];
  total: number;
  totalPages: number;
  currentPage: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [draft, setDraft] = useState<SlideDraft | null>(null);
  const [status, setStatus] = useState<Feedback>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [paging, startPageTransition] = useTransition();

  const runSlideAction = (
    slide: AdminHomeSlide,
    action: () => Promise<{ ok: true; message: string } | { ok: false; error: string }>,
  ) => {
    setStatus(null);
    setBusyId(slide.id);

    startTransition(async () => {
      const result = await action();
      setBusyId(null);

      setStatus(
        result.ok
          ? { tone: "success", message: result.message }
          : { tone: "error", message: result.error },
      );
    });
  };

  const setPage = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (page > 1) params.set("page", String(page));
    else params.delete("page");
    startPageTransition(() => {
      router.push(`?${params.toString()}`, { scroll: false });
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-black/60">
          {total === 0
            ? "No home slides yet."
            : `${total} ${total === 1 ? "slide" : "slides"}`}
        </p>

        <button
          type="button"
          onClick={() => setDraft({ ...EMPTY_DRAFT })}
          className={ADMIN_PRIMARY_BUTTON_CLASS}
        >
          Add slide
        </button>
      </div>

      {status ? <AdminFeedback status={status} /> : null}

      {slides.length === 0 ? (
        <p className="border border-dashed border-black/15 px-4 py-10 text-center text-sm text-black/50">
          Add a slide for an extra full-bleed image in the homepage slider — no
          text, no link, just the picture.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-black/10 border border-black/10">
          {slides.map((slide, index) => {
            const prev = slides[index - 1];
            const next = slides[index + 1];
            const isFirstInGroup = !prev || prev.placement !== slide.placement;
            const isLastInGroup = !next || next.placement !== slide.placement;

            return (
              <li
                key={slide.id}
                className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:gap-4 sm:p-4"
              >
                <div className="relative aspect-[3/2] w-20 shrink-0 overflow-hidden border border-black/10 bg-black/5 sm:w-24">
                  {slide.desktopImageUrl ? (
                    <img
                      src={slide.desktopImageUrl}
                      alt={PLACEMENT_LABELS[slide.placement]}
                      width={96}
                      height={64}
                      loading="lazy"
                      decoding="async"
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  ) : null}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {PLACEMENT_LABELS[slide.placement]}
                  </p>
                  <p className="mt-0.5 text-xs text-black/45">
                    {slide.mobileImageUrl
                      ? "Desktop + mobile image"
                      : "Desktop image only (mobile reuses it)"}
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 text-xs">
                    <span
                      className={
                        slide.isActive
                          ? "inline-block h-1.5 w-1.5 rounded-full bg-emerald-600"
                          : "inline-block h-1.5 w-1.5 rounded-full bg-black/30"
                      }
                    />
                    {slide.isActive ? "Active" : "Off"}
                    {slide.isActive ? " — showing on the homepage" : ""}
                  </p>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2 self-end sm:self-auto">
                  <button
                    type="button"
                    onClick={() =>
                      runSlideAction(slide, () =>
                        moveHomeSlide({ id: slide.id, direction: "up" }),
                      )
                    }
                    disabled={pending || isFirstInGroup || busyId === slide.id}
                    aria-label="Move up"
                    title="Move up"
                    className={ADMIN_SECONDARY_BUTTON_CLASS}
                  >
                    ↑
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      runSlideAction(slide, () =>
                        moveHomeSlide({ id: slide.id, direction: "down" }),
                      )
                    }
                    disabled={pending || isLastInGroup || busyId === slide.id}
                    aria-label="Move down"
                    title="Move down"
                    className={ADMIN_SECONDARY_BUTTON_CLASS}
                  >
                    ↓
                  </button>

                  <label className="flex items-center gap-2 border border-black/20 px-2.5 py-1.5 text-xs">
                    <input
                      type="checkbox"
                      checked={slide.isActive}
                      disabled={pending}
                      onChange={(event) =>
                        runSlideAction(slide, () =>
                          setHomeSlideActive({
                            id: slide.id,
                            active: event.target.checked,
                          }),
                        )
                      }
                      className="h-4 w-4 accent-plum"
                    />
                    Active
                  </label>

                  <button
                    type="button"
                    onClick={() =>
                      setDraft({
                        id: slide.id,
                        desktopImageUrl: slide.desktopImageUrl,
                        mobileImageUrl: slide.mobileImageUrl,
                        placement: slide.placement,
                        isActive: slide.isActive,
                      })
                    }
                    className={ADMIN_SECONDARY_BUTTON_CLASS}
                  >
                    Edit
                  </button>

                  <AdminDeleteButton
                    label="Delete"
                    itemName="this home slide"
                    warning="This also deletes the slide's image files."
                    onConfirm={() => deleteHomeSlide({ id: slide.id })}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-black/60">
            Page {currentPage} of {totalPages} {total > 0 ? `(${total} total)` : ""}
          </p>

          <div className="flex gap-2">
            <button
              onClick={() => setPage(currentPage - 1)}
              disabled={currentPage === 1 || paging}
              className="px-3 py-1 border border-black/20 text-sm hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {paging ? "Loading..." : "Prev"}
            </button>

            <button
              onClick={() => setPage(currentPage + 1)}
              disabled={currentPage === totalPages || paging}
              className="px-3 py-1 border border-black/20 text-sm hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {paging ? "Loading..." : "Next"}
            </button>
          </div>
        </div>
      )}

      {draft ? (
        <HomeSlideForm
          key={draft.id ?? "new"}
          draft={draft}
          onClose={() => setDraft(null)}
        />
      ) : null}
    </div>
  );
}

function HomeSlideForm({
  draft,
  onClose,
}: {
  draft: SlideDraft;
  onClose: () => void;
}) {
  const [desktopImageUrl, setDesktopImageUrl] = useState<string | null>(
    draft.desktopImageUrl,
  );
  const [mobileImageUrl, setMobileImageUrl] = useState<string | null>(
    draft.mobileImageUrl,
  );
  const [placement, setPlacement] = useState<HomeSlidePlacement>(
    draft.placement,
  );
  const [isActive, setIsActive] = useState(draft.isActive);
  const [status, setStatus] = useState<Feedback>(null);
  const [pending, startTransition] = useTransition();
  const { uploadsBusy, reportUploadBusy } = useUploadBusy();

  const editing = draft.id !== null;

  const save = () => {
    setStatus(null);

    startTransition(async () => {
      const result = await saveHomeSlide({
        id: draft.id,
        desktopImageUrl,
        mobileImageUrl,
        placement,
        isActive,
      });

      if (!result.ok) {
        setStatus({ tone: "error", message: result.error });
        return;
      }

      onClose();
    });
  };

  return (
    <AdminDialog
      open
      onClose={onClose}
      title={editing ? "Edit home slide" : "Add home slide"}
      description="A full-bleed, non-clickable image in the homepage slider — no text, no link."
      footer={
        <>
          <AdminUploadBusyNotice busy={uploadsBusy} />
          <AdminDialogCancel onClose={onClose} />
          <button
            type="button"
            onClick={save}
            disabled={pending || uploadsBusy}
            className={ADMIN_PRIMARY_BUTTON_CLASS}
          >
            {pending ? "Saving..." : "Save slide"}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <ImageUpload
          label="Desktop Image"
          required
          value={desktopImageUrl}
          onChange={setDesktopImageUrl}
          folder="home"
          hint="Tablets and desktops show this; mobile falls back to it too when no mobile image is set."
          onBusyChange={reportUploadBusy}
        />

        <ImageUpload
          label="Mobile Image (optional)"
          value={mobileImageUrl}
          onChange={setMobileImageUrl}
          folder="home"
          hint="Shown on phones instead of the desktop image."
          onBusyChange={reportUploadBusy}
        />

        <AdminField
          label="Placement"
          htmlFor="home-slide-placement"
          required
          hint="Where the slide sits in the homepage stack."
        >
          <select
            id="home-slide-placement"
            value={placement}
            onChange={(event) =>
              setPlacement(event.target.value as HomeSlidePlacement)
            }
            className={ADMIN_INPUT_CLASS}
          >
            {PLACEMENT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </AdminField>

        <AdminSectionTitle>Visibility</AdminSectionTitle>

        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(event) => setIsActive(event.target.checked)}
            className="h-4 w-4 accent-plum"
          />
          Active — show this slide on the homepage
        </label>

        <AdminFeedback status={status} />
      </div>
    </AdminDialog>
  );
}
