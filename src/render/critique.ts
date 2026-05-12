// Pure body analyzer — mode-aware: html or blocks.
// Deterministic and pure: same input always yields the same output.

import { parseFragment, defaultTreeAdapter as ta } from "parse5";
import type { DefaultTreeAdapterMap, DefaultTreeAdapterTypes, ParserOptions } from "parse5";
import type { Block } from "./blocks/types.ts";

type ChildNode = DefaultTreeAdapterTypes.ChildNode;
type Element = DefaultTreeAdapterTypes.Element;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type CritiqueSeverity = "info" | "suggest" | "warn";

export interface CritiqueFinding {
  severity: CritiqueSeverity;
  /** Stable kebab-case identifier, e.g. "no-tldr". */
  code: string;
  /** Single sentence, agent-readable. */
  message: string;
  /** Populated when the rule represents an aggregate count. */
  count?: number;
  /** Path in the block tree (blocks mode only), e.g. "blocks[2].children[1]". */
  path?: string;
}

export interface CritiqueResult {
  /** 0-100 score computed from findings. */
  score: number;
  /** Ordered: warn → suggest → info, then alphabetically by code. */
  findings: CritiqueFinding[];
  /** Sum of all text node values in the body (visible text content length). */
  textLength: number;
  /** Which input mode was detected. */
  mode: "html" | "blocks";
}

// ---------------------------------------------------------------------------
// Internal constants
// ---------------------------------------------------------------------------

const HTTP_RE = /^https?:\/\//i;

/** The only cesium-* class the framework ships with. All others are unknown. */
const KNOWN_CESIUM_CLASSES = new Set(["cesium-back", "cesium-eyebrow"]);

/** Callout severity modifiers — a callout needs at least one of these. */
const CALLOUT_MODIFIERS = new Set(["note", "warn", "risk"]);

/** Inline highlight span classes for .code blocks. */
const CODE_HIGHLIGHT_CLASSES = new Set(["kw", "str", "cm", "fn"]);

const SEVERITY_DEDUCTION: Record<CritiqueSeverity, number> = {
  warn: 10,
  suggest: 3,
  info: 1,
};

const SEVERITY_ORDER: Record<CritiqueSeverity, number> = {
  warn: 0,
  suggest: 1,
  info: 2,
};

// ---------------------------------------------------------------------------
// Tree-walking helpers (HTML mode)
// ---------------------------------------------------------------------------

function walkNodes(nodes: readonly ChildNode[], visitor: (node: ChildNode) => void): void {
  for (const node of nodes) {
    visitor(node);
    if (ta.isElementNode(node)) {
      walkNodes(ta.getChildNodes(node as Element) as ChildNode[], visitor);
    }
  }
}

function getClasses(el: Element): Set<string> {
  const attr = ta.getAttrList(el).find((a) => a.name === "class");
  if (!attr || !attr.value.trim()) return new Set();
  return new Set(attr.value.trim().split(/\s+/));
}

function attrVal(el: Element, name: string): string | undefined {
  return ta.getAttrList(el).find((a) => a.name === name)?.value;
}

/** Recursively sum all text-node values — gives the visible text content length. */
function collectTextLength(nodes: readonly ChildNode[]): number {
  let total = 0;
  for (const node of nodes) {
    if (ta.isTextNode(node)) {
      total += node.value.length;
    } else if (ta.isElementNode(node)) {
      total += collectTextLength(ta.getChildNodes(node as Element) as ChildNode[]);
    }
  }
  return total;
}

/** Returns true if any descendant of `el` carries a code-highlight class. */
function hasHighlightDescendant(el: Element): boolean {
  let found = false;
  walkNodes(ta.getChildNodes(el) as ChildNode[], (node) => {
    if (found || !ta.isElementNode(node)) return;
    const cls = getClasses(node as Element);
    for (const c of CODE_HIGHLIGHT_CLASSES) {
      if (cls.has(c)) {
        found = true;
        return;
      }
    }
  });
  return found;
}

