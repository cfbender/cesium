// Validates cesium_publish and cesium_ask tool input before any write occurs.

import { parseFragment, defaultTreeAdapter as ta } from "parse5";
import type { DefaultTreeAdapterTypes } from "parse5";
import type { Block } from "./blocks/types.ts";
import { blockCatalog } from "./blocks/catalog.ts";
import { deepValidateBlock } from "./blocks/validate-block.ts";

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
  | "other"
  | "ask";

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
  "ask",
];

// ─── Interactive artifact types ────────────────────────────────────────────────

export type Option = {
  id: string;
  label: string;
  description?: string;
};

export type Question =
  | {
      type: "pick_one";
      id: string;
      question: string;
      options: Option[];
      recommended?: string;
      context?: string;
    }
  | {
      type: "pick_many";
      id: string;
      question: string;
      options: Option[];
      min?: number;
      max?: number;
      context?: string;
    }
  | {
      type: "confirm";
      id: string;
      question: string;
      yesLabel?: string;
      noLabel?: string;
      context?: string;
    }
  | {
      type: "ask_text";
      id: string;
      question: string;
      multiline?: boolean;
      placeholder?: string;
      optional?: boolean;
      context?: string;
    }
  | {
      type: "slider";
      id: string;
      question: string;
      min: number;
      max: number;
      step?: number;
      defaultValue?: number;
      context?: string;
    }
  | {
      type: "react";
      id: string;
      question: string;
      mode?: "approve" | "thumbs";
      allowComment?: boolean;
      context?: string;
    };

export type AnswerValue =
  | { type: "pick_one"; selected: string }
  | { type: "pick_many"; selected: string[] }
  | { type: "confirm"; choice: "yes" | "no" }
  | { type: "ask_text"; text: string }
  | { type: "slider"; value: number }
  | { type: "react"; decision: string; comment?: string };

export type InteractiveData = {
  status: "open" | "complete" | "expired" | "cancelled";
  requireAll: boolean;
  expiresAt: string;
  questions: Question[];
  answers: Record<string, { value: AnswerValue; answeredAt: string }>;
  completedAt?: string;
};

// ─── Question validation ───────────────────────────────────────────────────────

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim() !== "";
}

