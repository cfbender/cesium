// Tests for data-cesium-anchor stamping on rendered blocks (Phase 2).
// test/blocks-anchors.test.ts
//
// Covers:
//   - Top-level block-N anchors on outermost elements
//   - Divider skips anchor
//   - Code per-line anchors (shiki + plain-text fallback)
//   - Diff per-line anchors (before/after arm + patch arm with hunk-sep)
//   - Nested section: section is anchored, children are not
//   - Index propagation across a mixed block list

import { describe, test, expect } from "bun:test";
import { renderBlocks } from "../src/render/blocks/render.ts";
import type { Block } from "../src/render/blocks/types.ts";

// ─── One-of-each fixture ──────────────────────────────────────────────────────

describe("top-level block-N anchor on outermost element", () => {
  test("hero block gets data-cesium-anchor='block-0'", async () => {
    const blocks: Block[] = [{ type: "hero", title: "Hello" }];
    const html = await renderBlocks(blocks);
    // <header data-cesium-anchor="block-0">
    expect(html).toContain('data-cesium-anchor="block-0"');
    // Exactly one occurrence at the outermost element
    const matches = html.match(/data-cesium-anchor="block-0"/g) ?? [];
    expect(matches.length).toBe(1);
  });

  test("tldr block gets data-cesium-anchor='block-0'", async () => {
    const blocks: Block[] = [{ type: "tldr", markdown: "Summary." }];
    const html = await renderBlocks(blocks);
    expect(html).toContain('data-cesium-anchor="block-0"');
  });

  test("prose block gets data-cesium-anchor='block-0' injected on outermost element", async () => {
    const blocks: Block[] = [{ type: "prose", markdown: "Hello world." }];
    const html = await renderBlocks(blocks);
    expect(html).toContain('data-cesium-anchor="block-0"');
    // The prose outermost element is a <p>
    expect(html).toContain('<p data-cesium-anchor="block-0">');
  });

  test("list block (bullet) gets anchor on outermost <ul>", async () => {
    const blocks: Block[] = [{ type: "list", items: ["a", "b"] }];
    const html = await renderBlocks(blocks);
    expect(html).toContain('<ul data-cesium-anchor="block-0">');
  });

  test("list block (number) gets anchor on outermost <ol>", async () => {
    const blocks: Block[] = [{ type: "list", style: "number", items: ["a"] }];
    const html = await renderBlocks(blocks);
    expect(html).toContain('<ol data-cesium-anchor="block-0">');
  });

  test("list block (check) gets anchor on outermost <ul>", async () => {
    const blocks: Block[] = [{ type: "list", style: "check", items: ["a"] }];
    const html = await renderBlocks(blocks);
    expect(html).toContain('<ul class="check-list" data-cesium-anchor="block-0">');
  });

  test("callout block gets anchor on outermost <aside>", async () => {
    const blocks: Block[] = [{ type: "callout", variant: "note", markdown: "Note." }];
    const html = await renderBlocks(blocks);
    expect(html).toContain('data-cesium-anchor="block-0"');
    expect(html).toContain('<aside class="callout note" data-cesium-anchor="block-0">');
  });

  test("timeline block gets anchor on outermost <ul>", async () => {
    const blocks: Block[] = [{ type: "timeline", items: [{ label: "Phase 1", text: "Done" }] }];
    const html = await renderBlocks(blocks);
    expect(html).toContain('<ul class="timeline" data-cesium-anchor="block-0">');
  });

  test("compare_table block gets anchor on outermost <table>", async () => {
    const blocks: Block[] = [{ type: "compare_table", headers: ["A", "B"], rows: [["a1", "b1"]] }];
    const html = await renderBlocks(blocks);
    expect(html).toContain('<table class="compare-table" data-cesium-anchor="block-0">');
  });

  test("risk_table block gets anchor on outermost <table>", async () => {
    const blocks: Block[] = [
      {
        type: "risk_table",
        rows: [{ risk: "R", likelihood: "low", impact: "high", mitigation: "M" }],
      },
    ];
    const html = await renderBlocks(blocks);
    expect(html).toContain('<table class="risk-table" data-cesium-anchor="block-0">');
  });

  test("kv block gets anchor on outermost <dl>", async () => {
    const blocks: Block[] = [{ type: "kv", rows: [{ k: "Key", v: "Value" }] }];
    const html = await renderBlocks(blocks);
    expect(html).toContain('<dl class="kv" data-cesium-anchor="block-0">');
  });

  test("pill_row block gets anchor on outermost <div>", async () => {
    const blocks: Block[] = [{ type: "pill_row", items: [{ kind: "pill", text: "TypeScript" }] }];
    const html = await renderBlocks(blocks);
    expect(html).toContain('<div class="pill-row" data-cesium-anchor="block-0">');
  });

  test("diagram block gets anchor on outermost <figure>", async () => {
    const blocks: Block[] = [
      {
        type: "diagram",
        svg: '<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>',
      },
    ];
    const html = await renderBlocks(blocks);
    expect(html).toContain('<figure class="diagram" data-cesium-anchor="block-0">');
  });

  test("raw_html block gets anchor on outermost element", async () => {
    const blocks: Block[] = [{ type: "raw_html", html: "<div><p>Custom</p></div>" }];
    const html = await renderBlocks(blocks);
    expect(html).toContain('data-cesium-anchor="block-0"');
    expect(html).toContain('<div data-cesium-anchor="block-0">');
  });

  test("section block gets anchor on outermost <section>", async () => {
    const blocks: Block[] = [{ type: "section", title: "Goals", children: [] }];
    const html = await renderBlocks(blocks);
    expect(html).toContain('<section data-cesium-anchor="block-0">');
  });
});

