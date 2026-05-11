import { describe, expect, test } from "bun:test";
import {
  htmlBodyWarnings,
  PUBLISH_KINDS,
  validatePublishInput,
  validateQuestion,
  validateAnswerValue,
  validateAskInput,
  type PublishInput,
} from "../src/render/validate.ts";

describe("validatePublishInput — rejection cases", () => {
  test("rejects null input", () => {
    const r = validatePublishInput(null);
    expect(r.ok).toBe(false);
  });

  test("rejects non-object input", () => {
    const r = validatePublishInput("string");
    expect(r.ok).toBe(false);
  });

  test("rejects missing title", () => {
    const r = validatePublishInput({ kind: "plan", html: "<p>hi</p>" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("title");
  });

  test("rejects empty title", () => {
    const r = validatePublishInput({ title: "  ", kind: "plan", html: "<p>hi</p>" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("title");
  });

  test("rejects title > 200 chars", () => {
    const r = validatePublishInput({
      title: "a".repeat(201),
      kind: "plan",
      html: "<p>hi</p>",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("200");
  });

  test("accepts title of exactly 200 chars", () => {
    const r = validatePublishInput({
      title: "a".repeat(200),
      kind: "plan",
      html: "<p>hi</p>",
    });
    expect(r.ok).toBe(true);
  });

  test("rejects invalid kind", () => {
    const r = validatePublishInput({ title: "Test", kind: "invalid-kind", html: "<p>hi</p>" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("kind");
  });

  test("rejects missing html", () => {
    const r = validatePublishInput({ title: "Test", kind: "plan" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("html");
  });

  test("rejects empty html", () => {
    const r = validatePublishInput({ title: "Test", kind: "plan", html: "   " });
    expect(r.ok).toBe(false);
  });

  test("rejects summary > 500 chars", () => {
    const r = validatePublishInput({
      title: "Test",
      kind: "plan",
      html: "<p>hi</p>",
      summary: "s".repeat(501),
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("500");
  });

  test("rejects tags that is not an array", () => {
    const r = validatePublishInput({
      title: "Test",
      kind: "plan",
      html: "<p>hi</p>",
      tags: "not-an-array",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("tags");
  });

  test("rejects tags array with non-string elements", () => {
    const r = validatePublishInput({
      title: "Test",
      kind: "plan",
      html: "<p>hi</p>",
      tags: ["valid", 42],
    });
    expect(r.ok).toBe(false);
  });

  test("rejects supersedes that is not a string", () => {
    const r = validatePublishInput({
      title: "Test",
      kind: "plan",
      html: "<p>hi</p>",
      supersedes: 123,
    });
    expect(r.ok).toBe(false);
  });
});

describe("validatePublishInput — acceptance cases", () => {
  test("accepts canonical minimal input", () => {
    const r = validatePublishInput({ title: "Test Plan", kind: "plan", html: "<h1>Plan</h1>" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.title).toBe("Test Plan");
      expect(r.value.kind).toBe("plan");
      expect(r.value.html).toBe("<h1>Plan</h1>");
    }
  });

  test("accepts all valid kinds", () => {
    for (const kind of PUBLISH_KINDS) {
      const r = validatePublishInput({ title: "T", kind, html: "<p>x</p>" });
      expect(r.ok).toBe(true);
    }
  });

  test("coerces optional fields absent = not set on result", () => {
    const r = validatePublishInput({ title: "Test", kind: "design", html: "<p>x</p>" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      const v: PublishInput = r.value;
      expect(v.summary).toBeUndefined();
      expect(v.tags).toBeUndefined();
      expect(v.supersedes).toBeUndefined();
    }
  });

  test("accepts full input with all optional fields", () => {
    const r = validatePublishInput({
      title: "Full Test",
      kind: "report",
      html: "<p>report</p>",
      summary: "A brief summary",
      tags: ["a", "b", "c"],
      supersedes: "prev-id-123",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.summary).toBe("A brief summary");
      expect(r.value.tags).toEqual(["a", "b", "c"]);
      expect(r.value.supersedes).toBe("prev-id-123");
    }
  });

  test("accepts summary of exactly 500 chars", () => {
    const r = validatePublishInput({
      title: "Test",
      kind: "plan",
      html: "<p>x</p>",
      summary: "s".repeat(500),
    });
    expect(r.ok).toBe(true);
  });

  test("PUBLISH_KINDS has expected entries", () => {
    expect(PUBLISH_KINDS).toContain("plan");
    expect(PUBLISH_KINDS).toContain("review");
    expect(PUBLISH_KINDS).toContain("comparison");
    expect(PUBLISH_KINDS).toContain("report");
    expect(PUBLISH_KINDS).toContain("explainer");
    expect(PUBLISH_KINDS).toContain("design");
    expect(PUBLISH_KINDS).toContain("audit");
    expect(PUBLISH_KINDS).toContain("rfc");
    expect(PUBLISH_KINDS).toContain("other");
  });
});

describe("htmlBodyWarnings", () => {
  test("warns when no headings found", () => {
    const warnings = htmlBodyWarnings("<p>No headings here</p>");
    expect(warnings.some((w) => w.includes("no headings"))).toBe(true);
  });

  test("no warning when heading present", () => {
    const warnings = htmlBodyWarnings("<h1>Title</h1><p>Content</p>");
    expect(warnings.every((w) => !w.includes("no headings"))).toBe(true);
  });

  test("returns empty array for empty string", () => {
    const warnings = htmlBodyWarnings("");
    expect(Array.isArray(warnings)).toBe(true);
  });

  test("never throws on malformed HTML", () => {
    expect(() => htmlBodyWarnings("<div><unclosed><<>>")).not.toThrow();
  });

  test("recognizes h2-h6 as headings too", () => {
    for (const tag of ["h2", "h3", "h4", "h5", "h6"]) {
      const warnings = htmlBodyWarnings(`<${tag}>Section</${tag}><p>text</p>`);
      expect(warnings.every((w) => !w.includes("no headings"))).toBe(true);
    }
  });
});

// ─── PUBLISH_KINDS includes "ask" ──────────────────────────────────────────────

describe("PUBLISH_KINDS — ask", () => {
  test("includes ask", () => {
    expect(PUBLISH_KINDS).toContain("ask");
  });
});

// ─── validateQuestion ──────────────────────────────────────────────────────────

describe("validateQuestion — valid types", () => {
  test("accepts pick_one with options", () => {
    const r = validateQuestion({
      type: "pick_one",
      id: "q1",
      question: "Which do you prefer?",
      options: [
        { id: "a", label: "Option A" },
        { id: "b", label: "Option B" },
      ],
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.question.type).toBe("pick_one");
      expect(r.question.id).toBe("q1");
    }
  });

  test("accepts pick_many with options and bounds", () => {
    const r = validateQuestion({
      type: "pick_many",
      id: "q2",
      question: "Select all that apply",
      options: [{ id: "x", label: "X" }],
      min: 1,
      max: 3,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.question.type).toBe("pick_many");
    }
  });

  test("accepts confirm without labels", () => {
    const r = validateQuestion({ type: "confirm", id: "q3", question: "Proceed?" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.question.type).toBe("confirm");
    }
  });

  test("accepts confirm with yesLabel and noLabel", () => {
    const r = validateQuestion({
      type: "confirm",
      id: "q3",
      question: "Proceed?",
      yesLabel: "Yep",
      noLabel: "Nope",
    });
    expect(r.ok).toBe(true);
    if (r.ok && r.question.type === "confirm") {
      expect(r.question.yesLabel).toBe("Yep");
      expect(r.question.noLabel).toBe("Nope");
    }
  });

  test("accepts ask_text", () => {
    const r = validateQuestion({
      type: "ask_text",
      id: "q4",
      question: "What do you think?",
      multiline: true,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.question.type).toBe("ask_text");
    }
  });

  test("accepts ask_text with optional: true", () => {
    const r = validateQuestion({
      type: "ask_text",
      id: "q4",
      question: "Anything else?",
      optional: true,
    });
    expect(r.ok).toBe(true);
    if (r.ok && r.question.type === "ask_text") {
      expect(r.question.optional).toBe(true);
    }
  });

  test("accepts ask_text with optional: false", () => {
    const r = validateQuestion({
      type: "ask_text",
      id: "q4",
      question: "Tell me more.",
      optional: false,
    });
    expect(r.ok).toBe(true);
    if (r.ok && r.question.type === "ask_text") {
      expect(r.question.optional).toBe(false);
    }
  });

  test("accepts ask_text without optional field (defaults to absent/false)", () => {
    const r = validateQuestion({
      type: "ask_text",
      id: "q4",
      question: "What do you think?",
    });
    expect(r.ok).toBe(true);
    if (r.ok && r.question.type === "ask_text") {
      expect(r.question.optional).toBeUndefined();
    }
  });

  test("accepts slider with min < max", () => {
    const r = validateQuestion({
      type: "slider",
      id: "q5",
      question: "Rate it",
      min: 0,
      max: 10,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.question.type).toBe("slider");
    }
  });

  test("accepts react", () => {
    const r = validateQuestion({
      type: "react",
      id: "q6",
      question: "Approve this?",
      mode: "approve",
      allowComment: true,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.question.type).toBe("react");
    }
  });
});

describe("validateQuestion — rejection cases", () => {
  test("rejects missing id", () => {
    const r = validateQuestion({ type: "confirm", question: "Yes?" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("id");
  });

  test("rejects empty id", () => {
    const r = validateQuestion({ type: "confirm", id: "  ", question: "Yes?" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("id");
  });

  test("rejects invalid type", () => {
    const r = validateQuestion({ type: "unknown_type", id: "q1", question: "?" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("type");
  });

  test("rejects pick_one with empty options array", () => {
    const r = validateQuestion({ type: "pick_one", id: "q1", question: "Pick", options: [] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("option");
  });

  test("rejects pick_one with missing options", () => {
    const r = validateQuestion({ type: "pick_one", id: "q1", question: "Pick" });
    expect(r.ok).toBe(false);
  });

  test("rejects pick_many with min > max", () => {
    const r = validateQuestion({
      type: "pick_many",
      id: "q1",
      question: "Pick",
      options: [{ id: "a", label: "A" }],
      min: 5,
      max: 2,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("min");
  });

  test("rejects slider with min === max", () => {
    const r = validateQuestion({
      type: "slider",
      id: "q1",
      question: "Rate",
      min: 5,
      max: 5,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("min");
  });

  test("rejects slider with min > max", () => {
    const r = validateQuestion({
      type: "slider",
      id: "q1",
      question: "Rate",
      min: 10,
      max: 5,
    });
    expect(r.ok).toBe(false);
  });

  test("rejects non-object input", () => {
    const r = validateQuestion("not an object");
    expect(r.ok).toBe(false);
  });

  test("rejects ask_text with optional as non-boolean", () => {
    const r = validateQuestion({
      type: "ask_text",
      id: "q4",
      question: "Anything?",
      optional: "yes",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("optional");
  });
});

// ─── validateAnswerValue ───────────────────────────────────────────────────────

describe("validateAnswerValue", () => {
  test("accepts pick_one answer with string selected", () => {
    const r = validateAnswerValue("pick_one", { type: "pick_one", selected: "opt-a" });
    expect(r.ok).toBe(true);
    if (r.ok && r.value.type === "pick_one") {
      expect(r.value.selected).toBe("opt-a");
    }
  });

  test("rejects pick_one answer with non-string selected", () => {
    const r = validateAnswerValue("pick_one", { type: "pick_one", selected: 123 });
    expect(r.ok).toBe(false);
  });

  test("accepts pick_many answer with string[] selected", () => {
    const r = validateAnswerValue("pick_many", { type: "pick_many", selected: ["a", "b"] });
    expect(r.ok).toBe(true);
  });

  test("rejects pick_many answer with non-string[] selected", () => {
    const r = validateAnswerValue("pick_many", { type: "pick_many", selected: [1, 2] });
    expect(r.ok).toBe(false);
  });

  test("accepts confirm answer yes", () => {
    const r = validateAnswerValue("confirm", { type: "confirm", choice: "yes" });
    expect(r.ok).toBe(true);
    if (r.ok && r.value.type === "confirm") {
      expect(r.value.choice).toBe("yes");
    }
  });

  test("accepts confirm answer no", () => {
    const r = validateAnswerValue("confirm", { type: "confirm", choice: "no" });
    expect(r.ok).toBe(true);
  });

  test("rejects confirm answer with invalid choice", () => {
    const r = validateAnswerValue("confirm", { type: "confirm", choice: "maybe" });
    expect(r.ok).toBe(false);
  });

  test("accepts ask_text answer", () => {
    const r = validateAnswerValue("ask_text", { type: "ask_text", text: "hello" });
    expect(r.ok).toBe(true);
    if (r.ok && r.value.type === "ask_text") {
      expect(r.value.text).toBe("hello");
    }
  });

  test("rejects ask_text answer with non-string text", () => {
    const r = validateAnswerValue("ask_text", { type: "ask_text", text: 42 });
    expect(r.ok).toBe(false);
  });

  test("accepts slider answer", () => {
    const r = validateAnswerValue("slider", { type: "slider", value: 7 });
    expect(r.ok).toBe(true);
    if (r.ok && r.value.type === "slider") {
      expect(r.value.value).toBe(7);
    }
  });

  test("rejects slider answer with non-numeric value", () => {
    const r = validateAnswerValue("slider", { type: "slider", value: "high" });
    expect(r.ok).toBe(false);
  });

  test("accepts react answer with decision", () => {
    const r = validateAnswerValue("react", { type: "react", decision: "approve" });
    expect(r.ok).toBe(true);
  });

  test("accepts react answer with decision and comment", () => {
    const r = validateAnswerValue("react", {
      type: "react",
      decision: "approve",
      comment: "Looks good",
    });
    expect(r.ok).toBe(true);
    if (r.ok && r.value.type === "react") {
      expect(r.value.comment).toBe("Looks good");
    }
  });

  test("rejects react answer missing decision", () => {
    const r = validateAnswerValue("react", { type: "react" });
    expect(r.ok).toBe(false);
  });

  test("rejects type mismatch — pick_one question, confirm answer", () => {
    const r = validateAnswerValue("pick_one", { type: "confirm", choice: "yes" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("mismatch");
  });

  test("rejects non-object value", () => {
    const r = validateAnswerValue("confirm", "not-an-object");
    expect(r.ok).toBe(false);
  });
});

// ─── validateAskInput ─────────────────────────────────────────────────────────

const VALID_QUESTION = {
  type: "pick_one",
  id: "q1",
  question: "Which option?",
  options: [
    { id: "a", label: "Option A" },
    { id: "b", label: "Option B" },
  ],
};

describe("validateAskInput — happy path", () => {
  test("accepts full valid input", () => {
    const r = validateAskInput({
      title: "My Q&A",
      body: "<p>Please answer the following questions.</p>",
      questions: [VALID_QUESTION],
      summary: "A short summary",
      tags: ["ux", "research"],
      expiresAt: "2026-12-31T23:59:59Z",
      requireAll: true,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.title).toBe("My Q&A");
      expect(r.value.questions).toHaveLength(1);
      expect(r.value.requireAll).toBe(true);
    }
  });

  test("accepts minimal valid input (title + body + 1 question)", () => {
    const r = validateAskInput({
      title: "Minimal",
      body: "",
      questions: [VALID_QUESTION],
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.summary).toBeUndefined();
      expect(r.value.tags).toBeUndefined();
      expect(r.value.expiresAt).toBeUndefined();
      expect(r.value.requireAll).toBeUndefined();
    }
  });
});

describe("validateAskInput — rejection cases", () => {
  test("rejects empty title", () => {
    const r = validateAskInput({
      title: "  ",
      body: "",
      questions: [VALID_QUESTION],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("title");
  });

  test("rejects missing title", () => {
    const r = validateAskInput({ body: "", questions: [VALID_QUESTION] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("title");
  });

  test("rejects empty questions array", () => {
    const r = validateAskInput({ title: "T", body: "", questions: [] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("questions");
  });

  test("rejects missing questions field", () => {
    const r = validateAskInput({ title: "T", body: "" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("questions");
  });

  test("rejects duplicate question ids", () => {
    const r = validateAskInput({
      title: "T",
      body: "",
      questions: [VALID_QUESTION, { ...VALID_QUESTION, question: "Another?" }],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("duplicate");
  });

  test("rejects invalid expiresAt (non-date string)", () => {
    const r = validateAskInput({
      title: "T",
      body: "",
      questions: [VALID_QUESTION],
      expiresAt: "not-a-date",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("expiresAt");
  });

  test("rejects expiresAt that is not a string", () => {
    const r = validateAskInput({
      title: "T",
      body: "",
      questions: [VALID_QUESTION],
      expiresAt: 12345,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("expiresAt");
  });

  test("rejects non-boolean requireAll", () => {
    const r = validateAskInput({
      title: "T",
      body: "",
      questions: [VALID_QUESTION],
      requireAll: "yes",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("requireAll");
  });

  test("rejects non-object input", () => {
    const r = validateAskInput(null);
    expect(r.ok).toBe(false);
  });

  test("propagates invalid question error", () => {
    const r = validateAskInput({
      title: "T",
      body: "",
      questions: [{ type: "slider", id: "s1", question: "Rate", min: 10, max: 5 }],
    });
    expect(r.ok).toBe(false);
  });
});
