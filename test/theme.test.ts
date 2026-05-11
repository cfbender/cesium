import { describe, expect, test } from "bun:test";
import { defaultTheme, frameworkCss, mergeTheme, themeToCssVars } from "../src/render/theme.ts";

describe("defaultTheme", () => {
  test("has all required color tokens", () => {
    const theme = defaultTheme();
    const required = [
      "bg",
      "surface",
      "surface2",
      "oat",
      "rule",
      "ink",
      "inkSoft",
      "muted",
      "accent",
      "olive",
      "codeBg",
      "codeFg",
    ] as const;
    for (const key of required) {
      expect(theme.colors[key]).toBeTruthy();
    }
  });

  test("has all required font stacks", () => {
    const theme = defaultTheme();
    expect(theme.fonts.serif).toContain("serif");
    expect(theme.fonts.sans).toContain("sans-serif");
    expect(theme.fonts.mono).toContain("monospace");
  });

  test("no remote font URLs in font stacks", () => {
    const theme = defaultTheme();
    for (const stack of Object.values(theme.fonts)) {
      expect(stack).not.toMatch(/https?:\/\//);
    }
  });

  test("bg is ivory-ish (#FAF9F5)", () => {
    expect(defaultTheme().colors.bg).toBe("#FAF9F5");
  });

  test("accent is clay (#D97757)", () => {
    expect(defaultTheme().colors.accent).toBe("#D97757");
  });
});

describe("mergeTheme", () => {
  test("no override returns base unchanged", () => {
    const base = defaultTheme();
    const result = mergeTheme(base);
    expect(result.colors).toEqual(base.colors);
    expect(result.fonts).toEqual(base.fonts);
  });

  test("override changes only specified colors", () => {
    const base = defaultTheme();
    const result = mergeTheme(base, { accent: "#FF0000" });
    expect(result.colors.accent).toBe("#FF0000");
    expect(result.colors.bg).toBe(base.colors.bg);
    expect(result.colors.ink).toBe(base.colors.ink);
  });

  test("does not mutate base theme", () => {
    const base = defaultTheme();
    const originalAccent = base.colors.accent;
    mergeTheme(base, { accent: "#FF0000" });
    expect(base.colors.accent).toBe(originalAccent);
  });
});

describe("themeToCssVars", () => {
  test("produces :root block", () => {
    const css = themeToCssVars(defaultTheme());
    expect(css).toMatch(/^:root\s*\{/);
    expect(css).toContain("}");
  });

  test("contains all css var names", () => {
    const css = themeToCssVars(defaultTheme());
    const expected = [
      "--bg",
      "--surface",
      "--surface-2",
      "--oat",
      "--rule",
      "--ink",
      "--ink-soft",
      "--muted",
      "--accent",
      "--olive",
      "--code-bg",
      "--code-fg",
      "--serif",
      "--sans",
      "--mono",
    ];
    for (const v of expected) {
      expect(css).toContain(v);
    }
  });

  test("contains token values", () => {
    const css = themeToCssVars(defaultTheme());
    expect(css).toContain("#FAF9F5");
    expect(css).toContain("#D97757");
  });
});

describe("frameworkCss", () => {
  const css = frameworkCss(defaultTheme());

  const designDocClasses = [
    ".eyebrow",
    ".h-display",
    ".h-section",
    ".section-num",
    ".card",
    ".tldr",
    ".callout",
    ".code",
    ".timeline",
    ".diagram",
    ".compare-table",
    ".risk-table",
    ".kbd",
    ".pill",
    ".tag",
    ".byline",
  ];

  for (const cls of designDocClasses) {
    test(`includes ${cls} class`, () => {
      expect(css).toContain(cls);
    });
  }

  test("includes :root block with color vars", () => {
    expect(css).toContain(":root");
    expect(css).toContain("--bg");
  });

  test("uses css variables (not hardcoded colors in components)", () => {
    // After the :root block, components should reference var(--...)
    expect(css).toContain("var(--");
  });

  test("no remote font @import URLs", () => {
    expect(css).not.toMatch(/@import.*https?:/);
    expect(css).not.toMatch(/url\s*\(\s*['"]?https?:/);
  });

  test("includes reset", () => {
    expect(css).toContain("box-sizing: border-box");
  });

  test("includes .callout variants", () => {
    expect(css).toContain(".callout.note");
    expect(css).toContain(".callout.warn");
    expect(css).toContain(".callout.risk");
  });

  test("includes code syntax highlight classes", () => {
    expect(css).toContain(".code .kw");
    expect(css).toContain(".code .str");
    expect(css).toContain(".code .cm");
    expect(css).toContain(".code .fn");
  });
});