// ─── Divider skips anchor ─────────────────────────────────────────────────────

describe("divider skips anchor", () => {
  test("single divider block produces no data-cesium-anchor attribute", async () => {
    const blocks: Block[] = [{ type: "divider" }];
    const html = await renderBlocks(blocks);
    expect(html).not.toContain("data-cesium-anchor");
  });

  test("divider with label also produces no anchor", async () => {
    const blocks: Block[] = [{ type: "divider", label: "End" }];
    const html = await renderBlocks(blocks);
    expect(html).not.toContain("data-cesium-anchor");
  });
});

// ─── Code per-line anchors (shiki) ───────────────────────────────────────────

describe("code block per-line anchors", () => {
  test("three-line TypeScript code produces three sequential line anchors", async () => {
    const blocks: Block[] = [{ type: "code", lang: "typescript", code: "a\nb\nc" }];
    const html = await renderBlocks(blocks);
    expect(html).toContain('data-cesium-anchor="block-0.line-1"');
    expect(html).toContain('data-cesium-anchor="block-0.line-2"');
    expect(html).toContain('data-cesium-anchor="block-0.line-3"');
    // No line-4
    expect(html).not.toContain('data-cesium-anchor="block-0.line-4"');
  });

  test("per-line anchors are on <span class='line'> elements", async () => {
    const blocks: Block[] = [{ type: "code", lang: "typescript", code: "const x = 1;" }];
    const html = await renderBlocks(blocks);
    expect(html).toContain('<span class="line" data-cesium-anchor="block-0.line-1">');
  });

  test("figure outer element also carries block-0 anchor", async () => {
    const blocks: Block[] = [{ type: "code", lang: "typescript", code: "x" }];
    const html = await renderBlocks(blocks);
    expect(html).toContain('<figure class="code" data-cesium-anchor="block-0">');
  });
});

// ─── Code per-line anchors (plain-text fallback) ──────────────────────────────

describe("code block per-line anchors — plain-text fallback", () => {
  test("unsupported lang uses plain fallback with sequential anchors", async () => {
    const blocks: Block[] = [
      { type: "code", lang: "text", code: "line one\nline two\nline three" },
    ];
    const html = await renderBlocks(blocks);
    expect(html).toContain('data-cesium-anchor="block-0.line-1"');
    expect(html).toContain('data-cesium-anchor="block-0.line-2"');
    expect(html).toContain('data-cesium-anchor="block-0.line-3"');
    expect(html).not.toContain('data-cesium-anchor="block-0.line-4"');
  });

  test("plain-text fallback anchors are on <span class='line'> elements", async () => {
    const blocks: Block[] = [{ type: "code", lang: "text", code: "hello" }];
    const html = await renderBlocks(blocks);
    expect(html).toContain('<span class="line" data-cesium-anchor="block-0.line-1">');
  });
});

// ─── Diff per-line anchors (before/after arm) ─────────────────────────────────

