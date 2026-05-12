// Tests for block validation — happy paths and error cases.
// test/blocks-validate.test.ts

import { describe, test, expect } from "bun:test";
import { validatePublishInput } from "../src/render/validate.ts";

// ─── Helper ──────────────────────────────────────────────────────────────────

function validateBlocks(blocks: unknown) {
  return validatePublishInput({ title: "Test", kind: "plan", blocks });
}

// ─── XOR enforcement ─────────────────────────────────────────────────────────

describe("XOR: html vs blocks", () => {
  test("rejects when both html and blocks are provided", () => {
    const r = validatePublishInput({
      title: "Test",
      kind: "plan",
      html: "<p>hi</p>",
      blocks: [{ type: "prose", markdown: "hello" }],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("exactly one");
  });

  test("rejects when neither html nor blocks are provided", () => {
    const r = validatePublishInput({ title: "Test", kind: "plan" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("exactly one");
  });

  test("accepts html alone", () => {
    const r = validatePublishInput({ title: "Test", kind: "plan", html: "<p>hi</p>" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.html).toBe("<p>hi</p>");
  });

  test("accepts blocks alone", () => {
    const r = validateBlocks([{ type: "prose", markdown: "hello" }]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.blocks).toBeDefined();
  });
});

// ─── Top-level structural rules ───────────────────────────────────────────────

describe("blocks top-level structural rules", () => {
  test("rejects blocks exceeding 1000", () => {
    const r = validateBlocks(Array.from({ length: 1001 }, () => ({ type: "prose", markdown: "x" })));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("1000");
  });

  test("accepts exactly 1000 blocks", () => {
    const r = validateBlocks(Array.from({ length: 1000 }, () => ({ type: "prose", markdown: "x" })));
    expect(r.ok).toBe(true);
  });

  test("rejects hero not first", () => {
    const r = validateBlocks([
      { type: "prose", markdown: "first" },
      { type: "hero", title: "Title" },
    ]);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain("hero");
      expect(r.error).toContain("first");
    }
  });

  test("accepts hero as first block", () => {
    const r = validateBlocks([{ type: "hero", title: "Big Title" }, { type: "prose", markdown: "x" }]);
    expect(r.ok).toBe(true);
  });

  test("rejects multiple hero blocks", () => {
    const r = validateBlocks([
      { type: "hero", title: "First" },
      { type: "prose", markdown: "x" },
      { type: "hero", title: "Second" },
    ]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("hero");
  });

  test("rejects multiple tldr blocks", () => {
    const r = validateBlocks([
      { type: "tldr", markdown: "summary one" },
      { type: "prose", markdown: "body" },
      { type: "tldr", markdown: "summary two" },
    ]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("tldr");
  });

  test("rejects non-array blocks", () => {
    const r = validateBlocks("not an array");
    expect(r.ok).toBe(false);
  });
});

// ─── Unknown type ─────────────────────────────────────────────────────────────

describe("unknown block type", () => {
  test("rejects unknown block type", () => {
    const r = validateBlocks([{ type: "not_a_real_type", markdown: "x" }]);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain("unknown block type");
      expect(r.error).toContain("blocks[0]");
    }
  });
});

// ─── Required field checks ────────────────────────────────────────────────────

describe("missing required fields", () => {
  test("rejects hero without title", () => {
    const r = validateBlocks([{ type: "hero" }]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("title");
  });

  test("rejects tldr without markdown", () => {
    const r = validateBlocks([{ type: "tldr" }]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("markdown");
  });

  test("rejects callout with invalid variant", () => {
    const r = validateBlocks([{ type: "callout", variant: "danger", markdown: "x" }]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("variant");
  });

  test("rejects callout without markdown", () => {
    const r = validateBlocks([{ type: "callout", variant: "note" }]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("markdown");
  });

  test("rejects code without lang", () => {
    const r = validateBlocks([{ type: "code", code: "console.log('hi')" }]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("lang");
  });

  test("rejects code with empty lang", () => {
    const r = validateBlocks([{ type: "code", lang: "  ", code: "x" }]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("lang");
  });

  test("rejects raw_html with empty html", () => {
    const r = validateBlocks([{ type: "raw_html", html: "" }]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("raw_html");
  });

  test("rejects section without children array", () => {
    const r = validateBlocks([{ type: "section", title: "Section" }]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("children");
  });
});

// ─── Nesting depth ────────────────────────────────────────────────────────────

describe("section nesting depth", () => {
  test("accepts sections at depth 1 (root level)", () => {
    const r = validateBlocks([
      { type: "section", title: "Top", children: [{ type: "prose", markdown: "body" }] },
    ]);
    expect(r.ok).toBe(true);
  });

  test("accepts sections at depth 2", () => {
    const r = validateBlocks([
      {
        type: "section",
        title: "Top",
        children: [
          {
            type: "section",
            title: "Sub",
            children: [{ type: "prose", markdown: "leaf" }],
          },
        ],
      },
    ]);
    expect(r.ok).toBe(true);
  });

  test("accepts sections at depth 3", () => {
    const r = validateBlocks([
      {
        type: "section",
        title: "L1",
        children: [
          {
            type: "section",
            title: "L2",
            children: [
              {
                type: "section",
                title: "L3",
                children: [{ type: "prose", markdown: "leaf" }],
              },
            ],
          },
        ],
      },
    ]);
    expect(r.ok).toBe(true);
  });

  test("rejects sections at depth > 3", () => {
    const r = validateBlocks([
      {
        type: "section",
        title: "L1",
        children: [
          {
            type: "section",
            title: "L2",
            children: [
              {
                type: "section",
                title: "L3",
                children: [
                  {
                    type: "section",
                    title: "L4 — too deep",
                    children: [],
                  },
                ],
              },
            ],
          },
        ],
      },
    ]);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain("depth");
    }
  });
});

// ─── Table cell mismatch ──────────────────────────────────────────────────────

describe("compare_table cell count mismatch", () => {
  test("accepts table where row cell count matches headers", () => {
    const r = validateBlocks([
      {
        type: "compare_table",
        headers: ["A", "B", "C"],
        rows: [["a1", "b1", "c1"], ["a2", "b2", "c2"]],
      },
    ]);
    expect(r.ok).toBe(true);
  });

  test("rejects table where a row has too few cells", () => {
    const r = validateBlocks([
      {
        type: "compare_table",
        headers: ["A", "B", "C"],
        rows: [["a1", "b1"]], // missing c1
      },
    ]);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain("compare_table");
      expect(r.error).toContain("rows[0]");
    }
  });

  test("rejects table where a row has too many cells", () => {
    const r = validateBlocks([
      {
        type: "compare_table",
        headers: ["A", "B"],
        rows: [["a1", "b1", "extra"]],
      },
    ]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("rows[0]");
  });
});

// ─── Diagram: exactly one of svg or html ─────────────────────────────────────

describe("diagram svg/html exclusivity", () => {
  test("accepts diagram with svg only", () => {
    const r = validateBlocks([{ type: "diagram", svg: "<svg></svg>" }]);
    expect(r.ok).toBe(true);
  });

  test("accepts diagram with html only", () => {
    const r = validateBlocks([{ type: "diagram", html: "<div>x</div>" }]);
    expect(r.ok).toBe(true);
  });

  test("rejects diagram with both svg and html", () => {
    const r = validateBlocks([{ type: "diagram", svg: "<svg></svg>", html: "<div>x</div>" }]);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain("diagram");
      expect(r.error).toContain("blocks[0]");
    }
  });

  test("rejects diagram with neither svg nor html", () => {
    const r = validateBlocks([{ type: "diagram" }]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("diagram");
  });
});

// ─── Path tagging in error messages ──────────────────────────────────────────

describe("error path tagging", () => {
  test("error path contains block index for top-level errors", () => {
    const r = validateBlocks([
      { type: "prose", markdown: "ok" },
      { type: "code" }, // missing lang and code — at index 1
    ]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("blocks[1]");
  });

  test("error path contains nested path for section child errors", () => {
    const r = validateBlocks([
      {
        type: "section",
        title: "Top",
        children: [
          { type: "prose", markdown: "ok" },
          { type: "code" }, // missing lang at children[1]
        ],
      },
    ]);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain("children[1]");
    }
  });
});

// ─── Happy paths ──────────────────────────────────────────────────────────────

describe("happy paths", () => {
  test("accepts minimal prose block", () => {
    const r = validateBlocks([{ type: "prose", markdown: "hello" }]);
    expect(r.ok).toBe(true);
  });

  test("accepts full featured document", () => {
    const r = validateBlocks([
      { type: "hero", title: "My Document", eyebrow: "Report", subtitle: "Details" },
      { type: "tldr", markdown: "**TL;DR:** This is the summary." },
      {
        type: "section",
        title: "Background",
        children: [
          { type: "prose", markdown: "Some background text." },
          { type: "callout", variant: "note", markdown: "Important note." },
        ],
      },
      { type: "code", lang: "typescript", code: "const x = 1;" },
      {
        type: "compare_table",
        headers: ["Option", "Pro", "Con"],
        rows: [["A", "Fast", "Expensive"], ["B", "Cheap", "Slow"]],
      },
      { type: "divider", label: "End" },
    ]);
    expect(r.ok).toBe(true);
  });
});
