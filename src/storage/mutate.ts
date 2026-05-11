// Read-mutate-write pipeline for interactive artifacts.
//
// submitAnswer: locks the artifact file, validates the answer, patches the HTML
// body and the embedded cesium-meta JSON, and atomically rewrites the file.
//
// getState: reads the artifact and returns its current status/answers without
// acquiring a lock (read-only, no mutation).

import { readFile } from "node:fs/promises";
import { parseFragment, serialize, defaultTreeAdapter as ta } from "parse5";
import type { DefaultTreeAdapterTypes } from "parse5";
import { atomicWrite } from "./write.ts";
import { withLock } from "./lock.ts";
import { renderAnswered } from "../render/controls.ts";
import { validateAnswerValue } from "../render/validate.ts";
import type { Question, AnswerValue, InteractiveData } from "../render/validate.ts";

type ChildNode = DefaultTreeAdapterTypes.ChildNode;
type Element = DefaultTreeAdapterTypes.Element;

// ─── Public types ─────────────────────────────────────────────────────────────

export type SubmitAnswerInput = {
  artifactPath: string;
  questionId: string;
  value: AnswerValue;
};

export type SubmitAnswerOutcome =
  | { ok: true; status: "open" | "complete"; remaining: string[]; replacementHtml: string }
  | { ok: false; reason: "not-found" }
  | { ok: false; reason: "not-interactive" }
  | { ok: false; reason: "session-ended"; status: "complete" | "expired" | "cancelled" }
  | { ok: false; reason: "expired" }
  | { ok: false; reason: "unknown-question"; questionId: string }
  | { ok: false; reason: "invalid-value"; message: string };

export type StateOutcome =
  | {
      ok: true;
      status: InteractiveData["status"];
      answers: Record<string, AnswerValue>;
      remaining: string[];
    }
  | { ok: false; reason: "not-found" | "not-interactive" };

// ─── Embedded metadata regex (mirrors storage/write.ts) ──────────────────────

const META_RE =
  /<script\s[^>]*type="application\/json"[^>]*id="cesium-meta"[^>]*>([\s\S]*?)<\/script>/i;