describe("diff block per-line anchors — before/after arm", () => {
  test("diff block figure carries block-0 anchor", async () => {
    const blocks: Block[] = [{ type: "diff", before: "old", after: "new" }];
    const html = await renderBlocks(blocks);
    expect(html).toContain('data-cesium-anchor="block-0"');
    // Figure element specifically
    expect(html).toContain('class="diff-block"');
    expect(html).toMatch(/data-cesium-anchor="block-0"/);
  });

  test("diff <li> elements carry sequential line anchors starting at 1", async () => {
    const blocks: Block[] = [{ type: "diff", before: "a\nb", after: "a\nc" }];
    const html = await renderBlocks(blocks);
    // Anchors must exist on <li> elements
    expect(html).toContain('data-cesium-anchor="block-0.line-1"');
    expect(html).toContain('data-cesium-anchor="block-0.line-2"');
    expect(html).toContain('data-cesium-anchor="block-0.line-3"');
    // There should be multiple <li> elements with anchors
    const lineAnchors = html.match(/data-cesium-anchor="block-0\.line-\d+"/g) ?? [];
    expect(lineAnchors.length).toBeGreaterThan(0);
  });

  test("anchors appear on <li class='diff-line'> elements, not other elements", async () => {
    const blocks: Block[] = [{ type: "diff", before: "x", after: "y" }];
    const html = await renderBlocks(blocks);
    // Check that anchors appear inside <li class="diff-line ..."> context
    expect(html).toMatch(/<li class="diff-line [^"]*" data-cesium-anchor="block-0\.line-\d+"/);
  });

  test("context lines appear in both columns and each gets a distinct M", async () => {
    // "a" is context (unchanged), "b"→"c" is a change
    const blocks: Block[] = [{ type: "diff", before: "a\nb", after: "a\nc" }];
    const html = await renderBlocks(blocks);
    // Should have multiple distinct M values since context goes to both sides
    const anchors =
      html.match(/data-cesium-anchor="block-0\.line-(\d+)"/g)?.map((m) => {
        const match = /line-(\d+)/.exec(m);
        return match !== null ? parseInt(match[1] ?? "0", 10) : 0;
      }) ?? [];
    // All M values should be distinct (no duplicates)
    const unique = new Set(anchors);
    expect(unique.size).toBe(anchors.length);
  });
});

// ─── Diff per-line anchors (patch arm with hunk separator) ───────────────────

describe("diff block per-line anchors — patch arm with hunk-sep", () => {
  const patchWithHunkSep = ["@@ -1,2 +1,2 @@", " context", "-removed", "+added"].join("\n");

  test("hunk-sep <li> elements also get anchors", async () => {
    // Need a patch that forces a hunk separator — use a larger patch with two hunks
    const bigPatch = [
      "@@ -1,3 +1,3 @@",
      " ctx1",
      "-rem1",
      "+add1",
      "@@ -10,3 +10,3 @@",
      " ctx2",
      "-rem2",
      "+add2",
    ].join("\n");
    const blocks: Block[] = [{ type: "diff", patch: bigPatch }];
    const html = await renderBlocks(blocks);
    // There should be <li class="diff-line hunk-sep"...> elements with anchors
    expect(html).toMatch(/class="diff-line hunk-sep" data-cesium-anchor="block-0\.line-\d+"/);
  });

  test("valid patch renders with block-0 anchor on figure", async () => {
    const blocks: Block[] = [{ type: "diff", patch: patchWithHunkSep }];
    const html = await renderBlocks(blocks);
    expect(html).toContain('data-cesium-anchor="block-0"');
    expect(html).toContain('class="diff-block"');
  });

  test("all <li> elements in a patch diff carry sequential anchors", async () => {
    const blocks: Block[] = [{ type: "diff", patch: patchWithHunkSep }];
    const html = await renderBlocks(blocks);
    const anchors = html.match(/data-cesium-anchor="block-0\.line-\d+"/g) ?? [];
    expect(anchors.length).toBeGreaterThan(0);
    // Extract all M values and confirm they're sequential starting from 1
    const nums = anchors.map((a) => {
      const m = /line-(\d+)/.exec(a);
      return m !== null ? parseInt(m[1] ?? "0", 10) : 0;
    });
    const sorted = [...nums].toSorted((a, b) => a - b);
    // Min value should be 1, and all M values should be distinct
    expect(sorted[0]).toBe(1);
    const unique = new Set(nums);
    expect(unique.size).toBe(nums.length);
  });
});

