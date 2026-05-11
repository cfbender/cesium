import { describe, expect, test } from "bun:test";
import { createCritiqueTool, formatCritiqueForAgent } from "../src/tools/critique.ts";
import { critique } from "../src/render/critique.ts";

const FAKE_CTX = {} as Parameters<typeof createCritiqueTool>[0];

async function executeCritique(html: string): Promise<string> {
  const t = createCritiqueTool(FAKE_CTX);
  const result = await t.execute({ html }, {} as never);
  if (typeof result !== "string") throw new Error("expected string from critique tool");
  return result;
}

// ---------------------------------------------------------------------------
// formatCritiqueForAgent
// ---------------------------------------------------------------------------

describe("formatCritiqueForAgent — output shape", () => {
  test("always starts with 'score: '", () => {
    const result = formatCritiqueForAgent(critique(""));
    expect(result).toMatch(/^score: /);
  });

  test("includes score as 'score: N/100'", () => {
    const result = formatCritiqueForAgent(critique(""));
    expect(result).toMatch(/^score: \d+\/100/);
  });

  test("no warn: header when no warn findings", () => {
    // Small body: triggers suggest/info only (no external resources)
    const r = formatCritiqueForAgent(critique("<p>hi</p>"));
    expect(r).not.toContain("\nwarn:\n");
  });

  test("warn: header present when there are warn findings", () => {
    const html = '<script src="https://evil.com/x.js"></script><p>hi</p>';
    const r = formatCritiqueForAgent(critique(html));
    expect(r).toContain("warn:");
  });

  test("warn finding message included in output", () => {
    const html = '<script src="https://evil.com/x.js"></script><p>hi</p>';
    const r = formatCritiqueForAgent(critique(html));
    expect(r).toContain("[external-resource]");
    expect(r).toContain("External resource will be stripped");
  });

  test("suggest: header present when there are suggest findings", () => {
    const r = formatCritiqueForAgent(critique("<p>hi</p>"));
    expect(r).toContain("suggest:");
  });

  test("info: header present when there are info findings", () => {
    // Need to trigger an info-level finding — use 9 style attrs
    const html = Array.from({ length: 9 }, (_, i) => `<p style="color: red">${i}</p>`).join("");
    const r = formatCritiqueForAgent(critique(html));
    expect(r).toContain("info:");
  });

  test("groups findings under their severity header", () => {
    const html = '<script src="https://evil.com/x.js"></script><p>hi</p>';
    const r = formatCritiqueForAgent(critique(html));
    // warn: comes before suggest:
    const warnPos = r.indexOf("warn:");
    const suggestPos = r.indexOf("suggest:");
    if (warnPos !== -1 && suggestPos !== -1) {
      expect(warnPos).toBeLessThan(suggestPos);
    }
  });

  test("each finding is formatted as '- [code] message'", () => {
    const html = '<script src="https://evil.com/x.js"></script><p>hi</p>';
    const r = formatCritiqueForAgent(critique(html));
    expect(r).toMatch(/- \[external-resource\] .+/);
  });
});

// ---------------------------------------------------------------------------
// Tool execute
// ---------------------------------------------------------------------------

describe("createCritiqueTool — execute", () => {
  test("execute returns a string starting with 'score: '", async () => {
    const output = await executeCritique("");
    expect(output).toMatch(/^score: /);
  });

  test("score is always a number between 0 and 100", async () => {
    const output = await executeCritique("");
    const match = output.match(/^score: (\d+)\/100/);
    expect(match).not.toBeNull();
    const score = parseInt(match?.[1] ?? "999", 10);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  test("empty body returns score < 100 (due to suggest findings)", async () => {
    const output = await executeCritique("");
    const match = output.match(/^score: (\d+)\/100/);
    const score = parseInt(match?.[1] ?? "100", 10);
    expect(score).toBeLessThan(100);
  });

  test("sample with one warn-level finding includes 'warn:' and message", async () => {
    const output = await executeCritique('<script src="https://evil.com/x.js"></script><p>hi</p>');
    expect(output).toContain("warn:");
    expect(output).toContain("External resource");
  });

  test("sample with no warn findings does NOT contain 'warn:' header", async () => {
    // Use a short clean body
    const output = await executeCritique("<p>hello world</p>");
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

    const goodOutput = await executeCritique(good);
    const badOutput = await executeCritique(bad);

    const goodScore = parseInt(goodOutput.match(/^score: (\d+)\/100/)?.[1] ?? "0", 10);
    const badScore = parseInt(badOutput.match(/^score: (\d+)\/100/)?.[1] ?? "0", 10);
    expect(goodScore).toBeGreaterThan(badScore);
  });
});