// ---------------------------------------------------------------------------
// Scoring + ordering
// ---------------------------------------------------------------------------

function computeScore(findings: readonly CritiqueFinding[], baseline = 100): number {
  let score = baseline;
  for (const f of findings) {
    score -= SEVERITY_DEDUCTION[f.severity];
  }
  return Math.min(100, Math.max(0, score));
}

function sortFindings(findings: CritiqueFinding[]): CritiqueFinding[] {
  return [...findings].toSorted((a, b) => {
    const sevDiff = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (sevDiff !== 0) return sevDiff;
    return a.code.localeCompare(b.code);
  });
}

// ---------------------------------------------------------------------------
// HTML mode — preserves all existing rules + adds prefer-blocks
// ---------------------------------------------------------------------------

export function critiqueHtml(htmlBody: string): CritiqueResult {
  const fragment = parseFragment(htmlBody);
  const children = ta.getChildNodes(fragment) as ChildNode[];
  const findings: CritiqueFinding[] = [];

  // Visible text content length
  const textLength = collectTextLength(children);

  // Counters / flags accumulated in the single tree walk
  let hDisplayCount = 0;
  let hSectionCount = 0;
  let tldrCount = 0;
  let eyebrowCount = 0;
  let calloutNoModifierCount = 0;
  let externalResourceFound = false;
  let inlineStyleCount = 0;
  let hasSection = false;
  const unknownCesiumClasses = new Set<string>();
  let codeBlocksWithoutHighlights = 0;

  // prefer-blocks heuristic counters
  let structuralElementCount = 0;

  walkNodes(children, (node) => {
    if (!ta.isElementNode(node)) return;
    const el = node as Element;
    const tag = ta.getTagName(el);
    const cls = getClasses(el);

    // Section tag present?
    if (tag === "section") hasSection = true;

    // --- External resource detection (warn) ---
    if (!externalResourceFound) {
      if (tag === "script" && attrVal(el, "src") !== undefined) {
        externalResourceFound = true;
      } else if (tag === "link") {
        const rel = (attrVal(el, "rel") ?? "").toLowerCase();
        const href = attrVal(el, "href") ?? "";
        if (rel === "stylesheet" && HTTP_RE.test(href)) {
          externalResourceFound = true;
        }
      } else if (tag === "img") {
        const src = attrVal(el, "src") ?? "";
        if (HTTP_RE.test(src)) {
          externalResourceFound = true;
        }
      }
    }

    // --- Class-based counts ---
    if (cls.has("h-display")) hDisplayCount++;
    if (cls.has("h-section")) {
      hSectionCount++;
      structuralElementCount++;
    }
    if (cls.has("tldr")) tldrCount++;
    if (cls.has("eyebrow")) eyebrowCount++;

    // Callout without a severity modifier
    if (cls.has("callout")) {
      structuralElementCount++;
      let hasModifier = false;
      for (const mod of CALLOUT_MODIFIERS) {
        if (cls.has(mod)) {
          hasModifier = true;
          break;
        }
      }
      if (!hasModifier) calloutNoModifierCount++;
    }

    // compare-table counts as structural
    if (cls.has("compare-table")) structuralElementCount++;

    // Unknown cesium-* class names
    for (const c of cls) {
      if (c.startsWith("cesium-") && !KNOWN_CESIUM_CLASSES.has(c)) {
        unknownCesiumClasses.add(c);
      }
    }

    // .code block without inline highlights
    if (cls.has("code") && !hasHighlightDescendant(el)) {
      codeBlocksWithoutHighlights++;
    }

    // Inline style attribute
    if (attrVal(el, "style") !== undefined) inlineStyleCount++;
  });

  // Detect parse errors via a second parseFragment pass with onParseError
  let parseErrors = 0;
  const parseOpts: ParserOptions<DefaultTreeAdapterMap> = {
    onParseError: () => {
      parseErrors++;
    },
  };
  parseFragment(htmlBody, parseOpts);

  // ---------------------------------------------------------------------------
  // Emit warn-level findings
  // ---------------------------------------------------------------------------

  if (externalResourceFound) {
    findings.push({
      severity: "warn",
      code: "external-resource",
      message:
        "External resource will be stripped at publish time. Use inline styles/scripts/data URIs.",
    });
  }

  if (hDisplayCount > 1) {
    findings.push({
      severity: "warn",
      code: "multiple-h-display",
      message: "Only one .h-display per artifact (it's the page title).",
    });
  }

  if (parseErrors > 0) {
    findings.push({
      severity: "warn",
      code: "unbalanced-html",
      message:
        "Body has structural HTML issues; the browser will attempt recovery but layout may break.",
    });
  }

  if (unknownCesiumClasses.size > 0) {
    findings.push({
      severity: "warn",
      code: "unknown-cesium-class",
      message: `Found ${unknownCesiumClasses.size} unknown cesium-* class names; the framework only ships with the documented vocabulary.`,
      count: unknownCesiumClasses.size,
    });
  }

  // ---------------------------------------------------------------------------
  // Emit suggest-level findings
  // ---------------------------------------------------------------------------

  if (hDisplayCount === 0) {
    findings.push({
      severity: "suggest",
      code: "no-h-display",
      message: "No .h-display heading; agent should give the artifact a clear page title.",
    });
  }

  if (tldrCount === 0 && textLength > 1500) {
    findings.push({
      severity: "suggest",
      code: "no-tldr",
      message: "Long artifact with no .tldr summary; consider adding one near the top.",
    });
  }

  if (eyebrowCount === 0) {
    findings.push({
      severity: "suggest",
      code: "no-eyebrow",
      message: "No .eyebrow micro-labels — they help anchor sections and document type.",
    });
  }

  if (textLength > 1200 && hSectionCount === 0 && !hasSection) {
    findings.push({
      severity: "suggest",
      code: "unsectioned-long-body",
      message: "Long body has no section markers; readability suffers.",
    });
  }

  if (calloutNoModifierCount > 0) {
    findings.push({
      severity: "suggest",
      code: "callout-without-modifier",
      message: `${calloutNoModifierCount} callout${calloutNoModifierCount === 1 ? "" : "s"} have no severity modifier (.note/.warn/.risk).`,
      count: calloutNoModifierCount,
    });
  }

  if (textLength < 250) {
    findings.push({
      severity: "suggest",
      code: "body-too-short",
      message:
        "Very short body; a terminal reply may be more appropriate than a published artifact.",
    });
  }

  // prefer-blocks: suggest when ≥3 structural elements could be expressed as blocks
  if (structuralElementCount >= 3) {
    findings.push({
      severity: "suggest",
      code: "prefer-blocks",
      message: `This document has ${structuralElementCount} structural elements that could be expressed as blocks. Consider using cesium_publish({ blocks: [...] }).`,
      count: structuralElementCount,
    });
  }

  // ---------------------------------------------------------------------------
  // Emit info-level findings
  // ---------------------------------------------------------------------------

  if (textLength > 25000) {
    findings.push({
      severity: "info",
      code: "body-very-long",
      message: "Very long artifact; consider splitting into linked smaller pieces.",
    });
  }

  if (codeBlocksWithoutHighlights > 0) {
    findings.push({
      severity: "info",
      code: "code-without-highlights",
      message:
        "Code blocks render without inline highlights; readers benefit from .kw/.str/.cm/.fn spans.",
      count: codeBlocksWithoutHighlights,
    });
  }

  if (inlineStyleCount > 8) {
    findings.push({
      severity: "info",
      code: "inline-style-heavy",
      message: "Heavy reliance on inline styles; named classes are usually clearer.",
      count: inlineStyleCount,
    });
  }

  // ---------------------------------------------------------------------------
  // Sort, score, return
  // ---------------------------------------------------------------------------

  const sorted = sortFindings(findings);
  const score = computeScore(sorted, 100);

  return { score, findings: sorted, textLength, mode: "html" };
}

