// Pure HTML body analyzer — walks parse5 AST and returns structured findings + 0-100 score.
// Deterministic and pure: same input always yields the same output.

import { parseFragment, defaultTreeAdapter as ta } from "parse5";
import type { DefaultTreeAdapterMap, DefaultTreeAdapterTypes, ParserOptions } from "parse5";

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
}

export interface CritiqueResult {
  /** 0-100 score computed from findings. */
  score: number;
  /** Ordered: warn → suggest → info, then alphabetically by code. */
  findings: CritiqueFinding[];
  /** Sum of all text node values in the body (visible text content length). */
  textLength: number;
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
// Tree-walking helpers
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

function computeScore(findings: readonly CritiqueFinding[]): number {
  let score = 100;
  for (const f of findings) {
    score -= SEVERITY_DEDUCTION[f.severity];
  }
  return Math.max(0, score);
}

function sortFindings(findings: CritiqueFinding[]): CritiqueFinding[] {
  return [...findings].toSorted((a, b) => {
    const sevDiff = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (sevDiff !== 0) return sevDiff;
    return a.code.localeCompare(b.code);
  });
}

// ---------------------------------------------------------------------------
// Main analyzer — pure, deterministic
// ---------------------------------------------------------------------------

export function critique(htmlBody: string): CritiqueResult {
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
    if (cls.has("h-section")) hSectionCount++;
    if (cls.has("tldr")) tldrCount++;
    if (cls.has("eyebrow")) eyebrowCount++;

    // Callout without a severity modifier
    if (cls.has("callout")) {
      let hasModifier = false;
      for (const mod of CALLOUT_MODIFIERS) {
        if (cls.has(mod)) {
          hasModifier = true;
          break;
        }
      }
      if (!hasModifier) calloutNoModifierCount++;
    }

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
  const score = computeScore(sorted);

  return { score, findings: sorted, textLength };
}
