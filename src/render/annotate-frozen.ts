// Pure rendering functions for the frozen (post-verdict) annotate state.
// No I/O — only string-in, string-out.
//
// These are called from setVerdict to bake the static review into the HTML
// before the file is persisted. The client script still runs for positioning,
// but all interactive affordances are hidden by CSS.

import { escapeHtml, escapeAttr } from "./blocks/escape.ts";
import type { Comment, Verdict } from "./validate.ts";

// ─── Anchor humanization ──────────────────────────────────────────────────────
//
// Mirrors the client-side humanizeAnchor helper in client-js.ts so that
// server-rendered labels match what the client would have shown.
//
// "block-3"        → "Block 3"
// "block-3.line-12" → "Block 3 · line 12"

function humanizeAnchor(anchor: string): string {
  const parts = anchor.split(".");
  const blockPart = parts[0] ?? "";
  const blockNum = blockPart.replace("block-", "");
  if (parts.length === 1) {
    return `Block ${blockNum}`;
  }
  const linePart = parts[1] ?? "";
  const lineNum = linePart.replace("line-", "");
  return `Block ${blockNum} \u00b7 line ${lineNum}`;
}

// ─── renderFrozenBubble ───────────────────────────────────────────────────────

/** Renders a single read-only comment bubble (no delete button). */
export function renderFrozenBubble(comment: Comment): string {
  const label = escapeHtml(humanizeAnchor(comment.anchor));
  const text = escapeHtml(comment.comment);
  const commentIdAttr = escapeAttr(comment.id);
  const anchorAttr = escapeAttr(comment.anchor);

  const quoteBlock =
    comment.selectedText.trim() !== ""
      ? `\n  <blockquote class="cs-comment-bubble-quote">${escapeHtml(comment.selectedText)}</blockquote>`
      : "";

  return `<article class="cs-comment-bubble" data-comment-id="${commentIdAttr}" data-anchor="${anchorAttr}">
  <header class="cs-comment-bubble-head">
    <span class="cs-comment-anchor-label">${label}</span>
  </header>
  <p class="cs-comment-text">${text}</p>${quoteBlock}
</article>`;
}

// ─── renderFrozenRail ─────────────────────────────────────────────────────────

/** Renders the comment rail populated with all frozen bubbles. */
export function renderFrozenRail(comments: Comment[]): string {
  const inner = comments.map((c) => renderFrozenBubble(c)).join("\n");
  return `<aside class="cs-comment-rail" data-cesium-comment-rail aria-label="Review comments">${inner.length > 0 ? `\n${inner}\n` : ""}</aside>`;
}

// ─── renderVerdictPill ────────────────────────────────────────────────────────

const VERDICT_LABELS: Record<Verdict, string> = {
  approve: "Approved",
  request_changes: "Changes requested",
  comment: "Reviewed",
};

/** Formats an ISO date string as "Month DD, YYYY" (e.g. "May 13, 2026"). */
function formatDecidedAt(decidedAt: string): string {
  return new Date(decidedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Renders a verdict pill to display prominently near the top of the artifact. */
export function renderVerdictPill(verdict: { value: Verdict; decidedAt: string }): string {
  const label = VERDICT_LABELS[verdict.value];
  const dateDisplay = formatDecidedAt(verdict.decidedAt);
  const decidedAtAttr = escapeAttr(verdict.decidedAt);
  const valueAttr = escapeAttr(verdict.value);

  return `<aside class="cs-verdict-pill cs-verdict-pill-${verdict.value}" data-cesium-verdict="${valueAttr}">
  <span class="eyebrow">Verdict</span>
  <strong>${escapeHtml(label)}</strong>
  <time datetime="${decidedAtAttr}">${escapeHtml(dateDisplay)}</time>
</aside>`;
}
