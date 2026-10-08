"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

import AdminDeleteButton from "@/components/admin/AdminDeleteButton";
import AdminDialog from "@/components/admin/AdminDialog";
import {
  ADMIN_SECONDARY_BUTTON_CLASS,
  AdminFeedback,
} from "@/components/admin/admin-fields";
import { markContactMessageRead, removeContactMessage } from "@/lib/admin/messages";
import type { AdminContactMessage } from "@/lib/admin/queries";
import { formatOrderDate } from "@/lib/order-types";
import { cn } from "@/lib/utils";

/**
 * The Messages screen: what visitors sent from the /contact form.
 *
 * Newest first, one page at a time (the same query-param paging the
 * Announcement Bar screen uses). An unread row is bold with a plum dot; clicking
 * it opens the full message in a dialog and marks it read through its own
 * server action, which revalidates this route — so the list and the sidebar's
 * unread badge both settle on their own, with no `router.refresh()` here.
 *
 * Delete lives inside the dialog, behind the shared confirm dialog, so a
 * message can only be removed once someone has actually looked at it.
 */
export default function MessagesManager({
  messages,
  total,
  totalPages,
  currentPage,
}: {
  messages: AdminContactMessage[];
  total: number;
  totalPages: number;
  currentPage: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const [reading, startReadTransition] = useTransition();
  const [paging, startPageTransition] = useTransition();

  const selected = selectedId
    ? (messages.find((message) => message.id === selectedId) ?? null)
    : null;

  const open = (message: AdminContactMessage) => {
    setStatus(null);
    setSelectedId(message.id);

    if (message.isRead) return;

    startReadTransition(async () => {
      const result = await markContactMessageRead({ id: message.id });
      if (!result.ok) setStatus({ tone: "error", message: result.error });
    });
  };

  const close = () => {
    setSelectedId(null);
    setStatus(null);
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
    <div className="flex flex-col gap-4">
      {messages.length === 0 ? (
        <p className="border border-dashed border-black/15 px-4 py-10 text-center text-sm text-black/50">
          No messages yet. Anything sent from the contact form on /contact
          arrives here.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-black/10 border border-black/10">
          {messages.map((message) => (
            <li key={message.id}>
              <button
                type="button"
                onClick={() => open(message)}
                className="flex w-full flex-col gap-2 p-3 text-left transition-colors hover:bg-black/[0.02] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-plum sm:flex-row sm:items-start sm:gap-4 sm:p-4"
              >
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "flex items-center gap-2 text-sm",
                      !message.isRead && "font-semibold",
                    )}
                  >
                    {!message.isRead ? (
                      <span
                        aria-label="Unread"
                        className="size-1.5 shrink-0 rounded-full bg-plum"
                      />
                    ) : null}

                    <span className="truncate">
                      {message.name || message.email}
                    </span>
                  </p>

                  <p className="mt-0.5 truncate text-xs text-black/45">
                    {message.email}
                    {message.phone ? ` · ${message.phone}` : ""}
                  </p>

                  <p className="mt-1 truncate text-xs text-black/60">
                    {message.message}
                  </p>
                </div>

                <span className="shrink-0 text-xs whitespace-nowrap text-black/45">
                  {formatOrderDate(message.createdAt)}
                </span>
              </button>
            </li>
          ))}
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

      <AdminDialog
        open={selected !== null}
        onClose={close}
        title={selected ? `Message from ${selected.name || selected.email}` : "Message"}
        description={selected ? formatOrderDate(selected.createdAt) : undefined}
        footer={
          selected ? (
            <>
              <AdminDeleteButton
                label="Delete"
                itemName="this message"
                onConfirm={async () => {
                  const result = await removeContactMessage({ id: selected.id });
                  if (result.ok) close();
                  return result;
                }}
              />

              <button
                type="button"
                onClick={close}
                className={ADMIN_SECONDARY_BUTTON_CLASS}
              >
                Close
              </button>
            </>
          ) : null
        }
      >
        {selected ? (
          <div className="flex flex-col gap-4">
            <dl className="flex flex-col gap-2 text-sm">
              <div className="flex flex-wrap gap-x-3">
                <dt className="w-20 shrink-0 text-xs tracking-[0.16em] text-black/50 uppercase">
                  Name
                </dt>
                <dd className="min-w-0 flex-1 break-words">
                  {selected.name || "Not given"}
                </dd>
              </div>

              <div className="flex flex-wrap gap-x-3">
                <dt className="w-20 shrink-0 text-xs tracking-[0.16em] text-black/50 uppercase">
                  Email
                </dt>
                <dd className="min-w-0 flex-1 break-words">{selected.email}</dd>
              </div>

              <div className="flex flex-wrap gap-x-3">
                <dt className="w-20 shrink-0 text-xs tracking-[0.16em] text-black/50 uppercase">
                  Phone
                </dt>
                <dd className="min-w-0 flex-1 break-words">
                  {selected.phone || "Not given"}
                </dd>
              </div>
            </dl>

            <div className="border-t border-black/10 pt-4">
              <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                {selected.message}
              </p>
            </div>

            {reading ? (
              <p className="text-xs text-black/45">Marking as read...</p>
            ) : null}

            <AdminFeedback status={status} />
          </div>
        ) : null}
      </AdminDialog>
    </div>
  );
}