// ---------------------------------------------------------------------------
// Blocks mode — quality-focused rules
// ---------------------------------------------------------------------------

/** Collect all raw_html blocks from a block tree, with their path. */
function collectRawHtmlBlocks(
  blocks: readonly Block[],
  basePath: string,
): Array<{ block: Extract<Block, { type: "raw_html" }>; path: string }> {
  const results: Array<{ block: Extract<Block, { type: "raw_html" }>; path: string }> = [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (b === undefined) continue;
    const path = `${basePath}[${i}]`;
    if (b.type === "raw_html") {
      results.push({ block: b, path });
    }
    if (b.type === "section") {
      const nested = collectRawHtmlBlocks(b.children, `${path}.children`);
      for (const n of nested) results.push(n);
    }
  }
  return results;
}

/** Sum text content characters across all prose/tldr/callout/list/code/kv/timeline/table blocks. */
function collectTextChars(blocks: readonly Block[]): number {
  let total = 0;
  for (const b of blocks) {
    if (b === undefined) continue;
    switch (b.type) {
      case "prose":
        total += b.markdown.length;
        break;
      case "tldr":
        total += b.markdown.length;
        break;
      case "callout":
        total += b.markdown.length;
        break;
      case "list":
        for (const item of b.items) total += item.length;
        break;
      case "code":
        total += b.code.length;
        break;
      case "kv":
        for (const row of b.rows) total += row.k.length + row.v.length;
        break;
      case "timeline":
        for (const item of b.items) total += item.label.length + item.text.length;
        break;
      case "compare_table":
        for (const row of b.rows) for (const cell of row) total += cell.length;
        for (const h of b.headers) total += h.length;
        break;
      case "risk_table":
        for (const row of b.rows) total += row.risk.length + row.mitigation.length;
        break;
      case "hero":
        total += b.title.length;
        if (b.subtitle !== undefined) total += b.subtitle.length;
        break;
      case "section":
        total += b.title.length;
        total += collectTextChars(b.children);
        break;
      case "raw_html":
        total += b.html.length;
        break;
      case "diagram":
        total += (b.svg ?? b.html ?? "").length;
        break;
      case "divider":
      case "pill_row":
        break;
    }
  }
  return total;
}

