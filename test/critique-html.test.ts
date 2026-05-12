// HTML-mode critique tests: prefer-blocks rule additions.
// The existing critique.test.ts covers all other html-mode rules via the backwards-compat wrapper.
// test/critique-html.test.ts

import { describe, expect, test } from "bun:test";
import { critiqueHtml, type CritiqueFinding } from "../src/render/critique.ts";

function find(findings: CritiqueFinding[], code: string): CritiqueFinding | undefined {
  return findings.find((f) => f.code === code);
}

function chars(n: number, c = "x"): string {
  return c.repeat(n);
}

// ---------------------------------------------------------------------------
// mode field
// ---------------------------------------------------------------------------

describe("critiqueHtml — mode", () => {
  test("result.mode is 'html'", () => {
    const r = critiqueHtml("<p>hello</p>");
    expect(r.mode).toBe("html");
  });
});

// ---------------------------------------------------------------------------
// prefer-blocks (suggest) — new rule
// ---------------------------------------------------------------------------

describe("critiqueHtml — prefer-blocks (suggest)", () => {
  test("body with 3 h-section elements fires prefer-blocks", () => {
    const body =
      '<h2 class="h-section">Section One</h2>' +
      '<h2 class="h-section">Section Two</h2>' +
      '<h2 class="h-section">Section Three</h2>' +
      `<p>${chars(300)}</p>`;
    const r = critiqueHtml(body);
    const f = find(r.findings, "prefer-blocks");
    expect(f).toBeDefined();
    expect(f?.severity).toBe("suggest");
    expect(f?.count).toBe(3);
  });

  test("body with 2 h-section + 1 callout fires prefer-blocks (count 3)", () => {
    const body =
      '<h2 class="h-section">A</h2>' +
      '<h2 class="h-section">B</h2>' +
      '<aside class="callout note">Note here</aside>' +
      `<p>${chars(300)}</p>`;
    const r = critiqueHtml(body);
    const f = find(r.findings, "prefer-blocks");
    expect(f).toBeDefined();
    expect(f?.count).toBe(3);
  });

  test("body with 1 h-section + 1 compare-table + 1 callout fires prefer-blocks", () => {
    const body =
      '<h2 class="h-section">Section</h2>' +
      '<table class="compare-table"><tr><td>x</td></tr></table>' +
      '<aside class="callout warn">Warning</aside>' +
      `<p>${chars(300)}</p>`;
    const r = critiqueHtml(body);
    const f = find(r.findings, "prefer-blocks");
    expect(f).toBeDefined();
    expect(f?.count).toBe(3);
  });

  test("body with only 2 structural elements does NOT fire prefer-blocks", () => {
    const body =
      '<h2 class="h-section">Only one section</h2>' +
      '<aside class="callout note">One callout</aside>' +
      `<p>${chars(300)}</p>`;
    const r = critiqueHtml(body);
    expect(find(r.findings, "prefer-blocks")).toBeUndefined();
  });

  test("body with no structural elements does NOT fire prefer-blocks", () => {
    const body = `<h1 class="h-display">Title</h1><p>${chars(300)}</p>`;
    const r = critiqueHtml(body);
    expect(find(r.findings, "prefer-blocks")).toBeUndefined();
  });

  test("prefer-blocks is severity suggest, not warn", () => {
    const body =
      '<h2 class="h-section">A</h2>' +
      '<h2 class="h-section">B</h2>' +
      '<h2 class="h-section">C</h2>' +
      `<p>${chars(300)}</p>`;
    const r = critiqueHtml(body);
    const f = find(r.findings, "prefer-blocks");
    expect(f?.severity).toBe("suggest");
  });

  test("prefer-blocks message includes count", () => {
    const body =
      '<h2 class="h-section">A</h2>' +
      '<h2 class="h-section">B</h2>' +
      '<h2 class="h-section">C</h2>' +
      `<p>${chars(300)}</p>`;
    const r = critiqueHtml(body);
    const f = find(r.findings, "prefer-blocks");
    expect(f?.message).toContain("3");
    expect(f?.message).toContain("blocks");
  });
});

// ---------------------------------------------------------------------------
// critiqueHtml is API-compatible with old critique() wrapper
// ---------------------------------------------------------------------------

describe("critiqueHtml — backwards compat with critique()", () => {
  test("critiqueHtml produces same score as critique() for the same body", () => {
    // Import the backwards-compat wrapper and verify it's the same
    const { critique } = require("../src/render/critique.ts");
    const body = `<h1 class="h-display">Title</h1><p>${chars(600)}</p>`;
    const oldResult = critique(body);
    const newResult = critiqueHtml(body);
    expect(newResult.score).toBe(oldResult.score);
    expect(newResult.findings.length).toBe(oldResult.findings.length);
  });
});
