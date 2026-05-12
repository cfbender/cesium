import { describe, expect, test } from "bun:test";
import { createCritiqueTool, formatCritiqueForAgent } from "../src/tools/critique.ts";
import { critiqueHtml } from "../src/render/critique.ts";
import type { Block } from "../src/render/blocks/types.ts";

const FAKE_CTX = {} as Parameters<typeof createCritiqueTool>[0];

async function executeCritiqueHtml(html: string): Promise<string> {
  const t = createCritiqueTool(FAKE_CTX);
  const result = await t.execute({ html }, {} as never);
  if (typeof result !== "string") throw new Error("expected string from critique tool");
  return result;
}

async function executeCritiqueBlocks(blocks: Block[]): Promise<string> {
  const t = createCritiqueTool(FAKE_CTX);
  const result = await t.execute({ blocks }, {} as never);
  if (typeof result !== "string") throw new Error("expected string from critique tool");
  return result;
}

// ---------------------------------------------------------------------------
// XOR enforcement
// ---------------------------------------------------------------------------

describe("createCritiqueTool — XOR enforcement", () => {
  test("providing both html and blocks returns error", async () => {
    const t = createCritiqueTool(FAKE_CTX);
    const result = await t.execute({ html: "<p>hi</p>", blocks: [] }, {} as never);
    expect(typeof result).toBe("string");
    expect(result).toContain("error");
    expect(result).toContain("exactly one");
  });

  test("providing neither html nor blocks returns error", async () => {
    const t = createCritiqueTool(FAKE_CTX);
    const result = await t.execute({}, {} as never);
    expect(typeof result).toBe("string");
    expect(result).toContain("error");
    expect(result).toContain("exactly one");
  });

  test("providing only html succeeds", async () => {
    const output = await executeCritiqueHtml("<p>hi</p>");
    expect(output).not.toContain("error:");
    expect(output).toMatch(/^score: /);
  });

  test("providing only blocks succeeds", async () => {
    const output = await executeCritiqueBlocks([{ type: "prose", markdown: "Hello." }]);
    expect(output).not.toContain("error:");
    expect(output).toMatch(/^score: /);
  });
});

// ---------------------------------------------------------------------------
// mode field in response
// ---------------------------------------------------------------------------

describe("createCritiqueTool — mode field", () => {
  test("html mode includes 'mode: html' in output", async () => {
    const output = await executeCritiqueHtml("<p>hello world</p>");
    expect(output).toContain("mode: html");
  });

  test("blocks mode includes 'mode: blocks' in output", async () => {
    const output = await executeCritiqueBlocks([{ type: "prose", markdown: "Hello." }]);
    expect(output).toContain("mode: blocks");
  });
});

// ---------------------------------------------------------------------------
// formatCritiqueForAgent — output shape
// ---------------------------------------------------------------------------

describe("formatCritiqueForAgent — output shape", () => {
  test("always starts with 'score: '", () => {
    const result = formatCritiqueForAgent(critiqueHtml(""));
    expect(result).toMatch(/^score: /);
  });

  test("includes score as 'score: N/100'", () => {
    const result = formatCritiqueForAgent(critiqueHtml(""));
    expect(result).toMatch(/^score: \d+\/100/);
  });

  test("includes mode line", () => {
    const result = formatCritiqueForAgent(critiqueHtml(""));
    expect(result).toContain("mode: html");
  });

  test("no warn: header when no warn findings", () => {
    // Small body: triggers suggest/info only (no external resources)
    const r = formatCritiqueForAgent(critiqueHtml("<p>hi</p>"));
    expect(r).not.toContain("\nwarn:\n");
  });

  test("warn: header present when there are warn findings", () => {
    const html = '<script src="https://evil.com/x.js"></script><p>hi</p>';
    const r = formatCritiqueForAgent(critiqueHtml(html));
    expect(r).toContain("warn:");
  });

  test("warn finding message included in output", () => {
    const html = '<script src="https://evil.com/x.js"></script><p>hi</p>';
    const r = formatCritiqueForAgent(critiqueHtml(html));
    expect(r).toContain("[external-resource]");
    expect(r).toContain("External resource will be stripped");
  });

  test("suggest: header present when there are suggest findings", () => {
    const r = formatCritiqueForAgent(critiqueHtml("<p>hi</p>"));
    expect(r).toContain("suggest:");
  });

  test("info: header present when there are info findings", () => {
    // Need to trigger an info-level finding — use 9 style attrs
    const html = Array.from({ length: 9 }, (_, i) => `<p style="color: red">${i}</p>`).join("");
    const r = formatCritiqueForAgent(critiqueHtml(html));
    expect(r).toContain("info:");
  });

  test("groups findings under their severity header", () => {
    const html = '<script src="https://evil.com/x.js"></script><p>hi</p>';
    const r = formatCritiqueForAgent(critiqueHtml(html));
    // warn: comes before suggest:
    const warnPos = r.indexOf("warn:");
    const suggestPos = r.indexOf("suggest:");
    if (warnPos !== -1 && suggestPos !== -1) {
      expect(warnPos).toBeLessThan(suggestPos);
    }
  });

  test("each finding is formatted as '- [code] message'", () => {
    const html = '<script src="https://evil.com/x.js"></script><p>hi</p>';
    const r = formatCritiqueForAgent(critiqueHtml(html));
    expect(r).toMatch(/- \[external-resource\] .+/);
  });
});