/** Count top-level section blocks. */
function countTopLevelSections(blocks: readonly Block[]): number {
  let count = 0;
  for (const b of blocks) {
    if (b !== undefined && b.type === "section") count++;
  }
  return count;
}

/** Count consecutive prose blocks at the same nesting level. Returns max run found + path. */
function findProseWalls(
  blocks: readonly Block[],
  basePath: string,
): Array<{ start: number; end: number; path: string }> {
  const walls: Array<{ start: number; end: number; path: string }> = [];
  let runStart = -1;
  let runLen = 0;

  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (b === undefined) continue;
    if (b.type === "prose") {
      if (runStart === -1) runStart = i;
      runLen++;
    } else {
      if (runLen > 8) {
        walls.push({ start: runStart, end: i - 1, path: basePath });
      }
      runStart = -1;
      runLen = 0;
    }
    if (b.type === "section") {
      const nested = findProseWalls(b.children, `${basePath}[${i}].children`);
      for (const n of nested) walls.push(n);
    }
  }
  // Check trailing run
  if (runLen > 8 && runStart !== -1) {
    walls.push({ start: runStart, end: blocks.length - 1, path: basePath });
  }
  return walls;
}

/** Collect all code blocks with their path. */
function collectCodeBlocks(
  blocks: readonly Block[],
  basePath: string,
): Array<{ block: Extract<Block, { type: "code" }>; path: string }> {
  const results: Array<{ block: Extract<Block, { type: "code" }>; path: string }> = [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (b === undefined) continue;
    const path = `${basePath}[${i}]`;
    if (b.type === "code") {
      results.push({ block: b, path });
    }
    if (b.type === "section") {
      const nested = collectCodeBlocks(b.children, `${path}.children`);
      for (const n of nested) results.push(n);
    }
  }
  return results;
}