// ─── Nested section ───────────────────────────────────────────────────────────

describe("nested section anchor behavior", () => {
  test("section outermost element has block-0 anchor", async () => {
    const blocks: Block[] = [
      {
        type: "section",
        title: "Goals",
        children: [{ type: "prose", markdown: "Child prose." }],
      },
    ];
    const html = await renderBlocks(blocks);
    expect(html).toContain('<section data-cesium-anchor="block-0">');
  });

  test("child prose inside section does NOT carry a data-cesium-anchor attribute", async () => {
    const blocks: Block[] = [
      {
        type: "section",
        title: "Goals",
        children: [{ type: "prose", markdown: "Child prose content." }],
      },
    ];
    const html = await renderBlocks(blocks);
    // Only block-0 anchor should exist (on the section), not on the child prose
    const anchors = html.match(/data-cesium-anchor="[^"]+"/g) ?? [];
    // All anchors found must be block-0 (section anchor only)
    expect(anchors.every((a) => a === 'data-cesium-anchor="block-0"')).toBe(true);
  });

  test("child code inside section does NOT get block-N anchor on <figure>", async () => {
    const blocks: Block[] = [
      {
        type: "section",
        title: "Code section",
        children: [{ type: "code", lang: "typescript", code: "const x = 1;" }],
      },
    ];
    const html = await renderBlocks(blocks);
    // No <figure data-cesium-anchor> — only the section gets block-0
    expect(html).not.toContain('<figure class="code" data-cesium-anchor=');
    // The section itself still has block-0
    expect(html).toContain('<section data-cesium-anchor="block-0">');
  });

  test("child code inside section has NO per-line anchors (ctx.anchor is null)", async () => {
    const blocks: Block[] = [
      {
        type: "section",
        title: "Code section",
        children: [{ type: "code", lang: "typescript", code: "line1\nline2" }],
      },
    ];
    const html = await renderBlocks(blocks);
    // No line anchors because ctx.anchor is null for children
    expect(html).not.toContain('data-cesium-anchor="block-0.line-');
    // Only the section's block-0 anchor
    const anchors = html.match(/data-cesium-anchor="[^"]+"/g) ?? [];
    expect(anchors.every((a) => a === 'data-cesium-anchor="block-0"')).toBe(true);
  });
});

// ─── Block index propagation ──────────────────────────────────────────────────

describe("block index propagation", () => {
  test("[hero, tldr, prose, divider] → block-0, block-1, block-2, no anchor for divider", async () => {
    const blocks: Block[] = [
      { type: "hero", title: "Title" },
      { type: "tldr", markdown: "Summary." },
      { type: "prose", markdown: "Content." },
      { type: "divider" },
    ];
    const html = await renderBlocks(blocks);
    expect(html).toContain('data-cesium-anchor="block-0"');
    expect(html).toContain('data-cesium-anchor="block-1"');
    expect(html).toContain('data-cesium-anchor="block-2"');
    // Divider at index 3 — no anchor for it
    expect(html).not.toContain('data-cesium-anchor="block-3"');
  });

  test("second code block in list gets block-1 anchor and block-1.line-N per-line", async () => {
    const blocks: Block[] = [
      { type: "prose", markdown: "First." },
      { type: "code", lang: "typescript", code: "a\nb" },
    ];
    const html = await renderBlocks(blocks);
    // Code block is index 1
    expect(html).toContain('<figure class="code" data-cesium-anchor="block-1">');
    expect(html).toContain('data-cesium-anchor="block-1.line-1"');
    expect(html).toContain('data-cesium-anchor="block-1.line-2"');
    // No block-0.line-N (prose has no lines)
    expect(html).not.toContain('data-cesium-anchor="block-0.line-');
  });

  test("multiple blocks — each top-level block has exactly one block-N attribute", async () => {
    const blocks: Block[] = [
      { type: "hero", title: "H" },
      { type: "section", title: "S", children: [] },
      { type: "callout", variant: "note", markdown: "C." },
    ];
    const html = await renderBlocks(blocks);
    for (let i = 0; i < 3; i++) {
      const occurrences = (html.match(new RegExp(`data-cesium-anchor="block-${i}"`, "g")) ?? [])
        .length;
      expect(occurrences).toBe(1);
    }
  });
});
