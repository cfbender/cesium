// Tests for block types union and catalog consistency.
// test/blocks-types.test.ts

import { test, expect } from "bun:test";
import { blockCatalog, blockTypes } from "../src/render/blocks/catalog.ts";
import type { Block } from "../src/render/blocks/types.ts";

test("blockTypes array has exactly 15 entries", () => {
  expect(blockTypes).toHaveLength(15);
});

test("blockTypes contains all expected discriminator strings", () => {
  const expected: Array<Block["type"]> = [
    "hero",
    "tldr",
    "section",
    "prose",
    "list",
    "callout",
    "code",
    "timeline",
    "compare_table",
    "risk_table",
    "kv",
    "pill_row",
    "divider",
    "diagram",
    "raw_html",
  ];
  for (const t of expected) {
    expect(blockTypes).toContain(t);
  }
});

test("blockCatalog has an entry for every block type in blockTypes", () => {
  for (const t of blockTypes) {
    expect(blockCatalog[t]).toBeDefined();
  }
});

test("every catalog entry has required fields: type, description, schema, example", () => {
  for (const [type, entry] of Object.entries(blockCatalog) as Array<[Block["type"], (typeof blockCatalog)[Block["type"]]]>) {
    expect(entry.type).toBe(type);
    expect(typeof entry.description).toBe("string");
    expect(entry.description.length).toBeGreaterThan(0);
    expect(typeof entry.schema).toBe("object");
    expect(entry.example).toBeDefined();
    expect(entry.example.type).toBe(type);
  }
});

test("blockTypes is the exact set of Block['type'] values — no extras, no gaps", () => {
  // Runtime check: all catalog keys equal blockTypes contents
  const catalogKeys = new Set(Object.keys(blockCatalog));
  const typesSet = new Set(blockTypes);

  for (const k of catalogKeys) {
    expect(typesSet.has(k as Block["type"])).toBe(true);
  }
  for (const t of typesSet) {
    expect(catalogKeys.has(t)).toBe(true);
  }
});