/** Check compare_table for row/header count mismatch. */
function checkTableShape(
  blocks: readonly Block[],
  basePath: string,
): Array<{ path: string; message: string }> {
  const issues: Array<{ path: string; message: string }> = [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (b === undefined) continue;
    const path = `${basePath}[${i}]`;
    if (b.type === "compare_table") {
      const hLen = b.headers.length;
      for (let ri = 0; ri < b.rows.length; ri++) {
        const row = b.rows[ri];
        if (row !== undefined && row.length !== hLen) {
          issues.push({
            path: `${path}.rows[${ri}]`,
            message: `compare_table row has ${row.length} cells but headers has ${hLen}`,
          });
        }
      }
    }
    if (b.type === "section") {
      const nested = checkTableShape(b.children, `${path}.children`);
      for (const n of nested) issues.push(n);
    }
  }
  return issues;
}

/** Check for sections nested deeper than 3. */
function checkNestingDepth(
  blocks: readonly Block[],
  basePath: string,
  currentDepth: number,
): Array<{ path: string }> {
  const issues: Array<{ path: string }> = [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (b === undefined) continue;
    const path = `${basePath}[${i}]`;
    if (b.type === "section") {
      if (currentDepth > 3) {
        issues.push({ path });
      } else {
        const nested = checkNestingDepth(b.children, `${path}.children`, currentDepth + 1);
        for (const n of nested) issues.push(n);
      }
    }
  }
  return issues;
}

