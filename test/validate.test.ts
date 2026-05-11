import { describe, expect, test } from "bun:test";
import {
  htmlBodyWarnings,
  PUBLISH_KINDS,
  validatePublishInput,
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
