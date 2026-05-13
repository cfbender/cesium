// Pure block-body analyzer for cesium artifacts.
// Deterministic and pure: same input always yields the same output.

import type { Block } from "./blocks/types.ts";

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
  /** Path in the block tree, e.g. "blocks[2].children[1]". */
  path?: string;
}

export interface CritiqueResult {
  /** 0-100 score computed from findings. */
  score: number;
  /** Ordered: warn → suggest → info, then alphabetically by code. */
  findings: CritiqueFinding[];
  /** Sum of all text characters in the block tree (visible content length). */
  textLength: number;
}

// ---------------------------------------------------------------------------
// Internal constants
// ---------------------------------------------------------------------------

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

export function critique(blocks: Block[]): CritiqueResult {
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

  return { score, findings: sorted, textLength: totalChars };
}
