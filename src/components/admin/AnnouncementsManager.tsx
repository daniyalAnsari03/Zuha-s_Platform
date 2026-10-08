"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

import AdminDeleteButton from "@/components/admin/AdminDeleteButton";
import {
  ADMIN_INPUT_CLASS,
  ADMIN_PRIMARY_BUTTON_CLASS,
  AdminField,
  AdminFeedback,
} from "@/components/admin/admin-fields";
import { addAnnouncement, removeAnnouncement } from "@/lib/admin/announcements";
import type { AdminAnnouncement } from "@/lib/admin/queries";
import { MAX_LINE_LENGTH } from "@/lib/admin/validation";
import { formatOrderDate } from "@/lib/order-types";

/**
 * The Announcement Bar screen: add a line to the homepage ticker, remove one.
 *
 * Each announcement is a single line of text — exactly what the ticker shows —
 * so the whole screen is one field and a list. Both actions run on the server
 * behind `requireAdmin()` and immediately re-render this page with the new
 * list, while revalidating `/` for the homepage ticker.
 *
 * There is deliberately no edit: the ticker's lines are added and removed, and
 * anything more would be a feature the spec does not describe.
 */
export default function AnnouncementsManager({
  announcements,
  total,
  totalPages,
  currentPage,
}: {
  announcements: AdminAnnouncement[];
  total: number;
  totalPages: number;
  currentPage: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [text, setText] = useState("");
  const [status, setStatus] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const [pending, startTransition] = useTransition();
  const [paging, startPageTransition] = useTransition();

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (pending) return;

    setStatus(null);

    startTransition(async () => {
      const result = await addAnnouncement({ text });

      setStatus(
        result.ok
          ? { tone: "success", message: result.message }
          : { tone: "error", message: result.error },
      );

      if (result.ok) {
        setText("");
      }
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
      <form onSubmit={submit} className="flex flex-col gap-3 border border-black/10 p-4">
        <AdminField
          label="New announcement"
          htmlFor="announcement-text"
          required
          className="w-full max-w-lg"
          hint="Shown as a scrolling ticker at the top of the homepage."
        >
          <input
            id="announcement-text"
            type="text"
            value={text}
            onChange={(event) => setText(event.target.value)}
            maxLength={MAX_LINE_LENGTH}
            placeholder="Free delivery on orders over PKR 5,000"
            className={ADMIN_INPUT_CLASS}
          />
        </AdminField>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={pending || text.trim() === ""}
            className={ADMIN_PRIMARY_BUTTON_CLASS}
          >
            {pending ? "Adding..." : "Add"}
          </button>

          <div className="min-w-0 flex-1">
            <AdminFeedback status={status} />
          </div>
        </div>
      </form>

      <section className="flex flex-col gap-4">
        <h2 className="text-xs tracking-[0.2em] text-black/50 uppercase">
          On the ticker
        </h2>

        {announcements.length === 0 ? (
          <p className="border border-dashed border-black/15 px-4 py-10 text-center text-sm text-black/50">
            Nothing on the ticker yet. The announcement bar sits empty until you
            add one.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-black/10 border border-black/10">
            {announcements.map((announcement) => (
              <li
                key={announcement.id}
                className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:gap-4 sm:p-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm">{announcement.text}</p>
                  <p className="mt-0.5 text-xs text-black/45">
                    Added {formatOrderDate(announcement.createdAt)}
                  </p>
                </div>

                <div className="shrink-0 self-end sm:self-auto">
                  <AdminDeleteButton
                    label="Remove"
                    itemName={`“${announcement.text}”`}
                    onConfirm={() =>
                      removeAnnouncement({ id: announcement.id })
                    }
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

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
    </div>
  );
}
