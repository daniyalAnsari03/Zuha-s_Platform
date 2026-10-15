"use client";

import { useRef, type KeyboardEvent } from "react";

import { ADMIN_TEXTAREA_CLASS } from "@/components/admin/admin-fields";
import { cn } from "@/lib/utils";

/**
 * The dashboard's plain multi-line text field with the small "B" control above
 * it — used by the product Description field and the store-policy textareas.
 *
 * The column stays plain text: there is no rich editor and no HTML, only the
 * `**bold**` convention the storefront's `renderBoldText` understands. The
 * button is `type="button"` so it can never submit the form, and it swallows
 * `onMouseDown` so clicking it does not clear the textarea's selection first.
 *
 * Selection and focus are restored after the draft state lands (a controlled
 * textarea re-renders synchronously, so this has to wait a frame).
 */
export default function BoldTextarea({
  id,
  value,
  onChange,
  maxLength,
  rows,
  placeholder,
  className,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  rows?: number;
  placeholder?: string;
  className?: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /**
   * Wraps the current selection in `**` to make it bold, or strips the markers
   * when the selection is already wrapped (a toggle). Nothing selected inserts
   * `****` and leaves the cursor between the middle asterisks.
   */
  const toggleBold = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const current = textarea.value;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = current.slice(start, end);

    let next: string;
    let cursorStart: number;
    let cursorEnd: number;

    if (start === end) {
      next = `${current.slice(0, start)}****${current.slice(end)}`;
      cursorStart = start + 2;
      cursorEnd = cursorStart;
    } else if (
      current.slice(start - 2, start) === "**" &&
      current.slice(end, end + 2) === "**"
    ) {
      next = current.slice(0, start - 2) + selectedText + current.slice(end + 2);
      cursorStart = start - 2;
      cursorEnd = cursorStart + selectedText.length;
    } else if (
      selectedText.length >= 4 &&
      selectedText.startsWith("**") &&
      selectedText.endsWith("**")
    ) {
      const inner = selectedText.slice(2, -2);
      next = current.slice(0, start) + inner + current.slice(end);
      cursorStart = start;
      cursorEnd = cursorStart + inner.length;
    } else {
      next = current.slice(0, start) + `**${selectedText}**` + current.slice(end);
      cursorStart = start + 2;
      cursorEnd = cursorStart + selectedText.length;
    }

    onChange(next);

    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(cursorStart, cursorEnd);
    });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "b") {
      event.preventDefault();
      toggleBold();
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
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
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        maxLength={maxLength}
        rows={rows}
        placeholder={placeholder}
        className={cn(ADMIN_TEXTAREA_CLASS, className)}
      />
    </div>
  );
}
