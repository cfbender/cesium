import { describe, expect, test } from "bun:test";
import { fallbackCss } from "../src/render/fallback.ts";

describe("fallbackCss", () => {
  test("returns a non-empty string", () => {
    const css = fallbackCss();
    expect(typeof css).toBe("string");
    expect(css.length).toBeGreaterThan(0);
  });

  test("is ≤500 bytes (minified)", () => {
    const css = fallbackCss();
    const bytes = Buffer.byteLength(css, "utf8");
    expect(bytes).toBeLessThanOrEqual(500);
  });

  test("contains :root selector", () => {
    expect(fallbackCss()).toContain(":root");
  });

  test("contains .card selector", () => {
    expect(fallbackCss()).toContain(".card");
  });

  test("contains .callout selector", () => {
    expect(fallbackCss()).toContain(".callout");
  });

  test("contains .tldr selector", () => {
    expect(fallbackCss()).toContain(".tldr");
  });

  test("contains prefers-color-scheme dark media query", () => {
    expect(fallbackCss()).toContain("prefers-color-scheme");
    expect(fallbackCss()).toContain("dark");
  });

  test("contains monospace font stack for pre/code", () => {
    expect(fallbackCss()).toContain("monospace");
  });

  test("contains table reset", () => {
    expect(fallbackCss()).toContain("border-collapse");
  });

  test("does NOT contain CSS custom properties (no var(--...))", () => {
    // Fallback must be self-contained, not rely on theme tokens
    expect(fallbackCss()).not.toContain("var(--");
  });

  test("does NOT contain full framework rules like .h-section", () => {
    expect(fallbackCss()).not.toContain(".h-section");
  });

  test("does NOT contain .eyebrow (framework-only)", () => {
    expect(fallbackCss()).not.toContain(".eyebrow");
  });

  test("is deterministic: same output on repeated calls", () => {
    expect(fallbackCss()).toBe(fallbackCss());
  });
});
