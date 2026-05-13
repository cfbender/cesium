import { describe, expect, test } from "bun:test";
import { createCritiqueTool, formatCritiqueForAgent } from "../src/tools/critique.ts";
import { critique } from "../src/render/critique.ts";
import type { Block } from "../src/render/blocks/types.ts";

const FAKE_CTX = {} as Parameters<typeof createCritiqueTool>[0];

async function executeCritiqueBlocks(blocks: Block[]): Promise<string> {
  const t = createCritiqueTool(FAKE_CTX);
  const result = await t.execute({ blocks }, {} as never);
  if (typeof result !== "string") throw new Error("expected string from critique tool");
  return result;
}

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

describe("createCritiqueTool — input validation", () => {
  test("missing blocks returns an error", async () => {
    const t = createCritiqueTool(FAKE_CTX);
    const result = await t.execute({}, {} as never);
    expect(typeof result).toBe("string");
    expect(result).toContain("error");
    expect(result).toContain("blocks");
  });

  test("non-array blocks returns an error", async () => {
    const t = createCritiqueTool(FAKE_CTX);
    const result = await t.execute({ blocks: "not-an-array" }, {} as never);
    expect(typeof result).toBe("string");
    expect(result).toContain("error");
  });

  test("providing blocks succeeds", async () => {
    const output = await executeCritiqueBlocks([{ type: "prose", markdown: "Hello." }]);
    expect(output).not.toContain("error:");
    expect(output).toMatch(/^score: /);
  });
});

// ---------------------------------------------------------------------------
// formatCritiqueForAgent — output shape
// ---------------------------------------------------------------------------

describe("formatCritiqueForAgent — output shape", () => {
  test("always starts with 'score: '", () => {
    const result = formatCritiqueForAgent(critique([]));
    expect(result).toMatch(/^score: /);
  });

  test("includes score as 'score: N/100'", () => {
    const result = formatCritiqueForAgent(critique([]));
    expect(result).toMatch(/^score: \d+\/100/);
  });

  test("no warn: header when no warn findings", () => {
    const r = formatCritiqueForAgent(critique([{ type: "prose", markdown: "Hello world." }]));
    expect(r).not.toContain("\nwarn:\n");
  });

  test("warn: header present when there are warn findings", () => {
    // Build 3 raw_html blocks to trigger raw-html-overuse (warn)
    const blocks: Block[] = [
      { type: "raw_html", html: "<div>a</div>", purpose: "x" },
      { type: "raw_html", html: "<div>b</div>", purpose: "x" },
      { type: "raw_html", html: "<div>c</div>", purpose: "x" },
    ];
    const r = formatCritiqueForAgent(critique(blocks));
    expect(r).toContain("warn:");
    expect(r).toContain("[raw-html-overuse]");
  });
});

// ---------------------------------------------------------------------------
// Tool execute — blocks
// ---------------------------------------------------------------------------

describe("createCritiqueTool — execute", () => {
  test("blocks input returns score: N/100", async () => {
    const output = await executeCritiqueBlocks([{ type: "prose", markdown: "Hello world." }]);
    expect(output).toMatch(/^score: \d+\/100/);
  });

  test("score is always a number between 0 and 100", async () => {
    const output = await executeCritiqueBlocks([{ type: "prose", markdown: "Hello." }]);
    const match = output.match(/^score: (\d+)\/100/);
    expect(match).not.toBeNull();
    const score = parseInt(match?.[1] ?? "999", 10);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  test("clean document scores 100", async () => {
    const blocks: Block[] = [
      { type: "hero", title: "My Document" },
      { type: "tldr", markdown: "Short summary." },
      {
        type: "section",
        title: "Introduction",
        children: [{ type: "prose", markdown: "Content here." }],
      },
    ];
    const output = await executeCritiqueBlocks(blocks);
    expect(output).toMatch(/^score: 100\/100/);
  });
});
