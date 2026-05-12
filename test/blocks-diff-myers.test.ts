// Tests for the Myers O(ND) line-level diff algorithm.
// test/blocks-diff-myers.test.ts

import { describe, test, expect } from "bun:test";
import { diffLines } from "../src/render/blocks/diff/myers.ts";
import type { DiffLine } from "../src/render/blocks/diff/parse-unified.ts";

// ─── Identical input ──────────────────────────────────────────────────────────

describe("identical input", () => {
  test("all entries are context", () => {
    const result = diffLines("a\nb\nc", "a\nb\nc");
    expect(result.every((e) => e.kind === "context")).toBe(true);
  });

  test("line count matches input", () => {
    const result = diffLines("a\nb\nc", "a\nb\nc");
    expect(result).toHaveLength(3);
  });

  test("beforeLineNum and afterLineNum match on both sides (1-indexed)", () => {
    const result = diffLines("x\ny", "x\ny");
    expect(result[0]?.beforeLineNum).toBe(1);
    expect(result[0]?.afterLineNum).toBe(1);
    expect(result[1]?.beforeLineNum).toBe(2);
    expect(result[1]?.afterLineNum).toBe(2);
  });
});

// ─── Pure addition ────────────────────────────────────────────────────────────

describe("pure addition (empty before)", () => {
  test("all entries are add", () => {
    const result = diffLines("", "a\nb\nc");
    expect(result.every((e) => e.kind === "add")).toBe(true);
  });

  test("line count equals after-side lines", () => {
    const result = diffLines("", "a\nb\nc");
    expect(result).toHaveLength(3);
  });

  test("beforeLineNum is null for all add entries", () => {
    const result = diffLines("", "a\nb");
    expect(result.every((e) => e.beforeLineNum === null)).toBe(true);
  });

  test("afterLineNum is 1-indexed sequentially", () => {
    const result = diffLines("", "x\ny\nz");
    const afterNums = result.map((e) => e.afterLineNum);
    expect(afterNums).toEqual([1, 2, 3]);
  });
});

// ─── Pure deletion ────────────────────────────────────────────────────────────

describe("pure deletion (empty after)", () => {
  test("all entries are remove", () => {
    const result = diffLines("a\nb\nc", "");
    expect(result.every((e) => e.kind === "remove")).toBe(true);
  });

  test("line count equals before-side lines", () => {
    const result = diffLines("a\nb\nc", "");
    expect(result).toHaveLength(3);
  });

  test("afterLineNum is null for all remove entries", () => {
    const result = diffLines("a\nb", "");
    expect(result.every((e) => e.afterLineNum === null)).toBe(true);
  });

  test("beforeLineNum is 1-indexed sequentially", () => {
    const result = diffLines("x\ny\nz", "");
    const beforeNums = result.map((e) => e.beforeLineNum);
    expect(beforeNums).toEqual([1, 2, 3]);
  });
});

// ─── Substitution (1-line replace) ────────────────────────────────────────────

describe("substitution (single-line replace)", () => {
  test("produces one remove and one add", () => {
    const result = diffLines("old", "new");
    const removes = result.filter((e) => e.kind === "remove");
    const adds = result.filter((e) => e.kind === "add");
    expect(removes).toHaveLength(1);
    expect(adds).toHaveLength(1);
  });

  test("remove has correct text", () => {
    const result = diffLines("old", "new");
    const rem = result.find((e) => e.kind === "remove") as DiffLine;
    expect(rem.text).toBe("old");
  });

  test("add has correct text", () => {
    const result = diffLines("old", "new");
    const add = result.find((e) => e.kind === "add") as DiffLine;
    expect(add.text).toBe("new");
  });
});

// ─── Multi-line block replace ──────────────────────────────────────────────────

describe("multi-line block replace", () => {
  const before = "a\nb\nc";
  const after = "a\nx\ny\nc";

  test("first and last lines are context", () => {
    const result = diffLines(before, after);
    const contexts = result.filter((e) => e.kind === "context");
    expect(contexts.some((e) => e.text === "a")).toBe(true);
    expect(contexts.some((e) => e.text === "c")).toBe(true);
  });

  test("b is removed", () => {
    const result = diffLines(before, after);
    const rem = result.filter((e) => e.kind === "remove");
    expect(rem.some((e) => e.text === "b")).toBe(true);
  });

  test("x and y are added", () => {
    const result = diffLines(before, after);
    const adds = result.filter((e) => e.kind === "add");
    expect(adds.some((e) => e.text === "x")).toBe(true);
    expect(adds.some((e) => e.text === "y")).toBe(true);
  });
});

// ─── Insertion in middle preserves line numbers ───────────────────────────────

describe("insertion in middle — before-line-numbers preserved", () => {
  const before = "line1\nline2\nline3";
  const after = "line1\nnew\nline2\nline3";

  test("context lines have consecutive beforeLineNum 1, 2, 3", () => {
    const result = diffLines(before, after);
    const contexts = result.filter((e) => e.kind === "context");
    const beforeNums = contexts.map((e) => e.beforeLineNum).filter((n) => n !== null);
    expect(beforeNums).toEqual([1, 2, 3]);
  });

  test("added line has null beforeLineNum", () => {
    const result = diffLines(before, after);
    const add = result.find((e) => e.kind === "add") as DiffLine;
    expect(add).toBeDefined();
    expect(add.beforeLineNum).toBeNull();
    expect(add.text).toBe("new");
  });

  test("added line has afterLineNum 2 (second line in after)", () => {
    const result = diffLines(before, after);
    const add = result.find((e) => e.kind === "add") as DiffLine;
    expect(add.afterLineNum).toBe(2);
  });
});

// ─── Trailing-newline trimming ────────────────────────────────────────────────

describe("trailing newline trimming", () => {
  test("input ending in \\n does not produce phantom empty line", () => {
    const result = diffLines("a\nb\n", "a\nb\n");
    expect(result).toHaveLength(2);
  });

  test("both-sides with trailing newline → all context, 2 lines", () => {
    const result = diffLines("x\n", "x\n");
    expect(result).toHaveLength(1);
    expect(result[0]?.kind).toBe("context");
  });
});

// ─── Empty both sides ─────────────────────────────────────────────────────────

describe("empty both sides", () => {
  test("returns empty array", () => {
    expect(diffLines("", "")).toHaveLength(0);
  });
});
