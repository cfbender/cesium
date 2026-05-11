// Extracts visible plain text from an HTML body fragment.
// Used to populate the bodyText field on IndexEntry for full-text search.

import { parseFragment, defaultTreeAdapter as ta } from "parse5";
import type { DefaultTreeAdapterTypes } from "parse5";

type ChildNode = DefaultTreeAdapterTypes.ChildNode;

// Tags whose text content should be excluded from extraction.
const SKIP_TAGS = new Set(["script", "style", "noscript"]);

function collectText(node: ChildNode, parts: string[]): void {
  if (ta.isTextNode(node)) {
    parts.push(ta.getTextNodeContent(node));
    return;
  }

  if (!ta.isElementNode(node)) {
    // comment, doctype — skip
    return;
  }

  const tag = ta.getTagName(node).toLowerCase();
  if (SKIP_TAGS.has(tag)) {
    // Do not descend into script/style/noscript
    return;
  }

  const children = ta.getChildNodes(node) as ChildNode[];
  for (const child of children) {
    collectText(child, parts);
  }
}

/**
 * Extracts visible text content from an HTML body fragment.
 *
 * - Skips contents of <script>, <style>, and <noscript>.
 * - Collapses all whitespace runs to single spaces.
 * - Trims leading/trailing whitespace.
 * - Truncates to maxChars (default 5000), breaking at a word boundary
 *   (nearest preceding whitespace within the last 100 chars) when possible.
 *
 * Returns text as-written (not lowercased). Lowercasing happens at
 * search-attribute write time in index-gen.
 *
 * HTML entities are decoded automatically by parse5.
 *
 * This function is pure: same input always yields the same output.
 */
export function extractTextContent(htmlBody: string, maxChars: number = 5000): string {
  if (htmlBody.trim() === "") return "";

  const fragment = parseFragment(htmlBody);
  const parts: string[] = [];

  const children = ta.getChildNodes(fragment) as ChildNode[];
  for (const child of children) {
    collectText(child, parts);
  }

  // Join all text parts, collapse whitespace, trim
  const raw = parts.join(" ");
  const collapsed = raw.replace(/\s+/g, " ").trim();

  if (collapsed.length <= maxChars) {
    return collapsed;
  }

  // Truncate: try to break at a word boundary within last 100 chars
  const hardCut = maxChars;
  const windowStart = Math.max(0, hardCut - 100);
  const window = collapsed.slice(windowStart, hardCut);
  const lastSpace = window.lastIndexOf(" ");

  if (lastSpace !== -1) {
    // Break at the last space within the window
    return collapsed.slice(0, windowStart + lastSpace).trimEnd();
  }

  // No whitespace found in window — hard cut
  return collapsed.slice(0, hardCut);
}
