// Diff block renderer — split-view before/after code diff with bezier SVG connectors.
// src/render/blocks/renderers/diff.ts

import type { DiffBlock, BlockMeta } from "../types.ts";
import type { RenderCtx } from "../render.ts";
import { escapeHtml, escapeAttr } from "../escape.ts";
import { highlightCode } from "../highlight.ts";
import { parseUnifiedDiff } from "../diff/parse-unified.ts";
import type { DiffEntry, DiffLine } from "../diff/parse-unified.ts";
import { diffLines } from "../diff/myers.ts";

const LINE_H = 22; // px — must match .diff-line height in CSS
const SVG_W = 60; // px — connector column width

// ─── Change region ────────────────────────────────────────────────────────────

type RegionKind = "add" | "remove" | "change";

interface ChangeRegion {
  kind: RegionKind;
  leftStart: number; // 0-based index into leftLines
  leftEnd: number;
  rightStart: number; // 0-based index into rightLines
  rightEnd: number;
}

// ─── SVG path generation ──────────────────────────────────────────────────────

function svgPath(region: ChangeRegion): string {
  const W = SVG_W;
  const H = LINE_H;

  const { kind, leftStart, leftEnd, rightStart, rightEnd } = region;

  if (kind === "change") {
    const y0l = leftStart * H;
    const y1l = leftEnd * H;
    const y0r = rightStart * H;
    const y1r = rightEnd * H;
    return (
      `M 0 ${y0l} ` +
      `C ${W / 2} ${y0l}, ${W / 2} ${y0r}, ${W} ${y0r} ` +
      `L ${W} ${y1r} ` +
      `C ${W / 2} ${y1r}, ${W / 2} ${y1l}, 0 ${y1l} ` +
      `Z`
    );
  }

  if (kind === "add") {
    // anchorY is on the left side (leftStart === leftEnd for pure add)
    const anchorY = leftStart * H;
    const y0r = rightStart * H;
    const y1r = rightEnd * H;
    return (
      `M 0 ${anchorY} ` +
      `C ${W / 2} ${anchorY}, ${W / 2} ${y0r}, ${W} ${y0r} ` +
      `L ${W} ${y1r} ` +
      `C ${W / 2} ${y1r}, ${W / 2} ${anchorY}, 0 ${anchorY} ` +
      `Z`
    );
  }

  // kind === "remove"
  // anchorY is on the right side (rightStart === rightEnd for pure remove)
  const anchorY = rightStart * H;
  const y0l = leftStart * H;
  const y1l = leftEnd * H;
  return (
    `M 0 ${y0l} ` +
    `C ${W / 2} ${y0l}, ${W / 2} ${anchorY}, ${W} ${anchorY} ` +
    `L ${W} ${anchorY} ` +
    `C ${W / 2} ${anchorY}, ${W / 2} ${y1l}, 0 ${y1l} ` +
    `Z`
  );
}

// ─── Region detection ─────────────────────────────────────────────────────────

function detectRegions(entries: DiffEntry[]): ChangeRegion[] {
  const regions: ChangeRegion[] = [];

  // Walk entries tracking left/right indices
  let leftIdx = 0;
  let rightIdx = 0;

  // Region accumulation
  let inRegion = false;
  let regionLeftStart = 0;
  let regionRightStart = 0;
  let regionLeftEnd = 0;
  let regionRightEnd = 0;
  let hasRemoves = false;
  let hasAdds = false;

  function flushRegion() {
    if (!inRegion) return;
    const kind: RegionKind = hasAdds && hasRemoves ? "change" : hasAdds ? "add" : "remove";
    regions.push({
      kind,
      leftStart: regionLeftStart,
      leftEnd: regionLeftEnd,
      rightStart: regionRightStart,
      rightEnd: regionRightEnd,
    });
    inRegion = false;
    hasAdds = false;
    hasRemoves = false;
  }

  for (const entry of entries) {
    if (entry.kind === "hunk-sep") {
      flushRegion();
      continue;
    }

    const { kind } = entry;

    if (kind === "context") {
      flushRegion();
      leftIdx++;
      rightIdx++;
      continue;
    }

    if (kind === "remove") {
      if (!inRegion) {
        inRegion = true;
        regionLeftStart = leftIdx;
        regionRightStart = rightIdx;
        hasRemoves = false;
        hasAdds = false;
      }
      hasRemoves = true;
      leftIdx++;
      regionLeftEnd = leftIdx;
      // For pure remove regions, rightEnd tracks the anchor
      if (!hasAdds) {
        regionRightEnd = rightIdx;
      }
      continue;
    }

    if (kind === "add") {
      if (!inRegion) {
        inRegion = true;
        regionLeftStart = leftIdx;
        regionLeftEnd = leftIdx; // anchor for pure-add
        regionRightStart = rightIdx;
        hasRemoves = false;
        hasAdds = false;
      }
      hasAdds = true;
      rightIdx++;
      regionRightEnd = rightIdx;
      // For pure add, update leftEnd to track anchor
      if (!hasRemoves) {
        regionLeftEnd = leftIdx;
      }
      continue;
    }
  }

  flushRegion();
  return regions;
}

