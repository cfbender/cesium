// Tests for block catalog — every entry has meta, renders without throwing.
// test/blocks-catalog.test.ts

import { test, expect } from "bun:test";
import { blockCatalog, blockTypes } from "../src/render/blocks/catalog.ts";
import { renderBlock } from "../src/render/blocks/render.ts";
import type { RenderCtx, SectionCounter } from "../src/render/blocks/render.ts";
import type { Block } from "../src/render/blocks/types.ts";

function makeCtx(path = "blocks[0]"): RenderCtx {
  const counter: SectionCounter = { value: 1 };
  return { sectionCounter: counter, depth: 0, path };
}

test("every block type has a catalog entry", () => {
  expect(blockTypes).toHaveLength(15);
  for (const t of blockTypes) {
    expect(blockCatalog[t]).toBeDefined();
  }
});

test("every example block renders without throwing", async () => {
  const entries = Object.entries(blockCatalog);
  const results = await Promise.all(
    entries.map(([_type, entry]) => {
      const ctx = makeCtx(`blocks[0]`);
      return renderBlock(entry.example, ctx);
    }),
  );
  for (const result of results) {
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  }
});

test("every example block type matches catalog key", () => {
  for (const [type, entry] of Object.entries(blockCatalog) as Array<[Block["type"], (typeof blockCatalog)[Block["type"]]]>) {
    expect(entry.example.type).toBe(type);
  }
});

test("rendered examples from hero renderer contain h1.h-display", async () => {
  const ctx = makeCtx();
  const result = await renderBlock(blockCatalog["hero"].example, ctx);
  expect(result).toContain('class="h-display"');
  expect(result).toContain("<h1");
});

test("rendered examples from section renderer contain h2.h-section and section-num", async () => {
  const ctx = makeCtx();
  const result = await renderBlock(blockCatalog["section"].example, ctx);
  expect(result).toContain('class="h-section"');
  expect(result).toContain('class="section-num"');
  expect(result).toContain("<section");
});

test("rendered examples from callout renderer contain aside.callout", async () => {
  const ctx = makeCtx();
  const result = await renderBlock(blockCatalog["callout"].example, ctx);
  expect(result).toContain('class="callout');
  expect(result).toContain("<aside");
});

test("rendered examples from code renderer contain figure.code and pre", async () => {
  const ctx = makeCtx();
  const result = await renderBlock(blockCatalog["code"].example, ctx);
  expect(result).toContain('class="code"');
  expect(result).toContain("<pre>");
  expect(result).toContain("<code");
});

test("rendered examples from tldr renderer contain aside.tldr", async () => {
  const ctx = makeCtx();
  const result = await renderBlock(blockCatalog["tldr"].example, ctx);
  expect(result).toContain('class="tldr"');
});

test("rendered examples from compare_table renderer contain table.compare-table", async () => {
  const ctx = makeCtx();
  const result = await renderBlock(blockCatalog["compare_table"].example, ctx);
  expect(result).toContain('class="compare-table"');
  expect(result).toContain("<table");
  expect(result).toContain("<thead");
});

test("rendered examples from risk_table renderer contain table.risk-table", async () => {
  const ctx = makeCtx();
  const result = await renderBlock(blockCatalog["risk_table"].example, ctx);
  expect(result).toContain('class="risk-table"');
});

test("rendered examples from timeline renderer contain ul.timeline", async () => {
  const ctx = makeCtx();
  const result = await renderBlock(blockCatalog["timeline"].example, ctx);
  expect(result).toContain('class="timeline"');
});

test("rendered examples from kv renderer contain dl.kv", async () => {
  const ctx = makeCtx();
  const result = await renderBlock(blockCatalog["kv"].example, ctx);
  expect(result).toContain('class="kv"');
  expect(result).toContain("<dl");
  expect(result).toContain("<dt");
});

test("rendered examples from pill_row renderer contain div.pill-row", async () => {
  const ctx = makeCtx();
  const result = await renderBlock(blockCatalog["pill_row"].example, ctx);
  expect(result).toContain('class="pill-row"');
});

test("rendered examples from divider renderer contain hr", async () => {
  const ctx = makeCtx();
  const result = await renderBlock(blockCatalog["divider"].example, ctx);
  expect(result).toContain("<hr");
});

test("rendered examples from diagram renderer contain figure.diagram", async () => {
  const ctx = makeCtx();
  const result = await renderBlock(blockCatalog["diagram"].example, ctx);
  expect(result).toContain('class="diagram"');
  expect(result).toContain("<figure");
});

test("rendered examples from raw_html renderer render without wrapper", async () => {
  const ctx = makeCtx();
  const result = await renderBlock(blockCatalog["raw_html"].example, ctx);
  expect(typeof result).toBe("string");
  expect(result.length).toBeGreaterThan(0);
});
