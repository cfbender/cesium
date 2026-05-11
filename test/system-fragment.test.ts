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

test("system-fragment.md contains word-count threshold language", () => {
  const content = readFragment();
  // The spec says to check for "400 words" or similar threshold language
  expect(content).toMatch(/400\s*words/i);
});

test("system-fragment.md references .eyebrow class", () => {
  const content = readFragment();
  expect(content).toContain(".eyebrow");
});

test("system-fragment.md references .h-display class", () => {
  const content = readFragment();
  expect(content).toContain(".h-display");
});

test("system-fragment.md references .tldr class", () => {
  const content = readFragment();
  expect(content).toContain(".tldr");
});

test("system-fragment.md character count is under 4000 (token-budget proxy)", () => {
  const content = readFragment();
  expect(content.length).toBeLessThan(4000);
});
