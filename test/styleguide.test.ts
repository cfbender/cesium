import { test, expect } from "bun:test";
import * as parse5 from "parse5";
import { createStyleguideTool } from "../src/tools/styleguide.ts";

const FAKE_CTX = {} as Parameters<typeof createStyleguideTool>[0];

async function getStyleguideOutput(): Promise<string> {
  const t = createStyleguideTool(FAKE_CTX);
  const result = await t.execute({}, {} as never);
  if (typeof result !== "string") throw new Error("expected string from styleguide tool");
  return result;
}

test("styleguide returns non-empty string starting with <!doctype html>", async () => {
  const output = await getStyleguideOutput();
  expect(output.length).toBeGreaterThan(0);
  expect(output.toLowerCase().trimStart()).toMatch(/^<!doctype html>/);
});

test("styleguide contains .eyebrow class usage", async () => {
  const output = await getStyleguideOutput();
  expect(output).toContain("eyebrow");
});

test("styleguide contains .h-display class usage", async () => {
  const output = await getStyleguideOutput();
  expect(output).toContain("h-display");
});

test("styleguide contains .h-section class usage", async () => {
  const output = await getStyleguideOutput();
  expect(output).toContain("h-section");
});

test("styleguide contains .section-num class usage", async () => {
  const output = await getStyleguideOutput();
  expect(output).toContain("section-num");
});

test("styleguide contains .card class usage", async () => {
  const output = await getStyleguideOutput();
  expect(output).toContain("card");
});

test("styleguide contains .tldr class usage", async () => {
  const output = await getStyleguideOutput();
  expect(output).toContain("tldr");
});

test("styleguide contains .callout class usage", async () => {
  const output = await getStyleguideOutput();
  expect(output).toContain("callout");
});

test("styleguide contains .code class usage", async () => {
  const output = await getStyleguideOutput();
  expect(output).toContain('"code"');
});

test("styleguide contains .timeline class usage", async () => {
  const output = await getStyleguideOutput();
  expect(output).toContain("timeline");
});

test("styleguide contains .diagram class usage", async () => {
  const output = await getStyleguideOutput();
  expect(output).toContain("diagram");
});

test("styleguide contains .compare-table class usage", async () => {
  const output = await getStyleguideOutput();
  expect(output).toContain("compare-table");
});

test("styleguide contains .risk-table class usage", async () => {
  const output = await getStyleguideOutput();
  expect(output).toContain("risk-table");
});

test("styleguide contains .kbd class usage", async () => {
  const output = await getStyleguideOutput();
  expect(output).toContain("kbd");
});

test("styleguide contains .pill class usage", async () => {
  const output = await getStyleguideOutput();
  expect(output).toContain("pill");
});

test("styleguide contains .tag class usage", async () => {
  const output = await getStyleguideOutput();
  expect(output).toContain('"tag"');
});

test("styleguide contains .byline class usage", async () => {
  const output = await getStyleguideOutput();
  expect(output).toContain("byline");
});

test("styleguide output is parseable by parse5", async () => {
  const output = await getStyleguideOutput();
  expect(() => parse5.parse(output)).not.toThrow();
});

test("styleguide output contains :root { (design tokens inlined)", async () => {
  const output = await getStyleguideOutput();
  expect(output).toContain(":root {");
});