function isOption(v: unknown): v is Option {
  if (v === null || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return isNonEmptyString(o["id"]) && isNonEmptyString(o["label"]);
}

type QuestionValidationResult = { ok: true; question: Question } | { ok: false; error: string };

export function validateQuestion(q: unknown): QuestionValidationResult {
  if (q === null || typeof q !== "object") {
    return { ok: false, error: "question must be an object" };
  }
  const raw = q as Record<string, unknown>;

  if (!isNonEmptyString(raw["id"])) {
    return { ok: false, error: "question.id must be a non-empty string" };
  }
  const id = raw["id"];

  if (!isNonEmptyString(raw["question"])) {
    return { ok: false, error: "question.question must be a non-empty string" };
  }
  const questionText = raw["question"];

  const context = typeof raw["context"] === "string" ? raw["context"] : undefined;

  switch (raw["type"]) {
    case "pick_one": {
      if (!Array.isArray(raw["options"]) || raw["options"].length === 0) {
        return { ok: false, error: `pick_one question "${id}" must have at least one option` };
      }
      for (const opt of raw["options"] as unknown[]) {
        if (!isOption(opt)) {
          return { ok: false, error: `pick_one question "${id}" has invalid option` };
        }
      }
      const result: Question = {
        type: "pick_one",
        id,
        question: questionText,
        options: raw["options"] as Option[],
      };
      if (typeof raw["recommended"] === "string") result.recommended = raw["recommended"];
      if (context !== undefined) result.context = context;
      return { ok: true, question: result };
    }
    case "pick_many": {
      if (!Array.isArray(raw["options"]) || raw["options"].length === 0) {
        return { ok: false, error: `pick_many question "${id}" must have at least one option` };
      }
      for (const opt of raw["options"] as unknown[]) {
        if (!isOption(opt)) {
          return { ok: false, error: `pick_many question "${id}" has invalid option` };
        }
      }
      const min = typeof raw["min"] === "number" ? raw["min"] : undefined;
      const max = typeof raw["max"] === "number" ? raw["max"] : undefined;
      if (min !== undefined && max !== undefined && min > max) {
        return { ok: false, error: `pick_many question "${id}" has min > max` };
      }
      const result: Question = {
        type: "pick_many",
        id,
        question: questionText,
        options: raw["options"] as Option[],
      };
      if (min !== undefined) result.min = min;
      if (max !== undefined) result.max = max;
      if (context !== undefined) result.context = context;
      return { ok: true, question: result };
    }
    case "confirm": {
      const result: Question = { type: "confirm", id, question: questionText };
      if (typeof raw["yesLabel"] === "string") result.yesLabel = raw["yesLabel"];
      if (typeof raw["noLabel"] === "string") result.noLabel = raw["noLabel"];
      if (context !== undefined) result.context = context;
      return { ok: true, question: result };
    }
    case "ask_text": {
      const result: Question = { type: "ask_text", id, question: questionText };
      if (typeof raw["multiline"] === "boolean") result.multiline = raw["multiline"];
      if (typeof raw["placeholder"] === "string") result.placeholder = raw["placeholder"];
      if ("optional" in raw && raw["optional"] !== undefined) {
        if (typeof raw["optional"] !== "boolean") {
          return { ok: false, error: `ask_text question "${id}" optional must be a boolean` };
        }
        result.optional = raw["optional"];
      }
      if (context !== undefined) result.context = context;
      return { ok: true, question: result };
    }
    case "slider": {
      if (typeof raw["min"] !== "number" || typeof raw["max"] !== "number") {
        return { ok: false, error: `slider question "${id}" must have numeric min and max` };
      }
      if (raw["min"] >= raw["max"]) {
        return { ok: false, error: `slider question "${id}" must have min < max` };
      }
      const result: Question = {
        type: "slider",
        id,
        question: questionText,
        min: raw["min"],
        max: raw["max"],
      };
      if (typeof raw["step"] === "number") result.step = raw["step"];
      if (typeof raw["defaultValue"] === "number") result.defaultValue = raw["defaultValue"];
      if (context !== undefined) result.context = context;
      return { ok: true, question: result };
    }
    case "react": {
      const result: Question = { type: "react", id, question: questionText };
      if (raw["mode"] === "approve" || raw["mode"] === "thumbs") result.mode = raw["mode"];
      if (typeof raw["allowComment"] === "boolean") result.allowComment = raw["allowComment"];
      if (context !== undefined) result.context = context;
      return { ok: true, question: result };
    }
    default:
      return {
        ok: false,
        error: `question has invalid type: ${String(raw["type"])}`,
      };
  }
}

// ─── Answer value validation ───────────────────────────────────────────────────

type AnswerValueResult = { ok: true; value: AnswerValue } | { ok: false; error: string };

export function validateAnswerValue(qType: Question["type"], value: unknown): AnswerValueResult {
  if (value === null || typeof value !== "object") {
    return { ok: false, error: "answer value must be an object" };
  }
  const raw = value as Record<string, unknown>;

  if (raw["type"] !== qType) {
    return {
      ok: false,
      error: `answer type mismatch: expected "${qType}", got "${String(raw["type"])}"`,
    };
  }

  switch (qType) {
    case "pick_one": {
      if (typeof raw["selected"] !== "string") {
        return { ok: false, error: "pick_one answer must have a string selected field" };
      }
      return { ok: true, value: { type: "pick_one", selected: raw["selected"] } };
    }
    case "pick_many": {
      if (!Array.isArray(raw["selected"]) || !raw["selected"].every((s) => typeof s === "string")) {
        return { ok: false, error: "pick_many answer must have a string[] selected field" };
      }
      return { ok: true, value: { type: "pick_many", selected: raw["selected"] as string[] } };
    }
    case "confirm": {
      if (raw["choice"] !== "yes" && raw["choice"] !== "no") {
        return { ok: false, error: 'confirm answer must have choice "yes" or "no"' };
      }
      return { ok: true, value: { type: "confirm", choice: raw["choice"] } };
    }
    case "ask_text": {
      if (typeof raw["text"] !== "string") {
        return { ok: false, error: "ask_text answer must have a string text field" };
      }
      return { ok: true, value: { type: "ask_text", text: raw["text"] } };
    }
    case "slider": {
      if (typeof raw["value"] !== "number") {
        return { ok: false, error: "slider answer must have a numeric value field" };
      }
      return { ok: true, value: { type: "slider", value: raw["value"] } };
    }
    case "react": {
      if (typeof raw["decision"] !== "string") {
        return { ok: false, error: "react answer must have a string decision field" };
      }
      const comment = typeof raw["comment"] === "string" ? raw["comment"] : undefined;
      const result: AnswerValue = { type: "react", decision: raw["decision"] };
      if (comment !== undefined) result.comment = comment;
      return { ok: true, value: result };
    }
  }
}

// ─── AskInput validation ───────────────────────────────────────────────────────

export interface AskInput {
  title: string;
  body: string;
  questions: Question[];
  summary?: string;
  tags?: string[];
  expiresAt?: string;
  requireAll?: boolean;
}

type AskValidationResult = { ok: true; value: AskInput } | { ok: false; error: string };

export function validateAskInput(input: unknown): AskValidationResult {
  if (input === null || typeof input !== "object") {
    return { ok: false, error: "input must be an object" };
  }
  const raw = input as Record<string, unknown>;

  // title
  if (!("title" in raw) || typeof raw["title"] !== "string" || raw["title"].trim() === "") {
    return { ok: false, error: "title is required and must be a non-empty string" };
  }
  const title = raw["title"];

  // body
  if (!("body" in raw) || typeof raw["body"] !== "string") {
    return { ok: false, error: "body is required and must be a string" };
  }
  const body = raw["body"];

  // questions
  if (!("questions" in raw) || !Array.isArray(raw["questions"]) || raw["questions"].length === 0) {
    return { ok: false, error: "questions must be a non-empty array" };
  }
  const questions: Question[] = [];
  const seenIds = new Set<string>();
  for (const q of raw["questions"] as unknown[]) {
    const result = validateQuestion(q);
    if (!result.ok) {
      return { ok: false, error: result.error };
    }
    if (seenIds.has(result.question.id)) {
      return { ok: false, error: `duplicate question id: "${result.question.id}"` };
    }
    seenIds.add(result.question.id);
    questions.push(result.question);
  }

  // summary (optional)
  if ("summary" in raw && raw["summary"] !== undefined) {
    if (typeof raw["summary"] !== "string") {
      return { ok: false, error: "summary must be a string" };
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

  // expiresAt (optional, must be ISO string)
  if ("expiresAt" in raw && raw["expiresAt"] !== undefined) {
    if (typeof raw["expiresAt"] !== "string") {
      return { ok: false, error: "expiresAt must be a string" };
    }
    const d = new Date(raw["expiresAt"]);
    if (isNaN(d.getTime())) {
      return { ok: false, error: "expiresAt must be a valid ISO date string" };
    }
  }

  // requireAll (optional)
  if ("requireAll" in raw && raw["requireAll"] !== undefined) {
    if (typeof raw["requireAll"] !== "boolean") {
      return { ok: false, error: "requireAll must be a boolean" };
    }
  }

  const result: AskInput = { title, body, questions };
  if (typeof raw["summary"] === "string") result.summary = raw["summary"];
  if (Array.isArray(raw["tags"])) result.tags = raw["tags"] as string[];
  if (typeof raw["expiresAt"] === "string") result.expiresAt = raw["expiresAt"];
  if (typeof raw["requireAll"] === "boolean") result.requireAll = raw["requireAll"];

  return { ok: true, value: result };
}

// ─── PublishInput — supports html XOR blocks ──────────────────────────────────

export type PublishInput =
  | {
      title: string;
      kind: PublishKind;
      html: string;
      blocks?: never;
      summary?: string;
      tags?: string[];
      supersedes?: string;
    }
  | {
      title: string;
      kind: PublishKind;
      blocks: Block[];
      html?: never;
      summary?: string;
      tags?: string[];
      supersedes?: string;
    };

function isPublishKind(val: unknown): val is PublishKind {
  return typeof val === "string" && (PUBLISH_KINDS as readonly string[]).includes(val);
}

// ─── Block validation ─────────────────────────────────────────────────────────

type BlockValidationError = { path: string; message: string };
type BlockValidationResult = { ok: true; blocks: Block[] } | { ok: false; errors: BlockValidationError[] };

function validateBlock(raw: unknown, path: string, depth: number): BlockValidationError[] {
  const errors: BlockValidationError[] = [];

  if (raw === null || typeof raw !== "object") {
    errors.push({ path, message: "block must be an object" });
    return errors;
  }

  const b = raw as Record<string, unknown>;
  const type = b["type"];

  if (typeof type !== "string") {
    errors.push({ path, message: "block.type must be a string" });
    return errors;
  }

  if (!(type in blockCatalog)) {
    errors.push({ path, message: `unknown block type: "${type}"` });
    return errors;
  }

  // Per-type required field checks
  switch (type) {
    case "hero": {
      if (typeof b["title"] !== "string" || (b["title"] as string).trim() === "") {
        errors.push({ path, message: "hero block requires a non-empty title" });
      }
      break;
    }
    case "tldr": {
      if (typeof b["markdown"] !== "string") {
        errors.push({ path, message: "tldr block requires markdown field" });
      }
      break;
    }
    case "section": {
      if (typeof b["title"] !== "string" || (b["title"] as string).trim() === "") {
        errors.push({ path, message: "section block requires a non-empty title" });
      }
      if (!Array.isArray(b["children"])) {
        errors.push({ path, message: "section block requires children array" });
      } else {
        if (depth > 3) {
          errors.push({ path, message: `section nesting depth exceeds maximum of 3 (current depth: ${depth})` });
        } else {
          const children = b["children"] as unknown[];
          for (let i = 0; i < children.length; i++) {
            const childErrors = validateBlock(children[i], `${path}.children[${i}]`, depth + 1);
            for (const e of childErrors) errors.push(e);
          }
        }
      }
      break;
    }
    case "prose": {
      if (typeof b["markdown"] !== "string") {
        errors.push({ path, message: "prose block requires markdown field" });
      }
      break;
    }
    case "list": {
      if (!Array.isArray(b["items"])) {
        errors.push({ path, message: "list block requires items array" });
      }
      break;
    }
    case "callout": {
      if (b["variant"] !== "note" && b["variant"] !== "warn" && b["variant"] !== "risk") {
        errors.push({ path, message: 'callout block requires variant: "note", "warn", or "risk"' });
      }
      if (typeof b["markdown"] !== "string") {
        errors.push({ path, message: "callout block requires markdown field" });
      }
      break;
    }
    case "code": {
      if (typeof b["lang"] !== "string" || (b["lang"] as string).trim() === "") {
        errors.push({ path, message: 'code block requires a non-empty lang (use "text" if unknown)' });
      }
      if (typeof b["code"] !== "string") {
        errors.push({ path, message: "code block requires code field" });
      }
      break;
    }
    case "timeline": {
      if (!Array.isArray(b["items"])) {
        errors.push({ path, message: "timeline block requires items array" });
      }
      break;
    }
    case "compare_table": {
      if (!Array.isArray(b["headers"]) || (b["headers"] as unknown[]).length === 0) {
        errors.push({ path, message: "compare_table block requires non-empty headers array" });
      } else {
        const headers = b["headers"] as unknown[];
        const headerCount = headers.length;
        if (Array.isArray(b["rows"])) {
          const rows = b["rows"] as unknown[];
          for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            if (!Array.isArray(row) || (row as unknown[]).length !== headerCount) {
              errors.push({
                path: `${path}.rows[${i}]`,
                message: `compare_table row has ${Array.isArray(row) ? (row as unknown[]).length : "?"} cells but headers has ${headerCount}`,
              });
            }
          }
        } else {
          errors.push({ path, message: "compare_table block requires rows array" });
        }
      }
      break;
    }
    case "risk_table": {
      if (!Array.isArray(b["rows"])) {
        errors.push({ path, message: "risk_table block requires rows array" });
      }
      break;
    }
    case "kv": {
      if (!Array.isArray(b["rows"])) {
        errors.push({ path, message: "kv block requires rows array" });
      }
      break;
    }
    case "pill_row": {
      if (!Array.isArray(b["items"])) {
        errors.push({ path, message: "pill_row block requires items array" });
      }
      break;
    }
    case "divider": {
      // No required fields beyond type
      break;
    }
    case "diagram": {
      const hasSvg = typeof b["svg"] === "string";
      const hasHtml = typeof b["html"] === "string";
      if (hasSvg && hasHtml) {
        errors.push({ path, message: "diagram block must have exactly one of svg or html, not both" });
      } else if (!hasSvg && !hasHtml) {
        errors.push({ path, message: "diagram block requires exactly one of svg or html" });
      }
      break;
    }
    case "raw_html": {
      if (typeof b["html"] !== "string" || (b["html"] as string).trim() === "") {
        errors.push({ path, message: "raw_html block requires non-empty html field" });
      }
      break;
    }
  }

  // Deep field validation against catalog schema — catches unknown fields (with "did you mean"
  // suggestions) and bad enum values. Only runs when per-type required checks passed to avoid
  // duplicating error messages.
  if (errors.length === 0) {
    const deepErrors = deepValidateBlock(b, path);
    for (const e of deepErrors) errors.push(e);
  }

  return errors;
}

function validateBlocksArray(raw: unknown): BlockValidationResult {
  if (!Array.isArray(raw)) {
    return { ok: false, errors: [{ path: "blocks", message: "blocks must be an array" }] };
  }

  if (raw.length > 1000) {
    return { ok: false, errors: [{ path: "blocks", message: "blocks array exceeds maximum of 1000 blocks" }] };
  }

  const allErrors: BlockValidationError[] = [];

  // Structural checks: at most one hero (must be first), at most one tldr
  let heroCount = 0;
  let tldrCount = 0;

  for (let i = 0; i < raw.length; i++) {
    const block = raw[i] as Record<string, unknown> | null | undefined;
    const blockType = block !== null && typeof block === "object" ? block["type"] : undefined;

    if (blockType === "hero") {
      heroCount++;
      if (i !== 0) {
        allErrors.push({ path: `blocks[${i}]`, message: "hero block must be the first block if present" });
      }
    }
    if (blockType === "tldr") {
      tldrCount++;
    }
  }

  if (heroCount > 1) {
    allErrors.push({ path: "blocks", message: "at most one hero block is allowed per document" });
  }
  if (tldrCount > 1) {
    allErrors.push({ path: "blocks", message: "at most one tldr block is allowed per document" });
  }

  // Per-block validation (depth 1 at root)
  for (let i = 0; i < raw.length; i++) {
    const blockErrors = validateBlock(raw[i], `blocks[${i}]`, 1);
    for (const e of blockErrors) allErrors.push(e);
  }

  if (allErrors.length > 0) {
    return { ok: false, errors: allErrors };
  }

  return { ok: true, blocks: raw as Block[] };
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

  // XOR: exactly one of html or blocks
  const hasHtml = "html" in raw && raw["html"] !== undefined;
  const hasBlocks = "blocks" in raw && raw["blocks"] !== undefined;

  if (hasHtml && hasBlocks) {
    return { ok: false, error: "provide exactly one of html or blocks, not both" };
  }
  if (!hasHtml && !hasBlocks) {
    return { ok: false, error: "provide exactly one of html or blocks" };
  }

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

  const commonFields = {
    title,
    kind,
    ...(typeof raw["summary"] === "string" ? { summary: raw["summary"] } : {}),
    ...(Array.isArray(raw["tags"]) ? { tags: raw["tags"] as string[] } : {}),
    ...(typeof raw["supersedes"] === "string" ? { supersedes: raw["supersedes"] } : {}),
  };

  if (hasHtml) {
    // html branch
    if (typeof raw["html"] !== "string" || raw["html"].trim() === "") {
      return { ok: false, error: "html is required and must be a non-empty string" };
    }
    return {
      ok: true,
      value: { ...commonFields, html: raw["html"] },
    };
  } else {
    // blocks branch
    const blocksResult = validateBlocksArray(raw["blocks"]);
    if (!blocksResult.ok) {
      const errorMessages = blocksResult.errors
        .map((e) => `${e.path}: ${e.message}`)
        .join("; ");
      return { ok: false, error: `blocks validation failed — ${errorMessages}` };
    }
    return {
      ok: true,
      value: { ...commonFields, blocks: blocksResult.blocks },
    };
  }
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
