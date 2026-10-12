"use client";

import { useRef, useState, useTransition } from "react";

import {
  ADMIN_PRIMARY_BUTTON_CLASS,
  ADMIN_TEXTAREA_CLASS,
  AdminFeedback,
  AdminField,
  AdminSectionTitle,
} from "@/components/admin/admin-fields";
import { saveStorePolicy } from "@/lib/admin/policies";
import type { AdminStorePolicy } from "@/lib/admin/queries";
import { MAX_POLICY_LENGTH } from "@/lib/admin/validation";
import { cn } from "@/lib/utils";

/**
 * Settings: the four public policy pages (Privacy Policy, Refund Policy, Terms
 * of Service, Shipping Policy).
 *
 * Four tabs, one plain textarea and a Save button — no rich editor. Edits are
 * held per slug, so switching tabs never loses an unsaved draft; only Save
 * writes. The server action re-validates the slug and the body and expires the
 * policies cache tag, which is what the storefront pages read.
 */
export default function StorePoliciesManager({
  policies,
}: {
  policies: AdminStorePolicy[];
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(policies.map((policy) => [policy.slug, policy.content])),
  );
  const [selected, setSelected] = useState<string>(policies[0]?.slug ?? "");
  const [status, setStatus] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const [pending, startTransition] = useTransition();

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const current = policies.find((policy) => policy.slug === selected);

  const select = (slug: string) => {
    setSelected(slug);
    setStatus(null);
  };

  const edit = (value: string) => {
    setDrafts((current) => ({ ...current, [selected]: value }));
    setStatus(null);
  };

  /**
   * Wraps the current textarea selection in `**` to make it bold, or strips the
   * markers when the selection is already wrapped (a toggle). Nothing selected
   * inserts `****` and leaves the cursor between the middle asterisks. Selection
   * and focus are restored after the draft state lands.
   */
  const toggleBold = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const value = textarea.value;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.slice(start, end);

    let next: string;
    let cursorStart: number;
    let cursorEnd: number;

    if (start === end) {
      next = `${value.slice(0, start)}****${value.slice(end)}`;
      cursorStart = start + 2;
      cursorEnd = cursorStart;
    } else if (value.slice(start - 2, start) === "**" && value.slice(end, end + 2) === "**") {
      next = value.slice(0, start - 2) + selectedText + value.slice(end + 2);
      cursorStart = start - 2;
      cursorEnd = cursorStart + selectedText.length;
    } else if (
      selectedText.length >= 4 &&
      selectedText.startsWith("**") &&
      selectedText.endsWith("**")
    ) {
      const inner = selectedText.slice(2, -2);
      next = value.slice(0, start) + inner + value.slice(end);
      cursorStart = start;
      cursorEnd = cursorStart + inner.length;
    } else {
      next = value.slice(0, start) + `**${selectedText}**` + value.slice(end);
      cursorStart = start + 2;
      cursorEnd = cursorStart + selectedText.length;
    }

    edit(next);

    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(cursorStart, cursorEnd);
    });
  };

  const save = () => {
    if (!current || pending) return;

    setStatus(null);

    startTransition(async () => {
      const result = await saveStorePolicy(current.slug, drafts[selected] ?? "");

      setStatus(
        result.ok
          ? { tone: "success", message: result.message }
          : { tone: "error", message: result.error },
      );
    });
  };

  return (
    <section className="flex flex-col gap-5 border border-black/10 p-4 sm:p-5">
      <div className="flex flex-col gap-2">
        <AdminSectionTitle>Store policies</AdminSectionTitle>

        <p className="text-sm leading-relaxed text-black/60">
          The text shown on each policy page. Plain text, with a blank line
          between paragraphs — wrap a run of text in <span className="font-semibold">**</span> to
          make it bold.
        </p>
      </div>

      <div role="tablist" aria-label="Store policies" className="flex flex-wrap gap-2">
        {policies.map((policy) => {
          const isActive = policy.slug === selected;

          return (
            <button
              key={policy.slug}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => select(policy.slug)}
              className={cn(
                "min-h-11 border px-4 text-xs tracking-[0.16em] uppercase transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum",
                isActive
                  ? "border-plum bg-plum text-white"
                  : "border-black/15 text-black/70 hover:border-black hover:text-black",
              )}
            >
              {policy.title}
            </button>
          );
        })}
      </div>

      {current ? (
        <>
          <AdminField
            label={`${current.title} content`}
            htmlFor="policy-content"
            hint={`${(drafts[selected] ?? "").length} / ${MAX_POLICY_LENGTH} characters`}
          >
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleBold}
                  onMouseDown={(event) => event.preventDefault()}
                  aria-label="Bold"
                  title="Bold"
                  className="inline-flex h-9 w-9 items-center justify-center border border-black/15 bg-white text-sm font-bold text-black transition-colors hover:border-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum"
                >
                  B
                </button>

                <p className="text-xs text-black/45">
                  Select text and click B to make it bold.
                </p>
              </div>

              <textarea
                ref={textareaRef}
                id="policy-content"
                value={drafts[selected] ?? ""}
                onChange={(event) => edit(event.target.value)}
                onKeyDown={(event) => {
                  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "b") {
                    event.preventDefault();
                    toggleBold();
                  }
                }}
                maxLength={MAX_POLICY_LENGTH}
                rows={16}
                className={cn(ADMIN_TEXTAREA_CLASS, "min-h-[22rem] resize-y font-sans text-sm")}
                placeholder="Write the policy here. Use a blank line to start a new paragraph."
              />
            </div>
          </AdminField>

          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className={ADMIN_PRIMARY_BUTTON_CLASS}
            >
              {pending ? "Saving..." : "Save policy"}
            </button>

            <div className="min-w-0 flex-1">
              <AdminFeedback status={status} />
            </div>
          </div>
        </>
      ) : (
        <p className="text-sm text-black/60">No policy pages are available.</p>
      )}
    </section>
  );
}
