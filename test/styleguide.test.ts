import { test, expect } from "bun:test";
import { createStyleguideTool, generateStyleguideMarkdown } from "../src/tools/styleguide.ts";
import { blockTypes } from "../src/render/blocks/catalog.ts";

const FAKE_CTX = {} as Parameters<typeof createStyleguideTool>[0];

async function getStyleguideOutput(): Promise<string> {
  const t = createStyleguideTool(FAKE_CTX);
  const result = await t.execute({}, {} as never);
  if (typeof result !== "string") throw new Error("expected string from styleguide tool");
  return result;
}

// ---------------------------------------------------------------------------
// Output is markdown, not HTML
// ---------------------------------------------------------------------------

test("styleguide returns non-empty string", async () => {
  const output = await getStyleguideOutput();
  expect(output.length).toBeGreaterThan(0);
});

test("styleguide output is markdown (not HTML — no <!doctype>)", async () => {
  const output = await getStyleguideOutput();
  expect(output.toLowerCase().trimStart()).not.toMatch(/^<!doctype html>/);
});

test("styleguide output does not contain <style> tags", async () => {
  const output = await getStyleguideOutput();
  expect(output).not.toContain("<style>");
});

test("styleguide output does not contain :root { (no inlined CSS tokens)", async () => {
  const output = await getStyleguideOutput();
  expect(output).not.toContain(":root {");
});

// ---------------------------------------------------------------------------
// Preamble
// ---------------------------------------------------------------------------

test("styleguide contains 'Two input modes' preamble", async () => {
  const output = await getStyleguideOutput();
  expect(output).toContain("Two input modes");
});

test("styleguide preamble mentions blocks preferred", async () => {
  const output = await getStyleguideOutput();
  expect(output).toContain("blocks");
  expect(output).toContain("preferred");
});

test("styleguide preamble mentions html escape valve", async () => {
  const output = await getStyleguideOutput();
  expect(output).toContain("escape valve");
});

// ---------------------------------------------------------------------------
// Block reference — all 15 block types present
// ---------------------------------------------------------------------------

test("styleguide mentions every block type discriminator string", async () => {
  const output = await getStyleguideOutput();
  for (const type of blockTypes) {
    expect(output).toContain(`\`${type}\``);
  }
});

test("styleguide has a section heading for each block type", async () => {
  const output = await getStyleguideOutput();
  for (const type of blockTypes) {
    expect(output).toContain(`### \`${type}\``);
  }
});

test("styleguide mentions hero block", async () => {
  const output = await getStyleguideOutput();
  expect(output).toContain("hero");
});

test("styleguide mentions tldr block", async () => {
  const output = await getStyleguideOutput();
  expect(output).toContain("tldr");
});

test("styleguide mentions section block", async () => {
  const output = await getStyleguideOutput();
  expect(output).toContain("section");
});

test("styleguide mentions callout block", async () => {
  const output = await getStyleguideOutput();
  expect(output).toContain("callout");
});

test("styleguide mentions code block", async () => {
  const output = await getStyleguideOutput();
  expect(output).toContain("code");
});

test("styleguide mentions compare_table block", async () => {
  const output = await getStyleguideOutput();
  expect(output).toContain("compare_table");
});

test("styleguide mentions risk_table block", async () => {
  const output = await getStyleguideOutput();
  expect(output).toContain("risk_table");
});

test("styleguide mentions raw_html block", async () => {
  const output = await getStyleguideOutput();
  expect(output).toContain("raw_html");
});

test("styleguide mentions diagram block", async () => {
  const output = await getStyleguideOutput();
  expect(output).toContain("diagram");
});

// ---------------------------------------------------------------------------
// Markdown subset section
// ---------------------------------------------------------------------------

test("styleguide contains the markdown subset section", async () => {
  const output = await getStyleguideOutput();
  expect(output).toContain("Markdown subset");
});

test("styleguide markdown subset mentions bold syntax", async () => {
  const output = await getStyleguideOutput();
  expect(output).toContain("**bold**");
});

test("styleguide markdown subset mentions italic syntax", async () => {
  const output = await getStyleguideOutput();
  expect(output).toContain("*italic*");
});

test("styleguide markdown subset mentions kbd safelist element", async () => {
  const output = await getStyleguideOutput();
  expect(output).toContain("kbd");
});

test("styleguide markdown subset mentions pill safelist class", async () => {
  const output = await getStyleguideOutput();
  expect(output).toContain("pill");
});

// ---------------------------------------------------------------------------
// When to reach for raw_html / diagram section
// ---------------------------------------------------------------------------

test("styleguide contains 'raw_html / diagram' section", async () => {
  const output = await getStyleguideOutput();
  expect(output).toContain("raw_html / diagram");
});

test("styleguide mentions raw_html overuse threshold", async () => {
  const output = await getStyleguideOutput();
  expect(output).toContain("30%");
});

// ---------------------------------------------------------------------------
// Rendered examples present
// ---------------------------------------------------------------------------

test("styleguide contains rendered HTML examples (fenced html blocks)", async () => {
  const output = await getStyleguideOutput();
  expect(output).toContain("```html");
});

test("styleguide contains JSON examples (fenced json blocks)", async () => {
  const output = await getStyleguideOutput();
  expect(output).toContain("```json");
});

// ---------------------------------------------------------------------------
// Determinism
// ---------------------------------------------------------------------------

test("generateStyleguideMarkdown is deterministic", () => {
  const a = generateStyleguideMarkdown();
  const b = generateStyleguideMarkdown();
  expect(a).toBe(b);
});