function parseEmbeddedMeta(html: string): Record<string, unknown> | null {
  const m = META_RE.exec(html);
  if (!m) return null;
  const raw = m[1];
  if (raw === undefined) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function isInteractiveData(v: unknown): v is InteractiveData {
  if (v === null || typeof v !== "object" || Array.isArray(v)) return false;
  const raw = v as Record<string, unknown>;
  return (
    (raw["status"] === "open" ||
      raw["status"] === "complete" ||
      raw["status"] === "expired" ||
      raw["status"] === "cancelled") &&
    Array.isArray(raw["questions"])
  );
}

// ─── Cross-validation beyond structural check ─────────────────────────────────

const EPSILON = 1e-9;

function crossValidate(question: Question, value: AnswerValue): string | null {
  switch (question.type) {
    case "pick_one": {
      if (value.type !== "pick_one") return null; // structural validator catches this
      const validIds = new Set(question.options.map((o) => o.id));
      if (!validIds.has(value.selected)) {
        return `pick_one: selected "${value.selected}" is not a valid option id`;
      }
      return null;
    }
    case "pick_many": {
      if (value.type !== "pick_many") return null;
      const validIds = new Set(question.options.map((o) => o.id));
      for (const sel of value.selected) {
        if (!validIds.has(sel)) {
          return `pick_many: selected "${sel}" is not a valid option id`;
        }
      }
      if (question.min !== undefined && value.selected.length < question.min) {
        return `pick_many: at least ${question.min} selection(s) required, got ${value.selected.length}`;
      }
      if (question.max !== undefined && value.selected.length > question.max) {
        return `pick_many: at most ${question.max} selection(s) allowed, got ${value.selected.length}`;
      }
      return null;
    }
    case "slider": {
      if (value.type !== "slider") return null;
      if (value.value < question.min) {
        return `slider: value ${value.value} is below minimum ${question.min}`;
      }
      if (value.value > question.max) {
        return `slider: value ${value.value} is above maximum ${question.max}`;
      }
      if (question.step !== undefined) {
        const remainder = Math.abs((value.value - question.min) % question.step);
        if (remainder > EPSILON && Math.abs(remainder - question.step) > EPSILON) {
          return `slider: value ${value.value} is not aligned to step ${question.step} from ${question.min}`;
        }
      }
      return null;
    }
    case "react": {
      if (value.type !== "react") return null;
      const mode = question.mode ?? "approve";
      if (mode === "thumbs") {
        if (value.decision !== "up" && value.decision !== "down") {
          return `react (thumbs): decision must be "up" or "down", got "${value.decision}"`;
        }
      } else {
        // approve mode — valid decisions from controls.ts: "approve", "reject", "comment"
        const validDecisions = new Set(["approve", "reject", "comment"]);
        if (!validDecisions.has(value.decision)) {
          return `react (approve): decision must be "approve", "reject", or "comment", got "${value.decision}"`;
        }
      }
      return null;
    }
    case "confirm":
      // Structural validation is sufficient
      return null;
    case "ask_text":
      if (value.type !== "ask_text") return null;
      if (value.text === "" && !question.optional) {
        return "ask_text answer cannot be empty (question is required)";
      }
      return null;
  }
}

// ─── parse5 section replacement ───────────────────────────────────────────────

function findSectionByQuestionId(nodes: ChildNode[], questionId: string): Element | null {
  for (const node of nodes) {
    if (!ta.isElementNode(node)) continue;
    const el = node as Element;
    const tag = ta.getTagName(el);
    if (tag === "section") {
      const attrs = ta.getAttrList(el);
      const qidAttr = attrs.find((a) => a.name === "data-question-id");
      if (qidAttr?.value === questionId) {
        return el;
      }
    }
    // Recurse
    const found = findSectionByQuestionId(ta.getChildNodes(el) as ChildNode[], questionId);
    if (found !== null) return found;
  }
  return null;
}

function replaceSectionInHtml(html: string, questionId: string, replacementHtml: string): string {
  const doc = parseFragment(html);
  const nodes = ta.getChildNodes(doc) as ChildNode[];
  const target = findSectionByQuestionId(nodes, questionId);

  if (target === null) {
    // Section not found — return HTML unchanged (defensive)
    return html;
  }

  const replacement = parseFragment(replacementHtml);
  const replacementNodes = ta.getChildNodes(replacement) as ChildNode[];

  const parent = ta.getParentNode(target) as Element | null;
  if (parent === null) return html;

  // Insert replacement nodes before the target, then remove target
  for (const rn of replacementNodes) {
    ta.insertBefore(parent, rn, target);
  }
  ta.detachNode(target);

  return serialize(doc);
}

// ─── Client script removal ────────────────────────────────────────────────────

function removeClientScriptFromHtml(html: string): string {
  // Remove <script data-cesium-client>...</script> when session completes.
  // Uses parse5 to avoid regex brittleness with script content.
  const doc = parseFragment(html);
  const nodes = ta.getChildNodes(doc) as ChildNode[];

  function removeClientScript(children: ChildNode[]): boolean {
    for (const node of children) {
      if (ta.isElementNode(node)) {
        const el = node as Element;
        const tag = ta.getTagName(el);
        if (tag === "script") {
          const attrs = ta.getAttrList(el);
          const hasCesiumClient = attrs.some((a) => a.name === "data-cesium-client");
          if (hasCesiumClient) {
            ta.detachNode(el);
            return true;
          }
        }
        // Recurse
        if (removeClientScript(ta.getChildNodes(el) as ChildNode[])) return true;
      }
    }
    return false;
  }

  removeClientScript(nodes);
  return serialize(doc);
}

// ─── Patch cesium-meta JSON inside the HTML string ────────────────────────────

function patchMetaInHtml(html: string, interactive: InteractiveData): string {
  const m = META_RE.exec(html);
  if (!m) return html;

  const raw = m[1];
  if (raw === undefined) return html;

  let existing: unknown;
  try {
    existing = JSON.parse(raw);
  } catch {
    return html;
  }

  if (existing === null || typeof existing !== "object" || Array.isArray(existing)) return html;

  const merged = { ...(existing as Record<string, unknown>), interactive };
  const newJson = JSON.stringify(merged, null, 2).replace(/<\/script>/gi, "<\\/script>");

  const fullMatch = m[0];
  const newBlock = fullMatch.replace(raw, newJson);
  return html.replace(fullMatch, newBlock);
}

// ─── submitAnswer ─────────────────────────────────────────────────────────────

export async function submitAnswer(input: SubmitAnswerInput): Promise<SubmitAnswerOutcome> {
  const { artifactPath, questionId, value } = input;
  const lockPath = `${artifactPath}.lock`;

  return withLock({ lockPath }, async () => {
    // 1. Read the file
    let html: string;
    try {
      html = await readFile(artifactPath, "utf8");
    } catch (err) {
      const e = err as NodeJS.ErrnoException;
      if (e.code === "ENOENT") return { ok: false, reason: "not-found" };
      throw err;
    }

    // 2. Parse cesium-meta
    const meta = parseEmbeddedMeta(html);
    if (meta === null || !isInteractiveData(meta["interactive"])) {
      return { ok: false, reason: "not-interactive" };
    }

    const interactive = meta["interactive"] as InteractiveData;

    // 3. Check session status
    if (interactive.status === "complete" || interactive.status === "cancelled") {
      return { ok: false, reason: "session-ended", status: interactive.status };
    }
    if (interactive.status === "expired") {
      return { ok: false, reason: "session-ended", status: "expired" };
    }

    // Check expiresAt
    if (interactive.status === "open" && Date.parse(interactive.expiresAt) < Date.now()) {
      // Patch status to expired and write back
      interactive.status = "expired";
      const patchedHtml = patchMetaInHtml(html, interactive);
      await atomicWrite(artifactPath, patchedHtml);
      return { ok: false, reason: "expired" };
    }

    // 4. Find the question
    const question = interactive.questions.find((q) => q.id === questionId);
    if (question === undefined) {
      return { ok: false, reason: "unknown-question", questionId };
    }

    // 5. Validate value — structural check
    const structuralResult = validateAnswerValue(question.type, value);
    if (!structuralResult.ok) {
      return { ok: false, reason: "invalid-value", message: structuralResult.error };
    }
    const validatedValue = structuralResult.value;

    // Cross-checks (option membership, range, decision strings)
    const crossError = crossValidate(question, validatedValue);
    if (crossError !== null) {
      return { ok: false, reason: "invalid-value", message: crossError };
    }

    // 6. Record the answer
    if (interactive.answers === undefined) {
      interactive.answers = {};
    }
    interactive.answers[questionId] = {
      value: validatedValue,
      answeredAt: new Date().toISOString(),
    };

    // 7. Compute remaining
    const remaining = interactive.questions
      .map((q) => q.id)
      .filter((id) => interactive.answers[id] === undefined);

    // 8. Compute next status
    // requireAll: true  → complete when no remaining
    // requireAll: false → complete on first answer (MVP rule)
    let nextStatus: "open" | "complete" = "open";
    if (interactive.requireAll) {
      if (remaining.length === 0) nextStatus = "complete";
    } else {
      nextStatus = "complete";
    }

    interactive.status = nextStatus;
    if (nextStatus === "complete") {
      interactive.completedAt = new Date().toISOString();
    }

    // 9. Patch the section HTML (replace cs-control-* with cs-answered)
    const replacementHtml = renderAnswered(question, validatedValue);
    let patchedHtml = replaceSectionInHtml(html, questionId, replacementHtml);

    // 10. If complete, strip the client <script data-cesium-client>
    if (nextStatus === "complete") {
      patchedHtml = removeClientScriptFromHtml(patchedHtml);
    }

    // 11. Patch cesium-meta JSON
    patchedHtml = patchMetaInHtml(patchedHtml, interactive);

    // 12. Atomic write
    await atomicWrite(artifactPath, patchedHtml);

    // 13. Return outcome
    return { ok: true, status: nextStatus, remaining, replacementHtml };
  });
}

// ─── getState ─────────────────────────────────────────────────────────────────

export async function getState(artifactPath: string): Promise<StateOutcome> {
  let html: string;
  try {
    html = await readFile(artifactPath, "utf8");
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === "ENOENT") return { ok: false, reason: "not-found" };
    throw err;
  }

  const meta = parseEmbeddedMeta(html);
  if (meta === null || !isInteractiveData(meta["interactive"])) {
    return { ok: false, reason: "not-interactive" };
  }

  const interactive = meta["interactive"] as InteractiveData;

  // Extract answer values (drop the answeredAt wrapper)
  const answers: Record<string, AnswerValue> = {};
  for (const [id, entry] of Object.entries(interactive.answers)) {
    answers[id] = entry.value;
  }

  const remaining = interactive.questions
    .map((q) => q.id)
    .filter((id) => interactive.answers[id] === undefined);

  return { ok: true, status: interactive.status, answers, remaining };
}
