// Tests for diff block validation.
// test/validate-diff.test.ts

import { describe, test, expect } from "bun:test";
import { validatePublishInput } from "../src/render/validate.ts";

function validateBlocks(blocks: unknown) {
  return validatePublishInput({ title: "Test", kind: "plan", blocks });
}

// ─── XOR enforcement ─────────────────────────────────────────────────────────

describe("diff block XOR validation", () => {
  test("patch + before → rejected", () => {
    const r = validateBlocks([
      {
        type: "diff",
        patch: "@@ -1 +1 @@\n-old\n+new",
        before: "old",
      },
    ]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("exactly one");
  });

  test("patch + after → rejected", () => {
    const r = validateBlocks([
      {
        type: "diff",
        patch: "@@ -1 +1 @@\n-old\n+new",
        after: "new",
      },
    ]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("exactly one");
  });

  test("only before (missing after) → rejected", () => {
    const r = validateBlocks([
      {
        type: "diff",
        before: "old content",
      },
    ]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("both fields");
  });

  test("only after (missing before) → rejected", () => {
    const r = validateBlocks([
      {
        type: "diff",
        after: "new content",
      },
    ]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("both fields");
  });

  test("no patch, no before, no after → rejected", () => {
    const r = validateBlocks([
      {
        type: "diff",
        lang: "typescript",
      },
    ]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("requires either patch");
  });

  test("empty patch → rejected", () => {
    const r = validateBlocks([
      {
        type: "diff",
        patch: "   ",
      },
    ]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("non-empty");
  });

  test("valid patch alone → accepted", () => {
    const r = validateBlocks([
      {
        type: "diff",
        patch: "@@ -1,1 +1,1 @@\n-old\n+new",
      },
    ]);
    expect(r.ok).toBe(true);
  });

  test("valid before+after → accepted", () => {
    const r = validateBlocks([
      {
        type: "diff",
        before: "old content",
        after: "new content",
      },
    ]);
    expect(r.ok).toBe(true);
  });

  test("before+after with optional fields → accepted", () => {
    const r = validateBlocks([
      {
        type: "diff",
        before: "old",
        after: "new",
        lang: "typescript",
        filename: "src/index.ts",
        caption: "Refactored",
      },
    ]);
    expect(r.ok).toBe(true);
  });

  test("empty string patch is rejected", () => {
    const r = validateBlocks([
      {
        type: "diff",
        patch: "",
      },
    ]);
    expect(r.ok).toBe(false);
  });
});
