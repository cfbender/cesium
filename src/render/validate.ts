// Validates cesium_publish tool input before any write occurs.

import { parseFragment, defaultTreeAdapter as ta } from "parse5";
import type { DefaultTreeAdapterTypes } from "parse5";

type ChildNode = DefaultTreeAdapterTypes.ChildNode;
type Element = DefaultTreeAdapterTypes.Element;

export interface ValidationOk<T> {
  ok: true;
  value: T;
}
export interface ValidationErr {
  ok: false;
  error: string;
}
export type ValidationResult<T> = ValidationOk<T> | ValidationErr;

export type PublishKind =
  | "plan"
  | "review"
  | "comparison"
  | "report"
  | "explainer"
  | "design"
  | "audit"
  | "rfc"
  | "other";

export const PUBLISH_KINDS: readonly PublishKind[] = [
  "plan",
  "review",
  "comparison",
  "report",
  "explainer",
  "design",
  "audit",
  "rfc",
  "other",
];

export interface PublishInput {
  title: string;
  kind: PublishKind;
  html: string;
  summary?: string;
  tags?: string[];
  supersedes?: string;
}

function isPublishKind(val: unknown): val is PublishKind {
  return typeof val === "string" && (PUBLISH_KINDS as readonly string[]).includes(val);
}

export function validatePublishInput(input: unknown): ValidationResult<PublishInput> {
  if (input === null || typeof input !== "object") {
    return { ok: false, error: "input must be an object" };
  }
  const raw = input as Record<string, unknown>;

  // title
  if (!("title" in raw) || typeof raw["title"] !== "string" || raw["title"].trim() === "") {
    return { ok: false, error: "title is required and must be a non-empty string" };
  }
  if (raw["title"].length > 200) {
    return { ok: false, error: "title must be 200 characters or fewer" };
  }
  const title = raw["title"];

  // kind
  if (!("kind" in raw) || !isPublishKind(raw["kind"])) {
    return {
      ok: false,
      error: `kind must be one of: ${PUBLISH_KINDS.join(", ")}`,
    };
  }
  const kind = raw["kind"];

  // html
  if (!("html" in raw) || typeof raw["html"] !== "string" || raw["html"].trim() === "") {
    return { ok: false, error: "html is required and must be a non-empty string" };
  }
  const html = raw["html"];

  // summary (optional)
  if ("summary" in raw && raw["summary"] !== undefined) {
    if (typeof raw["summary"] !== "string") {
      return { ok: false, error: "summary must be a string" };
    }
    if (raw["summary"].length > 500) {
      return { ok: false, error: "summary must be 500 characters or fewer" };
    }
  }

  // tags (optional)
  if ("tags" in raw && raw["tags"] !== undefined) {
    if (!Array.isArray(raw["tags"])) {
      return { ok: false, error: "tags must be an array of strings" };
    }
    for (const tag of raw["tags"]) {
      if (typeof tag !== "string") {
        return { ok: false, error: "tags must be an array of strings" };
      }
    }
  }

  // supersedes (optional)
  if ("supersedes" in raw && raw["supersedes"] !== undefined) {
    if (typeof raw["supersedes"] !== "string") {
      return { ok: false, error: "supersedes must be a string" };
    }
  }

  const result: PublishInput = { title, kind, html };
  if (typeof raw["summary"] === "string") result.summary = raw["summary"];
  if (Array.isArray(raw["tags"])) result.tags = raw["tags"] as string[];
  if (typeof raw["supersedes"] === "string") result.supersedes = raw["supersedes"];

  return { ok: true, value: result };
}

const HEADING_TAGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6"]);

function walkNodes(nodes: ChildNode[], visitor: (node: ChildNode) => void): void {
  for (const node of nodes) {
    visitor(node);
    if (ta.isElementNode(node)) {
      walkNodes(ta.getChildNodes(node as Element) as ChildNode[], visitor);
    }
  }
}

export function htmlBodyWarnings(htmlBody: string): string[] {
  try {
    const warnings: string[] = [];
    const fragment = parseFragment(htmlBody);
    const children = ta.getChildNodes(fragment) as ChildNode[];
    let hasHeading = false;

    walkNodes(children, (node) => {
      if (ta.isElementNode(node)) {
        const el = node as Element;
        const tag = ta.getTagName(el);
        if (HEADING_TAGS.has(tag)) hasHeading = true;
      }
    });

    if (!hasHeading) {
      warnings.push("no headings found — consider adding an <h1> or <h2>");
    }

    return warnings;
  } catch {
    return [];
  }
}