/** Heuristic: detect framework markup inside raw_html that has a known block equivalent. */
const REDUNDANT_PATTERNS: Array<{ pattern: RegExp; suggestion: string }> = [
  { pattern: /<table\s[^>]*class="compare-table"/, suggestion: "compare_table" },
  { pattern: /<div\s[^>]*class="card"/, suggestion: "section or callout" },
  { pattern: /<aside\s[^>]*class="callout/, suggestion: "callout" },
  { pattern: /<aside\s[^>]*class="tldr"/, suggestion: "tldr" },
  { pattern: /<ul\s[^>]*class="timeline"/, suggestion: "timeline" },
  { pattern: /<table\s[^>]*class="risk-table"/, suggestion: "risk_table" },
  { pattern: /<dl\s[^>]*class="kv"/, suggestion: "kv" },
];

function detectRedundantRawHtml(html: string): string | null {
  for (const { pattern, suggestion } of REDUNDANT_PATTERNS) {
    if (pattern.test(html)) {
      return suggestion;
    }
  }
  return null;
}

/** Find the first hero block index (if any). */
function findHeroIndex(blocks: readonly Block[]): number {
  for (let i = 0; i < blocks.length; i++) {
    if (blocks[i]?.type === "hero") return i;
  }
  return -1;
}

/** Check whether a tldr block exists anywhere in the tree. */
function hasTldr(blocks: readonly Block[]): boolean {
  for (const b of blocks) {
    if (b === undefined) continue;
    if (b.type === "tldr") return true;
    if (b.type === "section" && hasTldr(b.children)) return true;
  }
  return false;
}

export function critiqueBlocks(blocks: Block[]): CritiqueResult {
  const findings: CritiqueFinding[] = [];

  // Total text content for ratio checks
  const totalChars = collectTextChars(blocks);

  // --- raw-html-overuse (warn) ---
  const rawHtmlBlocks = collectRawHtmlBlocks(blocks, "blocks");
  const rawHtmlCharTotal = rawHtmlBlocks.reduce((sum, { block }) => sum + block.html.length, 0);
  const rawHtmlRatio = totalChars > 0 ? rawHtmlCharTotal / totalChars : 0;

  if (rawHtmlBlocks.length > 2 || rawHtmlRatio > 0.3) {
    const reason =
      rawHtmlBlocks.length > 2
        ? `${rawHtmlBlocks.length} raw_html blocks (max 2 before critique warns)`
        : `raw_html payload is ${Math.round(rawHtmlRatio * 100)}% of body characters (>30%)`;
    findings.push({
      severity: "warn",
      code: "raw-html-overuse",
      message: `raw_html overuse: ${reason}. Consider expressing more content as typed blocks.`,
      count: rawHtmlBlocks.length,
    });
  }

  // --- missing-tldr (suggest) ---
  const topLevelSections = countTopLevelSections(blocks);
  if (topLevelSections > 5 && !hasTldr(blocks)) {
    findings.push({
      severity: "suggest",
      code: "missing-tldr",
      message: `Document has ${topLevelSections} sections but no tldr block. Add one near the top to orient readers.`,
    });
  }

  // --- prose-wall (suggest) ---
  const proseWalls = findProseWalls(blocks, "blocks");
  for (const wall of proseWalls) {
    findings.push({
      severity: "suggest",
      code: "prose-wall",
      message: `More than 8 consecutive prose blocks at ${wall.path}[${wall.start}..${wall.end}]. Break the run with a list, callout, or section.`,
      path: `${wall.path}[${wall.start}..${wall.end}]`,
    });
  }

  // --- code-without-meaningful-lang (info) ---
  const codeBlocks = collectCodeBlocks(blocks, "blocks");
  for (const { block, path } of codeBlocks) {
    if (block.lang === "text") {
      findings.push({
        severity: "info",
        code: "code-without-meaningful-lang",
        message: `Code block at ${path} uses lang "text". Specify a real language (e.g. "typescript", "json", "bash") for better rendering.`,
        path,
      });
    }
  }

  // --- table-shape (warn) --- defensive check
  const tableIssues = checkTableShape(blocks, "blocks");
  for (const issue of tableIssues) {
    findings.push({
      severity: "warn",
      code: "table-shape",
      message: issue.message,
      path: issue.path,
    });
  }

  // --- nesting-depth (warn) --- defensive check
  const depthIssues = checkNestingDepth(blocks, "blocks", 1);
  for (const issue of depthIssues) {
    findings.push({
      severity: "warn",
      code: "nesting-depth",
      message: `Section at ${issue.path} exceeds maximum nesting depth of 3.`,
      path: issue.path,
    });
  }

  // --- redundant-raw-html (suggest) ---
  for (const { block, path } of rawHtmlBlocks) {
    const suggestion = detectRedundantRawHtml(block.html);
    if (suggestion !== null) {
      findings.push({
        severity: "suggest",
        code: "redundant-raw-html",
        message: `raw_html block at ${path} contains framework markup that could be expressed as a \`${suggestion}\` block.`,
        path,
      });
    }
  }

  // --- tldr-too-long (suggest) ---
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (b === undefined) continue;
    if (b.type === "tldr" && b.markdown.length > 400) {
      const path = `blocks[${i}]`;
      findings.push({
        severity: "suggest",
        code: "tldr-too-long",
        message: `tldr at ${path} is ${b.markdown.length} characters (>400). Keep tldrs punchy — aim for 1-3 sentences.`,
        path,
      });
    }
  }

  // --- hero-not-first (warn) --- defensive: validate already enforces this
  const heroIdx = findHeroIndex(blocks);
  if (heroIdx > 0) {
    findings.push({
      severity: "warn",
      code: "hero-not-first",
      message: `Hero block found at blocks[${heroIdx}] but must be the first block.`,
      path: `blocks[${heroIdx}]`,
    });
  }

  // Sort, score with +5 baseline bonus, return
  const sorted = sortFindings(findings);
  // blocks mode starts at 105, capped at 100 — gives a +5 bonus for well-formed docs
  const score = computeScore(sorted, 105);

  return { score, findings: sorted, textLength: totalChars, mode: "blocks" };
}

// ---------------------------------------------------------------------------
// Backwards-compat wrapper — accepts an HTML body string (html mode)
// ---------------------------------------------------------------------------

/**
 * @deprecated Use critiqueHtml() or critiqueBlocks() directly.
 * Kept for backwards compatibility with existing call sites.
 */
export function critique(htmlBody: string): CritiqueResult {
  return critiqueHtml(htmlBody);
}
