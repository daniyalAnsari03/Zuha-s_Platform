import { createElement, type ReactNode } from "react";

/**
 * The storefront's safe inline formatter for policy bodies.
 *
 * The admin writes plain text and may wrap a run of characters in `**` to make
 * it bold (Settings → Store Policies, the "B" button). This is the only piece of
 * markup allowed: no italic, headings, links, lists or images. The text is never
 * rendered as HTML — every run is passed to React as a child, so React escapes
 * it and nothing a stored value contains can become markup.
 *
 * The split requires a non-empty run between the markers
 * (`**`…`**`), so an unmatched or empty `**` (e.g. `****`) stays as ordinary
 * text and can never throw or swallow the rest of the paragraph.
 */
const BOLD_PATTERN = /\*\*([\s\S]+?)\*\*/g;

/**
 * Turns one paragraph of stored policy text into React nodes, converting each
 * `**bold**` run into a `<strong>` and leaving every other character untouched.
 * The caller keeps the surrounding paragraph element, so line breaks and the
 * long-word wrapping rules still apply.
 */
export function renderPolicyText(text: string): ReactNode {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;

  BOLD_PATTERN.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = BOLD_PATTERN.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    nodes.push(
      createElement("strong", { key: `bold-${nodes.length}` }, match[1]),
    );

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}