// ─── Highlight helpers ────────────────────────────────────────────────────────

/**
 * Highlight a multi-line text and return an array of highlighted line HTML strings.
 * Each element corresponds to one source line.
 */
async function highlightLines(text: string, lang: string, ctx: RenderCtx): Promise<string[]> {
  if (text === "") return [];
  const highlighted = await highlightCode(text, lang, ctx.highlightTheme);
  return highlighted.split("\n");
}

// ─── Main renderer ────────────────────────────────────────────────────────────

export async function renderDiff(block: DiffBlock, ctx: RenderCtx): Promise<string> {
  const lang = block.lang ?? "text";

  // ── 1. Resolve DiffEntry[] ─────────────────────────────────────────────────
  let entries: DiffEntry[];

  if (block.patch !== undefined) {
    const parsed = parseUnifiedDiff(block.patch);
    if (parsed === null) {
      // Fallback: plaintext panel
      const escaped = escapeHtml(block.patch);
      const filename =
        block.filename !== undefined
          ? `<span class="diff-filename">${escapeHtml(block.filename)}</span>`
          : "";
      const header = filename !== "" ? `<header class="diff-header">${filename}</header>\n` : "";
      return (
        `<figure class="diff-block fallback" data-lang="${escapeAttr(lang)}">\n` +
        header +
        `  <pre><code>${escaped}</code></pre>\n` +
        `</figure>`
      );
    }
    entries = parsed;
  } else {
    const before = block.before ?? "";
    const after = block.after ?? "";
    entries = diffLines(before, after);
  }

  // ── 2. Build left/right line lists & recompose text for shiki ─────────────
  const leftEntries: DiffLine[] = [];
  const rightEntries: DiffLine[] = [];

  for (const e of entries) {
    if (e.kind === "hunk-sep") continue;
    if (e.kind === "context" || e.kind === "remove") {
      leftEntries.push(e);
    }
    if (e.kind === "context" || e.kind === "add") {
      rightEntries.push(e);
    }
  }

  const beforeText = leftEntries.map((e) => e.text).join("\n");
  const afterText = rightEntries.map((e) => e.text).join("\n");

  const [leftHighlighted, rightHighlighted] = await Promise.all([
    highlightLines(beforeText, lang, ctx),
    highlightLines(afterText, lang, ctx),
  ]);

  // ── 3. Compute stats ───────────────────────────────────────────────────────
  let addCount = 0;
  let removeCount = 0;
  for (const e of entries) {
    if (e.kind === "add") addCount++;
    if (e.kind === "remove") removeCount++;
  }

  // ── 4. Detect change regions (for SVG connectors) ─────────────────────────
  const regions = detectRegions(entries);

  // ── 5. Compute SVG height ──────────────────────────────────────────────────
  // Each side renders context+remove (left) or context+add (right) lines,
  // plus one row per hunk-sep
  let leftLineCount = 0;
  let rightLineCount = 0;
  for (const e of entries) {
    if (e.kind === "hunk-sep") {
      leftLineCount++;
      rightLineCount++;
    } else if (e.kind === "context") {
      leftLineCount++;
      rightLineCount++;
    } else if (e.kind === "remove") {
      leftLineCount++;
    } else if (e.kind === "add") {
      rightLineCount++;
    }
  }
  const svgH = Math.max(leftLineCount, rightLineCount) * LINE_H;

  // ── 6. Render left side ────────────────────────────────────────────────────
  let leftHighIdx = 0;
  let rightHighIdx = 0;
  const leftRows: string[] = [];
  const rightRows: string[] = [];

  for (const entry of entries) {
    if (entry.kind === "hunk-sep") {
      const sepLabel = `… @ ${entry.newStart}`;
      const sepHtml = `<li class="diff-line hunk-sep"><span class="num"></span><span class="content">${escapeHtml(sepLabel)}</span></li>`;
      leftRows.push(sepHtml);
      rightRows.push(sepHtml);
      continue;
    }

    const { kind } = entry;

    if (kind === "context" || kind === "remove") {
      const hl =
        leftHighlighted[leftHighIdx] ?? `<span class="line">${escapeHtml(entry.text)}</span>`;
      leftHighIdx++;
      const lineNum = entry.beforeLineNum !== null ? String(entry.beforeLineNum) : "";
      leftRows.push(
        `<li class="diff-line ${kind}"><span class="num">${escapeHtml(lineNum)}</span><span class="content">${hl}</span></li>`,
      );
    }

    if (kind === "context" || kind === "add") {
      const hl =
        rightHighlighted[rightHighIdx] ?? `<span class="line">${escapeHtml(entry.text)}</span>`;
      rightHighIdx++;
      const lineNum = entry.afterLineNum !== null ? String(entry.afterLineNum) : "";
      rightRows.push(
        `<li class="diff-line ${kind}"><span class="num">${escapeHtml(lineNum)}</span><span class="content">${hl}</span></li>`,
      );
    }
  }

  // ── 7. Render SVG connector paths ─────────────────────────────────────────
  const svgPaths = regions.map((region) => {
    const d = svgPath(region);
    return `    <path class="diff-conn ${region.kind}" d="${d}"/>`;
  });

  const svgEl =
    `  <div class="diff-connector" style="--lineH: ${LINE_H}px;">\n` +
    `    <svg viewBox="0 0 ${SVG_W} ${svgH}" preserveAspectRatio="none" aria-hidden="true" style="height: ${svgH}px">\n` +
    svgPaths.join("\n") +
    (svgPaths.length > 0 ? "\n" : "") +
    `    </svg>\n` +
    `  </div>`;

  // ── 8. Header ──────────────────────────────────────────────────────────────
  const filenameHtml =
    block.filename !== undefined
      ? `<span class="diff-filename">${escapeHtml(block.filename)}</span>`
      : `<span class="diff-filename"></span>`;
  const statHtml = `<span class="diff-stat"><span class="add">+${addCount}</span> <span class="rem">-${removeCount}</span></span>`;
  const headerHtml = `<header class="diff-header">${filenameHtml}${statHtml}</header>`;

  // ── 9. Caption ─────────────────────────────────────────────────────────────
  const captionHtml =
    block.caption !== undefined ? `\n  <figcaption>${escapeHtml(block.caption)}</figcaption>` : "";

  // ── 10. Assemble ───────────────────────────────────────────────────────────
  const leftOl =
    `  <ol class="diff-side before">\n` +
    leftRows.map((r) => `    ${r}`).join("\n") +
    (leftRows.length > 0 ? "\n" : "") +
    `  </ol>`;

  const rightOl =
    `  <ol class="diff-side after">\n` +
    rightRows.map((r) => `    ${r}`).join("\n") +
    (rightRows.length > 0 ? "\n" : "") +
    `  </ol>`;

  return (
    `<figure class="diff-block" data-lang="${escapeAttr(lang)}">\n` +
    `  ${headerHtml}\n` +
    `  <div class="diff-grid">\n` +
    `${leftOl}\n` +
    `${svgEl}\n` +
    `${rightOl}\n` +
    `  </div>${captionHtml}\n` +
    `</figure>`
  );
}

export const meta: BlockMeta = {
  type: "diff",
  description:
    "Side-by-side before/after code diff with curved bezier connectors. Use for showing what changed or proposing a change. Provide either a unified diff `patch`, or both `before` and `after` strings.",
  schema: {
    type: "object",
    properties: {
      type: { const: "diff" },
      patch: { type: "string" },
      before: { type: "string" },
      after: { type: "string" },
      lang: { type: "string" },
      filename: { type: "string" },
      caption: { type: "string" },
    },
    required: ["type"],
  },
  example: {
    type: "diff",
    filename: "src/auth.ts",
    lang: "typescript",
    before: "function login(user, pass) {\n  return db.find(user, pass);\n}",
    after:
      "async function login(user, pass) {\n  const u = await db.find(user);\n  if (!u) return null;\n  return verify(u, pass) ? u : null;\n}",
  },
};