// ---------------------------------------------------------------------------
// Tool execute — html mode
// ---------------------------------------------------------------------------

describe("createCritiqueTool — execute html mode", () => {
  test("execute returns a string starting with 'score: '", async () => {
    const output = await executeCritiqueHtml("");
    expect(output).toMatch(/^score: /);
  });

  test("score is always a number between 0 and 100", async () => {
    const output = await executeCritiqueHtml("");
    const match = output.match(/^score: (\d+)\/100/);
    expect(match).not.toBeNull();
    const score = parseInt(match?.[1] ?? "999", 10);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  test("empty body returns score < 100 (due to suggest findings)", async () => {
    const output = await executeCritiqueHtml("");
    const match = output.match(/^score: (\d+)\/100/);
    const score = parseInt(match?.[1] ?? "100", 10);
    expect(score).toBeLessThan(100);
  });

  test("sample with one warn-level finding includes 'warn:' and message", async () => {
    const output = await executeCritiqueHtml(
      '<script src="https://evil.com/x.js"></script><p>hi</p>',
    );
    expect(output).toContain("warn:");
    expect(output).toContain("External resource");
  });

  test("sample with no warn findings does NOT contain 'warn:' header", async () => {
    // Use a short clean body
    const output = await executeCritiqueHtml("<p>hello world</p>");
    expect(output).not.toContain("\nwarn:\n");
    // But does contain suggest: (no-h-display, body-too-short, no-eyebrow)
    expect(output).toContain("suggest:");
  });

  test("well-formed large body has higher score than malformed one", async () => {
    const good =
      '<h1 class="h-display">Title</h1>' +
      '<div class="eyebrow">Label</div>' +
      '<div class="tldr">Summary</div>' +
      '<div class="h-section">Section</div>' +
      `<p>${"x".repeat(600)}</p>`;
    const bad = `<script src="https://evil.com/x.js"></script><p>${"x".repeat(600)}</p>`;

    const goodOutput = await executeCritiqueHtml(good);
    const badOutput = await executeCritiqueHtml(bad);

    const goodScore = parseInt(goodOutput.match(/^score: (\d+)\/100/)?.[1] ?? "0", 10);
    const badScore = parseInt(badOutput.match(/^score: (\d+)\/100/)?.[1] ?? "0", 10);
    expect(goodScore).toBeGreaterThan(badScore);
  });
});

// ---------------------------------------------------------------------------
// Tool execute — blocks mode
// ---------------------------------------------------------------------------

describe("createCritiqueTool — execute blocks mode", () => {
  test("blocks mode returns score: N/100", async () => {
    const output = await executeCritiqueBlocks([{ type: "prose", markdown: "Hello world." }]);
    expect(output).toMatch(/^score: \d+\/100/);
  });

  test("blocks mode returns mode: blocks", async () => {
    const output = await executeCritiqueBlocks([{ type: "prose", markdown: "Hello." }]);
    expect(output).toContain("mode: blocks");
  });

  test("blocks mode: clean document scores 100", async () => {
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

// ---------------------------------------------------------------------------
// prefer-blocks rule (html mode, suggest)
// ---------------------------------------------------------------------------

describe("createCritiqueTool — prefer-blocks rule (html mode)", () => {
  test("body with 3+ structural elements fires prefer-blocks", async () => {
    const body =
      '<h2 class="h-section">Section One</h2>' +
      '<h2 class="h-section">Section Two</h2>' +
      '<h2 class="h-section">Section Three</h2>' +
      `<p>${"x".repeat(300)}</p>`;
    const output = await executeCritiqueHtml(body);
    expect(output).toContain("[prefer-blocks]");
  });

  test("body with fewer than 3 structural elements does NOT fire prefer-blocks", async () => {
    const body =
      '<h1 class="h-display">Title</h1>' +
      '<div class="eyebrow">Label</div>' +
      `<p>${"x".repeat(300)}</p>`;
    const output = await executeCritiqueHtml(body);
    expect(output).not.toContain("[prefer-blocks]");
  });

  test("prefer-blocks is severity suggest (not warn)", async () => {
    const body =
      '<h2 class="h-section">A</h2>' +
      '<h2 class="h-section">B</h2>' +
      '<h2 class="h-section">C</h2>' +
      `<p>${"x".repeat(300)}</p>`;
    const output = await executeCritiqueHtml(body);
    // Should appear in the suggest: section
    const suggestPos = output.indexOf("suggest:");
    const warnPos = output.indexOf("warn:");
    const preferBlocksPos = output.indexOf("[prefer-blocks]");
    expect(preferBlocksPos).toBeGreaterThan(-1);
    // prefer-blocks should be after any warn section (it's a suggest)
    if (warnPos !== -1 && suggestPos !== -1) {
      expect(preferBlocksPos).toBeGreaterThan(suggestPos);
    }
  });
});
