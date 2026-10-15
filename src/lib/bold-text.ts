import { createElement, type ReactNode } from "react";

/**
 * The storefront's safe inline formatter for admin-written plain text.
 *
 * The admin may wrap a run of characters in `**` to make it bold (the "B"
 * button above the product Description field and the policy textareas). This
 * is the only piece of markup allowed: no italic, headings, links, lists or
 * images. The text is never rendered as HTML — every run is passed to React as
 * a child, so React escapes it and nothing a stored value contains can become
 * markup.
 *
 * Edge cases, all of which render without throwing:
 * - an unmatched `**` (odd count) is shown as ordinary text;
 * - an empty `****` is ignored (nothing is rendered for it) — it is what the
 *   "B" button leaves behind when nothing was selected;
 * - text written before `**` existed keeps working as plain text.
 *
 * The caller owns the surrounding element, so line breaks (`white-space:
 * pre-line`) and the long-word wrapping rules still apply.
 */
const BOLD_PATTERN = /\*\*([\s\S]*?)\*\*/g;

/**
 * Turns stored plain text into React nodes, converting each `**bold**` run into
 * a `<strong>` and leaving every other character untouched.
 */
export function renderBoldText(text: string): ReactNode {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;

  BOLD_PATTERN.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = BOLD_PATTERN.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    if (match[1].length > 0) {
      nodes.push(
        createElement("strong", { key: `bold-${nodes.length}` }, match[1]),
      );
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

/**
 * The same text without its `**` markers, collapsed onto one line — for places
 * that need a plain string rather than React nodes (the product page's meta
 * description, for example, so a search result never shows the markers). Only
 * matched pairs and empty `****` are unwrapped; an unmatched `**` stays.
 */
export function boldTextToPlainText(text: string): string {
  return text
    .replace(BOLD_PATTERN, (_, run: string) => run)
    .replace(/\s+/g, " ")
    .trim();
}
