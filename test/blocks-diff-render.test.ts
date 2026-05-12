// Tests for the diff block renderer.
// test/blocks-diff-render.test.ts

import { describe, test, expect } from "bun:test";
import { renderBlock } from "../src/render/blocks/render.ts";
import type { RenderCtx, SectionCounter } from "../src/render/blocks/render.ts";
import type { Block } from "../src/render/blocks/types.ts";

function makeCtx(path = "blocks[0]"): RenderCtx {
  const counter: SectionCounter = { value: 1 };
  return { sectionCounter: counter, depth: 0, path, highlightTheme: "claret-dark" };
}

// ─── before/after arm ─────────────────────────────────────────────────────────

describe("before/after arm", () => {
  test("renders without throwing", async () => {
    const block: Block = {
      type: "diff",
      lang: "typescript",
      before: "const x = 1;\nconst y = 2;",
      after: "const x = 1;\nconst z = 3;\nconst y = 2;",
    };
    const result = await renderBlock(block, makeCtx());
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  test("output contains diff-block figure", async () => {
    const block: Block = {
      type: "diff",
      before: "a",
      after: "b",
    };
    const result = await renderBlock(block, makeCtx());
    expect(result).toContain('class="diff-block"');
    expect(result).toContain("<figure");
  });
});

// ─── patch arm ────────────────────────────────────────────────────────────────

describe("patch arm", () => {
  const validPatch = ["@@ -1,2 +1,2 @@", " context", "-removed", "+added"].join("\n");

  test("renders without throwing", async () => {
    const block: Block = { type: "diff", patch: validPatch };
    const result = await renderBlock(block, makeCtx());
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  test("output contains diff-block figure", async () => {
    const block: Block = { type: "diff", patch: validPatch };
    const result = await renderBlock(block, makeCtx());
    expect(result).toContain('class="diff-block"');
  });
});

// ─── Filename ─────────────────────────────────────────────────────────────────

describe("filename", () => {
  test("filename appears in .diff-filename span", async () => {
    const block: Block = {
      type: "diff",
      filename: "src/auth.ts",
      before: "old",
      after: "new",
    };
    const result = await renderBlock(block, makeCtx());
    expect(result).toContain('class="diff-filename"');
    expect(result).toContain("src/auth.ts");
  });

  test("HTML in filename is escaped", async () => {
    const block: Block = {
      type: "diff",
      filename: '<script>alert("xss")</script>',
      before: "a",
      after: "b",
    };
    const result = await renderBlock(block, makeCtx());
    expect(result).not.toContain("<script>");
    expect(result).toContain("&lt;script&gt;");
  });
});

// ─── Caption ──────────────────────────────────────────────────────────────────

describe("caption", () => {
  test("caption appears in figcaption", async () => {
    const block: Block = {
      type: "diff",
      caption: "This is the auth refactor",
      before: "old",
      after: "new",
    };
    const result = await renderBlock(block, makeCtx());
    expect(result).toContain("<figcaption>");
    expect(result).toContain("This is the auth refactor");
  });

  test("no figcaption when caption is omitted", async () => {
    const block: Block = {
      type: "diff",
      before: "a",
      after: "b",
    };
    const result = await renderBlock(block, makeCtx());
    expect(result).not.toContain("<figcaption>");
  });
});

// ─── SVG connector presence ────────────────────────────────────────────────────

describe("SVG connector", () => {
  test("SVG is present for a diff with at least one change", async () => {
    const block: Block = {
      type: "diff",
      before: "const x = 1;",
      after: "const x = 2;",
    };
    const result = await renderBlock(block, makeCtx());
    expect(result).toContain("<svg");
  });

  test("at least one <path class='diff-conn ...' is present for any changed diff", async () => {
    const block: Block = {
      type: "diff",
      before: "a\nb",
      after: "a\nc",
    };
    const result = await renderBlock(block, makeCtx());
    expect(result).toContain('class="diff-conn');
  });
});

// ─── Path classes by region kind ──────────────────────────────────────────────

describe("path classes", () => {
  test("pure-addition diff produces diff-conn add path", async () => {
    const block: Block = {
      type: "diff",
      before: "",
      after: "line1\nline2",
    };
    const result = await renderBlock(block, makeCtx());
    expect(result).toContain('class="diff-conn add"');
  });

  test("pure-deletion diff produces diff-conn remove path", async () => {
    const block: Block = {
      type: "diff",
      before: "line1\nline2",
      after: "",
    };
    const result = await renderBlock(block, makeCtx());
    expect(result).toContain('class="diff-conn remove"');
  });

  test("mixed diff produces diff-conn change path", async () => {
    const block: Block = {
      type: "diff",
      before: "old line",
      after: "new line",
    };
    const result = await renderBlock(block, makeCtx());
    expect(result).toContain('class="diff-conn change"');
  });
});

// ─── Stats ────────────────────────────────────────────────────────────────────

describe("stats", () => {
  test("+N count is correct", async () => {
    const block: Block = {
      type: "diff",
      before: "a\nb",
      after: "a\nb\nc\nd",
    };
    const result = await renderBlock(block, makeCtx());
    // 2 additions (c and d)
    expect(result).toContain("+2");
  });

  test("-M count is correct", async () => {
    const block: Block = {
      type: "diff",
      before: "a\nb\nc",
      after: "a",
    };
    const result = await renderBlock(block, makeCtx());
    // 2 removals (b and c)
    expect(result).toContain("-2");
  });

  test("zero counts shown when no changes", async () => {
    const block: Block = {
      type: "diff",
      before: "same",
      after: "same",
    };
    const result = await renderBlock(block, makeCtx());
    expect(result).toContain("+0");
    expect(result).toContain("-0");
  });
});

// ─── Line numbers ─────────────────────────────────────────────────────────────

describe("line numbers", () => {
  test("before side renders line numbers for context/remove lines", async () => {
    const block: Block = {
      type: "diff",
      before: "line1\nline2\nline3",
      after: "line1\nnewline\nline3",
    };
    const result = await renderBlock(block, makeCtx());
    // Before side has lines 1, 2, 3
    expect(result).toContain(">1<");
    expect(result).toContain(">2<");
    expect(result).toContain(">3<");
  });

  test("diff-line.remove and diff-line.add classes present", async () => {
    const block: Block = {
      type: "diff",
      before: "old",
      after: "new",
    };
    const result = await renderBlock(block, makeCtx());
    expect(result).toContain('class="diff-line remove"');
    expect(result).toContain('class="diff-line add"');
  });
});

// ─── Malformed patch fallback ─────────────────────────────────────────────────

describe("malformed patch fallback", () => {
  test("malformed patch falls back to .diff-block.fallback", async () => {
    const block: Block = {
      type: "diff",
      patch: "this is not a valid patch",
    };
    const result = await renderBlock(block, makeCtx());
    expect(result).toContain("diff-block fallback");
  });

  test("fallback renders the raw patch content", async () => {
    const block: Block = {
      type: "diff",
      patch: "this is not a valid patch",
    };
    const result = await renderBlock(block, makeCtx());
    expect(result).toContain("this is not a valid patch");
  });
});

// ─── Empty before, all-additions ─────────────────────────────────────────────

describe("empty before, all-additions", () => {
  test("renders without throwing", async () => {
    const block: Block = {
      type: "diff",
      before: "",
      after: "line1\nline2\nline3",
    };
    const result = await renderBlock(block, makeCtx());
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  test("only add paths — no remove or change", async () => {
    const block: Block = {
      type: "diff",
      before: "",
      after: "a\nb",
    };
    const result = await renderBlock(block, makeCtx());
    expect(result).toContain('class="diff-conn add"');
    expect(result).not.toContain('class="diff-conn remove"');
    expect(result).not.toContain('class="diff-conn change"');
  });
});

// ─── Structure checks ─────────────────────────────────────────────────────────

describe("HTML structure", () => {
  test("renders .diff-grid with before and after sides", async () => {
    const block: Block = {
      type: "diff",
      before: "a",
      after: "b",
    };
    const result = await renderBlock(block, makeCtx());
    expect(result).toContain('class="diff-grid"');
    expect(result).toContain('class="diff-side before"');
    expect(result).toContain('class="diff-side after"');
  });

  test("renders .diff-connector with SVG", async () => {
    const block: Block = {
      type: "diff",
      before: "a",
      after: "b",
    };
    const result = await renderBlock(block, makeCtx());
    expect(result).toContain('class="diff-connector"');
  });

  test("data-lang attribute is set", async () => {
    const block: Block = {
      type: "diff",
      lang: "typescript",
      before: "a",
      after: "b",
    };
    const result = await renderBlock(block, makeCtx());
    expect(result).toContain('data-lang="typescript"');
  });
});
