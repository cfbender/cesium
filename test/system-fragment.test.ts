import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const FRAGMENT_PATH = join(import.meta.dir, "../src/prompt/system-fragment.md");

function readFragment(): string {
  return readFileSync(FRAGMENT_PATH, "utf8");
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

test("system-fragment.md character count is under 4000 (token-budget proxy)", () => {
  const content = readFragment();
  expect(content.length).toBeLessThan(4000);
});

test("system-fragment.md lists six tools", () => {
  const content = readFragment();
  expect(content).toContain("six tools");
});

test("system-fragment.md contains trigger guidance for cesium_ask + cesium_wait", () => {
  const content = readFragment();
  // The ask+wait section should mention key trigger concepts
  expect(content).toContain("cesium_ask");
  expect(content).toContain("cesium_wait");
  // Mention of interactive Q&A workflow
  expect(content).toMatch(/interactive/i);
});

test("system-fragment.md is under 4000 chars (token-budget proxy)", () => {
  const content = readFragment();
  expect(content.length).toBeLessThan(4000);
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

test("system-fragment.md mentions all 15 block types in the quick reference", () => {
  const content = readFragment();
  const blockTypes = [
    "hero", "tldr", "section", "prose", "list", "callout", "code",
    "timeline", "compare_table", "risk_table", "kv", "pill_row", "divider",
    "diagram", "raw_html",
  ];
  for (const type of blockTypes) {
    expect(content).toContain(type);
  }
});
