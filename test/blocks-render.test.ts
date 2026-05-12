// Tests for block renderers — fixture-based rendering checks.
// test/blocks-render.test.ts

import { describe, test, expect } from "bun:test";
import { renderBlocks } from "../src/render/blocks/render.ts";
import { renderBlock } from "../src/render/blocks/render.ts";
import type { RenderCtx, SectionCounter } from "../src/render/blocks/render.ts";
import type { Block } from "../src/render/blocks/types.ts";

function makeCtx(path = "blocks[0]"): RenderCtx {
  const counter: SectionCounter = { value: 1 };
  return { sectionCounter: counter, depth: 0, path };
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

describe("hero renderer", () => {
  test("renders title in h1.h-display inside header", () => {
    const block: Block = { type: "hero", title: "Hello World" };
    const result = renderBlock(block, makeCtx());
    expect(result).toContain("<header>");
    expect(result).toContain('<h1 class="h-display">Hello World</h1>');
  });

  test("renders eyebrow when present", () => {
    const block: Block = { type: "hero", title: "T", eyebrow: "Phase 1" };
    const result = renderBlock(block, makeCtx());
    expect(result).toContain('class="eyebrow"');
    expect(result).toContain("Phase 1");
  });

  test("renders subtitle when present", () => {
    const block: Block = { type: "hero", title: "T", subtitle: "Sub text" };
    const result = renderBlock(block, makeCtx());
    expect(result).toContain('class="lede"');
    expect(result).toContain("Sub text");
  });

  test("renders meta kv pairs when present", () => {
    const block: Block = { type: "hero", title: "T", meta: [{ k: "Author", v: "AI" }] };
    const result = renderBlock(block, makeCtx());
    expect(result).toContain('class="kv"');
    expect(result).toContain("<dt>Author</dt>");
    expect(result).toContain("<dd>AI</dd>");
  });

  test("escapes HTML in title", () => {
    const block: Block = { type: "hero", title: "<script>alert(1)</script>" };
    const result = renderBlock(block, makeCtx());
    expect(result).not.toContain("<script>");
    expect(result).toContain("&lt;script&gt;");
  });
});

// ─── Tldr ─────────────────────────────────────────────────────────────────────

describe("tldr renderer", () => {
  test("renders aside.tldr with markdown content", () => {
    const block: Block = { type: "tldr", markdown: "**Key point**: something important." };
    const result = renderBlock(block, makeCtx());
    expect(result).toContain('<aside class="tldr">');
    expect(result).toContain("<strong>Key point</strong>");
  });
});

// ─── Section ──────────────────────────────────────────────────────────────────

describe("section renderer", () => {
  test("renders section with h2.h-section and section-num", () => {
    const counter: SectionCounter = { value: 1 };
    const ctx: RenderCtx = { sectionCounter: counter, depth: 0, path: "blocks[0]" };
    const block: Block = { type: "section", title: "Goals", children: [] };
    const result = renderBlock(block, ctx);
    expect(result).toContain('<section>');
    expect(result).toContain('class="h-section"');
    expect(result).toContain('class="section-num"');
    expect(result).toContain("01");
    expect(result).toContain("Goals");
  });

  test("auto-increments section counter across multiple sections", () => {
    const blocks: Block[] = [
      { type: "section", title: "First", children: [] },
      { type: "section", title: "Second", children: [] },
      { type: "section", title: "Third", children: [] },
    ];
    const result = renderBlocks(blocks);
    expect(result).toContain(">01<");
    expect(result).toContain(">02<");
    expect(result).toContain(">03<");
  });

  test("uses explicit num when provided", () => {
    const counter: SectionCounter = { value: 1 };
    const ctx: RenderCtx = { sectionCounter: counter, depth: 0, path: "blocks[0]" };
    const block: Block = { type: "section", title: "Custom", num: "A", children: [] };
    const result = renderBlock(block, ctx);
    expect(result).toContain(">A<");
  });

  test("renders eyebrow when present", () => {
    const block: Block = {
      type: "section",
      title: "Overview",
      eyebrow: "Section context",
      children: [],
    };
    const result = renderBlock(block, makeCtx());
    expect(result).toContain('class="eyebrow"');
    expect(result).toContain("Section context");
  });

  test("renders children inside section", () => {
    const block: Block = {
      type: "section",
      title: "Goals",
      children: [{ type: "prose", markdown: "Child prose content." }],
    };
    const result = renderBlock(block, makeCtx());
    expect(result).toContain("Child prose content.");
  });
});

// ─── Prose ────────────────────────────────────────────────────────────────────

describe("prose renderer", () => {
  test("renders markdown as paragraph", () => {
    const block: Block = { type: "prose", markdown: "Hello world." };
    const result = renderBlock(block, makeCtx());
    expect(result).toContain("<p>Hello world.</p>");
  });

  test("renders bold and italic inline", () => {
    const block: Block = { type: "prose", markdown: "**bold** and *italic*" };
    const result = renderBlock(block, makeCtx());
    expect(result).toContain("<strong>bold</strong>");
    expect(result).toContain("<em>italic</em>");
  });
});

// ─── List ─────────────────────────────────────────────────────────────────────

describe("list renderer", () => {
  test("renders bullet list by default", () => {
    const block: Block = { type: "list", items: ["One", "Two", "Three"] };
    const result = renderBlock(block, makeCtx());
    expect(result).toContain("<ul>");
    expect(result).toContain("<li>One</li>");
    expect(result).toContain("<li>Two</li>");
  });

  test("renders numbered list when style=number", () => {
    const block: Block = { type: "list", style: "number", items: ["First", "Second"] };
    const result = renderBlock(block, makeCtx());
    expect(result).toContain("<ol>");
    expect(result).toContain("<li>First</li>");
  });

  test("renders check list when style=check", () => {
    const block: Block = { type: "list", style: "check", items: ["Do this", "Do that"] };
    const result = renderBlock(block, makeCtx());
    expect(result).toContain('class="check-list"');
    expect(result).toContain('class="check"');
  });
});

// ─── Callout ──────────────────────────────────────────────────────────────────

describe("callout renderer", () => {
  test("renders callout with variant class", () => {
    const block: Block = { type: "callout", variant: "warn", markdown: "Be careful." };
    const result = renderBlock(block, makeCtx());
    expect(result).toContain('<aside class="callout warn">');
    expect(result).toContain("Be careful.");
  });

  test("renders title when present", () => {
    const block: Block = {
      type: "callout",
      variant: "note",
      title: "Notice",
      markdown: "Content.",
    };
    const result = renderBlock(block, makeCtx());
    expect(result).toContain("<strong>Notice</strong>");
  });

  test("renders all three variant classes correctly", () => {
    for (const variant of ["note", "warn", "risk"] as const) {
      const block: Block = { type: "callout", variant, markdown: "Text" };
      const result = renderBlock(block, makeCtx());
      expect(result).toContain(`class="callout ${variant}"`);
    }
  });
});

// ─── Code ─────────────────────────────────────────────────────────────────────

describe("code renderer", () => {
  test("renders figure.code with pre/code and lang class", () => {
    const block: Block = { type: "code", lang: "javascript", code: "console.log('hi');" };
    const result = renderBlock(block, makeCtx());
    expect(result).toContain('<figure class="code">');
    expect(result).toContain('class="lang-javascript"');
    expect(result).toContain("console.log(&#39;hi&#39;);");
  });

  test("renders filename as figcaption", () => {
    const block: Block = { type: "code", lang: "ts", code: "x", filename: "index.ts" };
    const result = renderBlock(block, makeCtx());
    expect(result).toContain("<figcaption>index.ts</figcaption>");
  });

  test("renders caption as figcaption when no filename", () => {
    const block: Block = { type: "code", lang: "ts", code: "x", caption: "Example" };
    const result = renderBlock(block, makeCtx());
    expect(result).toContain("<figcaption>Example</figcaption>");
  });

  test("HTML in code is escaped", () => {
    const block: Block = { type: "code", lang: "html", code: "<script>alert(1)</script>" };
    const result = renderBlock(block, makeCtx());
    expect(result).not.toContain("<script>");
    expect(result).toContain("&lt;script&gt;");
  });
});

// ─── Timeline ─────────────────────────────────────────────────────────────────

describe("timeline renderer", () => {
  test("renders ul.timeline with items", () => {
    const block: Block = {
      type: "timeline",
      items: [
        { label: "Phase 1", text: "Start" },
        { label: "Phase 2", text: "End", date: "2026-06-01" },
      ],
    };
    const result = renderBlock(block, makeCtx());
    expect(result).toContain('class="timeline"');
    expect(result).toContain("Phase 1");
    expect(result).toContain("2026-06-01");
  });
});

// ─── CompareTable ─────────────────────────────────────────────────────────────

describe("compare_table renderer", () => {
  test("renders table.compare-table with headers and rows", () => {
    const block: Block = {
      type: "compare_table",
      headers: ["Col A", "Col B"],
      rows: [["a1", "b1"], ["a2", "b2"]],
    };
    const result = renderBlock(block, makeCtx());
    expect(result).toContain('class="compare-table"');
    expect(result).toContain("<thead>");
    expect(result).toContain("<th>Col A</th>");
    expect(result).toContain("<td>a1</td>");
  });

  test("renders markdown in table cells", () => {
    const block: Block = {
      type: "compare_table",
      headers: ["Feature"],
      rows: [["**Bold feature**"]],
    };
    const result = renderBlock(block, makeCtx());
    expect(result).toContain("<strong>Bold feature</strong>");
  });
});

// ─── RiskTable ────────────────────────────────────────────────────────────────

describe("risk_table renderer", () => {
  test("renders table.risk-table with fixed headers", () => {
    const block: Block = {
      type: "risk_table",
      rows: [
        { risk: "Data loss", likelihood: "low", impact: "high", mitigation: "Backups" },
      ],
    };
    const result = renderBlock(block, makeCtx());
    expect(result).toContain('class="risk-table"');
    expect(result).toContain("<th>Risk</th>");
    expect(result).toContain("<th>Likelihood</th>");
    expect(result).toContain("Data loss");
    expect(result).toContain('class="risk-low"');
    expect(result).toContain('class="risk-high"');
  });
});

// ─── KV ───────────────────────────────────────────────────────────────────────

describe("kv renderer", () => {
  test("renders dl.kv with dt/dd pairs", () => {
    const block: Block = { type: "kv", rows: [{ k: "Author", v: "AI" }, { k: "Date", v: "2026" }] };
    const result = renderBlock(block, makeCtx());
    expect(result).toContain('class="kv"');
    expect(result).toContain("<dt>Author</dt>");
    expect(result).toContain("<dd>AI</dd>");
  });
});

// ─── PillRow ──────────────────────────────────────────────────────────────────

describe("pill_row renderer", () => {
  test("renders div.pill-row with pill and tag spans", () => {
    const block: Block = {
      type: "pill_row",
      items: [
        { kind: "pill", text: "TypeScript" },
        { kind: "tag", text: "phase-2" },
      ],
    };
    const result = renderBlock(block, makeCtx());
    expect(result).toContain('class="pill-row"');
    expect(result).toContain('<span class="pill">TypeScript</span>');
    expect(result).toContain('<span class="tag">phase-2</span>');
  });
});

// ─── Divider ──────────────────────────────────────────────────────────────────

describe("divider renderer", () => {
  test("renders bare hr when no label", () => {
    const block: Block = { type: "divider" };
    const result = renderBlock(block, makeCtx());
    expect(result).toBe("<hr>");
  });

  test("renders hr with data-label when label provided", () => {
    const block: Block = { type: "divider", label: "End of Section" };
    const result = renderBlock(block, makeCtx());
    expect(result).toContain('data-label="End of Section"');
  });
});

// ─── Diagram ──────────────────────────────────────────────────────────────────

describe("diagram renderer", () => {
  test("renders figure.diagram with svg content", () => {
    const block: Block = {
      type: "diagram",
      svg: '<svg viewBox="0 0 100 50"><circle cx="50" cy="25" r="20"/></svg>',
      caption: "A circle",
    };
    const result = renderBlock(block, makeCtx());
    expect(result).toContain('class="diagram"');
    expect(result).toContain("<figcaption>A circle</figcaption>");
    expect(result).toContain("<circle");
  });

  test("renders figure.diagram with html content", () => {
    const block: Block = {
      type: "diagram",
      html: "<div class='custom-chart'>Data</div>",
    };
    const result = renderBlock(block, makeCtx());
    expect(result).toContain('class="diagram"');
    expect(result).toContain("Data");
  });

  test("scrubs external resources from diagram payload", () => {
    const block: Block = {
      type: "diagram",
      html: '<div><img src="https://evil.com/tracker.gif">safe</div>',
    };
    const result = renderBlock(block, makeCtx());
    // External img tag is replaced with a comment — the live element is gone
    // The comment documents the removal (contains URL as text inside the comment)
    expect(result).toContain("<!-- cesium: removed external");
    // Content after the removed element is preserved
    expect(result).toContain("safe");
    // Rendered inside figure.diagram wrapper
    expect(result).toContain('class="diagram"');
  });
});

// ─── RawHtml ──────────────────────────────────────────────────────────────────

describe("raw_html renderer", () => {
  test("renders raw html payload (scrubbed)", () => {
    const block: Block = { type: "raw_html", html: "<p>Custom content</p>" };
    const result = renderBlock(block, makeCtx());
    expect(result).toContain("<p>Custom content</p>");
  });

  test("scrubs external resources from raw_html payload", () => {
    const block: Block = {
      type: "raw_html",
      html: '<script src="https://evil.com/bad.js"></script><p>safe</p>',
    };
    const result = renderBlock(block, makeCtx());
    // External script is replaced with a comment — the live tag is removed
    // The comment documents the removal (URL appears as text in the comment message)
    expect(result).toContain("<!-- cesium: removed external");
    expect(result).toContain("safe");
  });
});

// ─── renderBlocks integration ─────────────────────────────────────────────────

describe("renderBlocks", () => {
  test("concatenates multiple blocks with newlines", () => {
    const blocks: Block[] = [
      { type: "prose", markdown: "First" },
      { type: "prose", markdown: "Second" },
    ];
    const result = renderBlocks(blocks);
    expect(result).toContain("First");
    expect(result).toContain("Second");
  });

  test("full document structure: hero + tldr + section + prose + callout + code + table", () => {
    const blocks: Block[] = [
      {
        type: "hero",
        eyebrow: "Report",
        title: "Phase 2 Summary",
        subtitle: "Structured blocks",
      },
      { type: "tldr", markdown: "**Done:** blocks mode is live." },
      {
        type: "section",
        title: "Overview",
        children: [
          { type: "prose", markdown: "Block mode is now available." },
          { type: "callout", variant: "warn", title: "Migration", markdown: "Update usage." },
        ],
      },
      { type: "code", lang: "typescript", code: 'const x = "hello";' },
      {
        type: "compare_table",
        headers: ["Mode", "Tokens"],
        rows: [["html", "high"], ["blocks", "low"]],
      },
    ];
    const result = renderBlocks(blocks);

    expect(result).toContain('<h1 class="h-display">Phase 2 Summary</h1>');
    expect(result).toContain('<aside class="tldr">');
    expect(result).toContain('<section>');
    expect(result).toContain('<aside class="callout warn">');
    expect(result).toContain('<figure class="code">');
    expect(result).toContain('<table class="compare-table">');
  });
});
