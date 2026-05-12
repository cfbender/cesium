// Tests for the unified diff parser.
// test/blocks-diff-parse.test.ts

import { describe, test, expect } from "bun:test";
import { parseUnifiedDiff } from "../src/render/blocks/diff/parse-unified.ts";
import type { DiffEntry, DiffLine } from "../src/render/blocks/diff/parse-unified.ts";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function lines(entries: DiffEntry[]): DiffLine[] {
  return entries.filter((e): e is DiffLine => e.kind !== "hunk-sep");
}

function seps(entries: DiffEntry[]) {
  return entries.filter((e) => e.kind === "hunk-sep");
}

function parsed(patch: string): DiffEntry[] {
  const r = parseUnifiedDiff(patch);
  if (r === null) throw new Error("parseUnifiedDiff returned null");
  return r;
}

// ─── Single hunk ──────────────────────────────────────────────────────────────

describe("single hunk — mixed context/add/remove", () => {
  const patch = [
    "@@ -1,4 +1,4 @@",
    " context line 1",
    "-removed line",
    "+added line",
    " context line 2",
  ].join("\n");

  test("returns non-null result", () => {
    expect(parseUnifiedDiff(patch)).not.toBeNull();
  });

  test("produces 4 entries (context, remove, add, context)", () => {
    expect(parsed(patch)).toHaveLength(4);
  });

  test("first entry is context", () => {
    const result = parsed(patch);
    expect(result[0]?.kind).toBe("context");
    expect((result[0] as DiffLine).text).toBe("context line 1");
  });

  test("second entry is remove", () => {
    const result = parsed(patch);
    expect(result[1]?.kind).toBe("remove");
    expect((result[1] as DiffLine).text).toBe("removed line");
  });

  test("third entry is add", () => {
    const result = parsed(patch);
    expect(result[2]?.kind).toBe("add");
    expect((result[2] as DiffLine).text).toBe("added line");
  });

  test("last entry is context", () => {
    const result = parsed(patch);
    expect(result[3]?.kind).toBe("context");
    expect((result[3] as DiffLine).text).toBe("context line 2");
  });
});

// ─── Line numbers ─────────────────────────────────────────────────────────────

describe("line number tracking", () => {
  const patch = ["@@ -10,3 +10,3 @@", " ctx", "-rem", "+add"].join("\n");

  test("context line gets correct beforeLineNum and afterLineNum", () => {
    const result = parsed(patch);
    const ctx = result[0] as DiffLine;
    expect(ctx.beforeLineNum).toBe(10);
    expect(ctx.afterLineNum).toBe(10);
  });

  test("remove line gets beforeLineNum, null afterLineNum", () => {
    const result = parsed(patch);
    const rem = result[1] as DiffLine;
    expect(rem.beforeLineNum).toBe(11);
    expect(rem.afterLineNum).toBeNull();
  });

  test("add line gets null beforeLineNum, correct afterLineNum", () => {
    const result = parsed(patch);
    const add = result[2] as DiffLine;
    expect(add.beforeLineNum).toBeNull();
    expect(add.afterLineNum).toBe(11);
  });
});

// ─── Multiple hunks ───────────────────────────────────────────────────────────

describe("multiple hunks", () => {
  const patch = [
    "@@ -1,2 +1,2 @@",
    " ctx A",
    "-rem A",
    "@@ -10,2 +10,2 @@",
    " ctx B",
    "+add B",
  ].join("\n");

  test("returns non-null", () => {
    expect(parseUnifiedDiff(patch)).not.toBeNull();
  });

  test("emits exactly one hunk-sep between hunks", () => {
    expect(seps(parsed(patch))).toHaveLength(1);
  });

  test("hunk-sep carries correct newStart", () => {
    const result = parsed(patch);
    const sep = seps(result)[0];
    expect(sep).toBeDefined();
    if (sep === undefined) return;
    expect(sep.kind).toBe("hunk-sep");
    if (sep.kind === "hunk-sep") {
      expect(sep.newStart).toBe(10);
      expect(sep.oldStart).toBe(10);
    }
  });

  test("total non-sep entries = 4", () => {
    expect(lines(parsed(patch))).toHaveLength(4);
  });
});

// ─── Count-less hunk headers ──────────────────────────────────────────────────

describe("count-less hunk header (@@ -L +L @@)", () => {
  const patch = ["@@ -1 +1 @@", "-old", "+new"].join("\n");

  test("parses successfully (non-null)", () => {
    expect(parseUnifiedDiff(patch)).not.toBeNull();
  });

  test("produces remove and add entries", () => {
    const result = parsed(patch);
    expect(result.find((e) => e.kind === "remove")).toBeDefined();
    expect(result.find((e) => e.kind === "add")).toBeDefined();
  });
});

// ─── File header lines ────────────────────────────────────────────────────────

describe("file header lines tolerated", () => {
  const patch = [
    "--- a/src/index.ts",
    "+++ b/src/index.ts",
    "@@ -1,1 +1,1 @@",
    "-old line",
    "+new line",
  ].join("\n");

  test("parses successfully (non-null)", () => {
    expect(parseUnifiedDiff(patch)).not.toBeNull();
  });

  test("produces exactly 2 DiffLine entries", () => {
    expect(lines(parsed(patch))).toHaveLength(2);
  });
});

// ─── No-newline markers ───────────────────────────────────────────────────────

describe("\\ No newline at end of file is skipped", () => {
  const patch = [
    "@@ -1,1 +1,1 @@",
    "-old",
    "\\ No newline at end of file",
    "+new",
    "\\ No newline at end of file",
  ].join("\n");

  test("parses successfully", () => {
    expect(parseUnifiedDiff(patch)).not.toBeNull();
  });

  test("no hunk-sep in result", () => {
    expect(seps(parsed(patch))).toHaveLength(0);
  });

  test("only remove and add entries", () => {
    const result = parsed(patch);
    const ls = lines(result);
    expect(ls).toHaveLength(2);
    expect(ls[0]?.kind).toBe("remove");
    expect(ls[1]?.kind).toBe("add");
  });
});

// ─── Empty / malformed input → null ──────────────────────────────────────────

describe("empty or malformed input", () => {
  test("empty string → null", () => {
    expect(parseUnifiedDiff("")).toBeNull();
  });

  test("whitespace-only string → null", () => {
    expect(parseUnifiedDiff("   \n\n  ")).toBeNull();
  });

  test("no hunk header → null", () => {
    expect(parseUnifiedDiff("--- a/file\n+++ b/file\n-line")).toBeNull();
  });

  test("plain text → null", () => {
    expect(parseUnifiedDiff("hello world")).toBeNull();
  });
});
