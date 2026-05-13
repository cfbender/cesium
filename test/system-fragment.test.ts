import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { generateBlockFieldReference } from "../src/prompt/field-reference.ts";

const FRAGMENT_PATH = join(import.meta.dir, "../src/prompt/system-fragment.md");

function readFragment(): string {
  return readFileSync(FRAGMENT_PATH, "utf8");
}

/** Returns the fragment as the agent sees it — with placeholder replaced. */
function readRenderedFragment(): string {
  const raw = readFragment();
  return raw.replace("{{BLOCK_FIELD_REFERENCE}}", generateBlockFieldReference());
}

test("system-fragment.md is non-empty", () => {
  const content = readFragment();
  expect(content.trim().length).toBeGreaterThan(0);
});

test("system-fragment.md references cesium_publish", () => {
  const content = readFragment();
  expect(content).toContain("cesium_publish");
});

test("system-fragment.md references cesium_styleguide", () => {
  const content = readFragment();
  expect(content).toContain("cesium_styleguide");
});

test("system-fragment.md references cesium_ask", () => {
  const content = readFragment();
  expect(content).toContain("cesium_ask");
});

test("system-fragment.md references cesium_wait", () => {
  const content = readFragment();
  expect(content).toContain("cesium_wait");
});

test("system-fragment.md contains word-count threshold language", () => {
  const content = readFragment();
  // The spec says to check for "400 words" or similar threshold language
  expect(content).toMatch(/400\s*words/i);
});

test("system-fragment.md references blocks (preferred input mode)", () => {
  const content = readFragment();
  expect(content).toContain("blocks");
  expect(content).toContain("preferred");
});

test("system-fragment.md references html escape valve", () => {
  const content = readFragment();
  expect(content).toContain("html");
  expect(content).toContain("escape valve");
});

test("system-fragment.md references tldr block type", () => {
  const content = readFragment();
  expect(content).toContain("tldr");
});

test("system-fragment.md raw file character count is under 12000 (raw file budget)", () => {
  // The raw file contains a placeholder {{BLOCK_FIELD_REFERENCE}} that gets replaced at runtime.
  // The raw file itself is a template — check that it stays compact (< 12000 chars).
  const content = readFragment();
  expect(content.length).toBeLessThan(12000);
});

test("system-fragment.md lists seven tools", () => {
  const content = readFragment();
  expect(content).toContain("seven tools");
});

test("system-fragment.md contains trigger guidance for cesium_ask + cesium_wait", () => {
  const content = readFragment();
  // The ask+wait section should mention key trigger concepts
  expect(content).toContain("cesium_ask");
  expect(content).toContain("cesium_wait");
  // Mention of interactive Q&A workflow
  expect(content).toMatch(/interactive/i);
});

test("system-fragment.md mentions optional on ask_text", () => {
  const content = readFragment();
  expect(content).toContain("optional");
  expect(content).toContain("ask_text");
});

// New tests for blocks-first content

test("system-fragment.md has a block JSON example", () => {
  const content = readFragment();
  expect(content).toContain('"blocks"');
  expect(content).toContain('"type"');
});

test("system-fragment.md mentions cesium_critique mode detection", () => {
  const content = readFragment();
  expect(content).toContain("cesium_critique");
});

test("system-fragment.md mentions when to use raw_html and diagram", () => {
  const content = readFragment();
  expect(content).toContain("raw_html");
  expect(content).toContain("diagram");
});

test("system-fragment.md mentions all 16 block types in the quick reference", () => {
  const content = readFragment();
  const blockTypes = [
    "hero",
    "tldr",
    "section",
    "prose",
    "list",
    "callout",
    "code",
    "diff",
    "timeline",
    "compare_table",
    "risk_table",
    "kv",
    "pill_row",
    "divider",
    "diagram",
    "raw_html",
  ];
  for (const type of blockTypes) {
    expect(content).toContain(type);
  }
});

// ─── Rendered fragment tests (after placeholder replacement) ──────────────────

test("rendered fragment contains k/v field names for hero meta", () => {
  const content = readRenderedFragment();
  expect(content).toContain("k");
  expect(content).toContain("v");
  // More specific: should appear as field names in a meta context
  expect(content).toMatch(/meta.*k.*v|k.*v.*meta/s);
});

test("rendered fragment contains label and text for timeline items", () => {
  const content = readRenderedFragment();
  expect(content).toMatch(/timeline.*label.*text|label.*text.*timeline/s);
});

test("rendered fragment lists low/medium/high for risk_table likelihood and impact", () => {
  const content = readRenderedFragment();
  expect(content).toContain("low");
  expect(content).toContain("medium");
  expect(content).toContain("high");
  // Should appear near risk_table context
  expect(content).toMatch(/risk_table[\s\S]*low[\s\S]*medium[\s\S]*high/);
});

test("rendered fragment contains all 16 block types in field reference", () => {
  const content = readRenderedFragment();
  const blockTypes = [
    "hero",
    "tldr",
    "section",
    "prose",
    "list",
    "callout",
    "code",
    "diff",
    "timeline",
    "compare_table",
    "risk_table",
    "kv",
    "pill_row",
    "divider",
    "diagram",
    "raw_html",
  ];
  for (const type of blockTypes) {
    expect(content).toContain(type);
  }
});

test("field reference generator covers all catalog entries", () => {
  const { blockCatalog } = require("../src/render/blocks/catalog.ts") as {
    blockCatalog: Record<string, unknown>;
  };
  const catalogCount = Object.keys(blockCatalog).length;
  expect(catalogCount).toBe(16);

  const reference = generateBlockFieldReference();
  const blockTypes = [
    "hero",
    "tldr",
    "section",
    "prose",
    "list",
    "callout",
    "code",
    "diff",
    "timeline",
    "compare_table",
    "risk_table",
    "kv",
    "pill_row",
    "divider",
    "diagram",
    "raw_html",
  ];
  for (const type of blockTypes) {
    expect(reference).toContain(`\`${type}\``);
  }
});

test("rendered fragment contains hero with meta k/v in example JSON", () => {
  const content = readRenderedFragment();
  // The updated example should contain meta with k/v fields
  expect(content).toContain('"k"');
  expect(content).toContain('"v"');
  // And the risk_table and timeline examples
  expect(content).toContain('"risk_table"');
  expect(content).toContain('"timeline"');
  expect(content).toContain('"label"');
  expect(content).toContain('"text"');
});

// ─── cesium_annotate tool documentation tests ─────────────────────────────────

test("system-fragment.md references cesium_annotate", () => {
  const content = readFragment();
  expect(content).toContain("cesium_annotate");
});

test("system-fragment.md contains '## Choosing between' section header", () => {
  const content = readFragment();
  expect(content).toContain("## Choosing between cesium_publish, cesium_ask, and cesium_annotate");
});

test("system-fragment.md contains '## Reviewing content with cesium_annotate' section header", () => {
  const content = readFragment();
  expect(content).toContain("## Reviewing content with cesium_annotate + cesium_wait");
});

test("system-fragment.md contains diff routing-rule line", () => {
  const content = readFragment();
  expect(content).toContain("Here's a diff — does it look right?");
  expect(content).toContain("cesium_annotate");
});

test("system-fragment.md contains all three verdict values", () => {
  const content = readFragment();
  expect(content).toContain("approve");
  expect(content).toContain("request_changes");
  expect(content).toContain("comment");
});
