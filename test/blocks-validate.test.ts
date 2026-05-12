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
    const r = validateBlocks(
      Array.from({ length: 1001 }, () => ({ type: "prose", markdown: "x" })),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("1000");
  });

  test("accepts exactly 1000 blocks", () => {
    const r = validateBlocks(
      Array.from({ length: 1000 }, () => ({ type: "prose", markdown: "x" })),
    );
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
    const r = validateBlocks([
      { type: "hero", title: "Big Title" },
      { type: "prose", markdown: "x" },
    ]);
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
        rows: [
          ["a1", "b1", "c1"],
          ["a2", "b2", "c2"],
        ],
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
        rows: [
          ["A", "Fast", "Expensive"],
          ["B", "Cheap", "Slow"],
        ],
      },
      { type: "divider", label: "End" },
    ]);
    expect(r.ok).toBe(true);
  });
});

// ─── Deep field validation (Phase 2.5 Bug 1) ─────────────────────────────────

describe("deep block field validation", () => {
  // ─ Wrong field names with "did you mean" suggestions ──────────────────────

  test("hero.meta with 'label'/'value' instead of 'k'/'v' → error with path + did you mean", () => {
    const r = validateBlocks([
      { type: "hero", title: "My Title", meta: [{ label: "x", value: "y" }] },
    ]);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain("blocks[0].meta[0]");
      // Should mention label and suggest k
      expect(r.error).toMatch(/label.*did you mean.*k|did you mean.*k.*label/);
      // Should mention value and suggest v
      expect(r.error).toMatch(/value.*did you mean.*v|did you mean.*v.*value/);
    }
  });

  test("kv.rows with 'label'/'value' instead of 'k'/'v' → error with path + did you mean", () => {
    const r = validateBlocks([{ type: "kv", rows: [{ label: "Key", value: "Val" }] }]);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain("blocks[0].rows[0]");
      expect(r.error).toMatch(/label.*did you mean.*k|did you mean.*k.*label/);
      expect(r.error).toMatch(/value.*did you mean.*v|did you mean.*v.*value/);
    }
  });

  test("timeline item with 'title' instead of 'label' → error with path + did you mean", () => {
    const r = validateBlocks([{ type: "timeline", items: [{ title: "Phase 1", text: "Start" }] }]);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain("blocks[0].items[0]");
      expect(r.error).toMatch(/title.*did you mean.*label|did you mean.*label.*title/);
    }
  });

  test("timeline item with 'description' instead of 'text' → error with path + did you mean", () => {
    const r = validateBlocks([
      { type: "timeline", items: [{ label: "Phase 1", description: "Start here" }] },
    ]);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain("blocks[0].items[0]");
      expect(r.error).toMatch(/description.*did you mean.*text|did you mean.*text.*description/);
    }
  });

  test("unknown field on hero block → rejected with path and field name", () => {
    const r = validateBlocks([{ type: "hero", title: "Title", bogus: 1 }]);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain("blocks[0]");
      expect(r.error).toContain("bogus");
    }
  });

  test("unknown field on kv row → rejected with path and field name", () => {
    const r = validateBlocks([{ type: "kv", rows: [{ k: "Key", v: "Val", extra: "nope" }] }]);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain("blocks[0].rows[0]");
      expect(r.error).toContain("extra");
    }
  });

  test("unknown field on prose block → rejected with path and field name", () => {
    const r = validateBlocks([{ type: "prose", markdown: "Hello", badField: true }]);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain("blocks[0]");
      expect(r.error).toContain("badField");
    }
  });

  // ─ Enum value validation ──────────────────────────────────────────────────

  test("risk_table likelihood 'med' → error with valid set listed", () => {
    const r = validateBlocks([
      {
        type: "risk_table",
        rows: [{ risk: "r", likelihood: "med", impact: "high", mitigation: "m" }],
      },
    ]);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain("blocks[0].rows[0].likelihood");
      expect(r.error).toContain("low");
      expect(r.error).toContain("medium");
      expect(r.error).toContain("high");
    }
  });

  test("risk_table impact 'crit' → error with valid set listed", () => {
    const r = validateBlocks([
      {
        type: "risk_table",
        rows: [{ risk: "r", likelihood: "high", impact: "crit", mitigation: "m" }],
      },
    ]);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain("blocks[0].rows[0].impact");
      expect(r.error).toContain("low");
      expect(r.error).toContain("medium");
      expect(r.error).toContain("high");
    }
  });

  test("callout variant 'error' → error with valid set (already tested above, but deep check)", () => {
    const r = validateBlocks([{ type: "callout", variant: "error", markdown: "Bad" }]);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain("variant");
    }
  });

  test("list style 'numbered' → error with valid set", () => {
    const r = validateBlocks([{ type: "list", style: "numbered", items: ["a", "b"] }]);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain("blocks[0].style");
      expect(r.error).toContain("bullet");
      expect(r.error).toContain("number");
      expect(r.error).toContain("check");
    }
  });

  test("pill_row item kind 'badge' → error with valid set", () => {
    const r = validateBlocks([{ type: "pill_row", items: [{ kind: "badge", text: "Hi" }] }]);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain("blocks[0].items[0].kind");
      expect(r.error).toContain("pill");
      expect(r.error).toContain("tag");
    }
  });

  // ─ Missing required deep fields ───────────────────────────────────────────

  test("timeline item missing 'text' field → rejected with path", () => {
    const r = validateBlocks([{ type: "timeline", items: [{ label: "Phase 1" }] }]);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain("blocks[0].items[0].text");
    }
  });

  test("timeline item missing 'label' field → rejected with path", () => {
    const r = validateBlocks([{ type: "timeline", items: [{ text: "Start" }] }]);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain("blocks[0].items[0].label");
    }
  });

  test("kv row missing 'k' field → rejected with path", () => {
    const r = validateBlocks([{ type: "kv", rows: [{ v: "value only" }] }]);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain("blocks[0].rows[0].k");
    }
  });

  test("risk_table row missing 'mitigation' field → rejected with path", () => {
    const r = validateBlocks([
      {
        type: "risk_table",
        rows: [{ risk: "r", likelihood: "low", impact: "high" }],
      },
    ]);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain("blocks[0].rows[0].mitigation");
    }
  });

  // ─ Recursive schema validation ─────────────────────────────────────────────

  test("schema validation recurses into compare_table rows", () => {
    // compare_table rows are string[][] — each row should be string array
    const r = validateBlocks([
      {
        type: "compare_table",
        headers: ["A", "B"],
        rows: [["a1", "b1"]],
      },
    ]);
    expect(r.ok).toBe(true);
  });

  test("schema validation recurses into hero.meta", () => {
    const r = validateBlocks([
      {
        type: "hero",
        title: "Title",
        meta: [
          { k: "Status", v: "Draft" },
          { k: "Author", v: "AI" },
        ],
      },
    ]);
    expect(r.ok).toBe(true);
  });

  test("schema validation recurses into section.children → catches errors in nested blocks", () => {
    const r = validateBlocks([
      {
        type: "section",
        title: "Top",
        children: [
          { type: "prose", markdown: "ok" },
          {
            type: "risk_table",
            rows: [{ risk: "r", likelihood: "med", impact: "low", mitigation: "m" }],
          },
        ],
      },
    ]);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      // Error should be inside the section's children
      expect(r.error).toContain("children[1].rows[0].likelihood");
    }
  });

  // ─ Valid blocks that should pass ─────────────────────────────────────────────

  test("hero with valid meta k/v passes deep validation", () => {
    const r = validateBlocks([{ type: "hero", title: "Title", meta: [{ k: "Author", v: "AI" }] }]);
    expect(r.ok).toBe(true);
  });

  test("timeline with valid label/text passes deep validation", () => {
    const r = validateBlocks([
      { type: "timeline", items: [{ label: "Phase 1", text: "Start", date: "2026-01-01" }] },
    ]);
    expect(r.ok).toBe(true);
  });

  test("risk_table with valid likelihood/impact passes deep validation", () => {
    const r = validateBlocks([
      {
        type: "risk_table",
        rows: [{ risk: "Data loss", likelihood: "low", impact: "high", mitigation: "Backups" }],
      },
    ]);
    expect(r.ok).toBe(true);
  });

  test("pill_row with valid kind 'pill'/'tag' passes deep validation", () => {
    const r = validateBlocks([
      {
        type: "pill_row",
        items: [
          { kind: "pill", text: "TypeScript" },
          { kind: "tag", text: "v2" },
        ],
      },
    ]);
    expect(r.ok).toBe(true);
  });
});
