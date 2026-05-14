import { describe, expect, test } from "bun:test";
import {
  defaultTheme,
  frameworkCss,
  frameworkRulesCss,
  mergeTheme,
  themeToCssVars,
  themeTokensCss,
  themeFromPreset,
} from "../src/render/theme.ts";

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

  test("bg is claret-dark wine (#180810)", () => {
    expect(defaultTheme().colors.bg).toBe("#180810");
  });

  test("accent is claret-dark rose (#C75B7A)", () => {
    expect(defaultTheme().colors.accent).toBe("#C75B7A");
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

  test("contains claret-dark token values", () => {
    const css = themeToCssVars(defaultTheme());
    expect(css).toContain("#180810");
    expect(css).toContain("#C75B7A");
  });
});

describe("themeTokensCss", () => {
  test("themeTokensCss === themeToCssVars for same theme", () => {
    const theme = defaultTheme();
    expect(themeTokensCss(theme)).toBe(themeToCssVars(theme));
  });

  test("contains :root block with accent for warm preset", () => {
    const css = themeTokensCss(themeFromPreset("warm"));
    expect(css).toContain(":root");
    expect(css).toContain("#D97757");
  });
});

describe("frameworkRulesCss", () => {
  test("does NOT include :root block", () => {
    const css = frameworkRulesCss();
    expect(css).not.toContain(":root {");
  });

  test("contains component classes", () => {
    const css = frameworkRulesCss();
    const classes = [
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
    for (const cls of classes) {
      expect(css).toContain(cls);
    }
  });

  test("contains block-renderer pattern selectors (phase 2.6 additions)", () => {
    const css = frameworkRulesCss();
    const selectors = [
      "dl.kv",
      "dl.kv dt",
      "dl.kv dd",
      ".lede",
      ".pill-row",
      ".check-list",
      ".check-list .check",
      "figure.code figcaption",
      ".timeline-label",
      ".timeline-text",
      ".timeline-date",
      ".diagram svg text",
      '.diagram svg [fill="#222"]',
      "hr[data-label]",
      ".card + .card",
    ];
    for (const sel of selectors) {
      expect(css).toContain(sel);
    }
  });

  test("uses css variables (not hardcoded colors)", () => {
    const css = frameworkRulesCss();
    expect(css).toContain("var(--");
  });

  test("no remote font @import URLs", () => {
    const css = frameworkRulesCss();
    expect(css).not.toMatch(/@import.*https?:/);
    expect(css).not.toMatch(/url\s*\(\s*['"]?https?:/);
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
    "dl.kv",
    ".lede",
    ".pill-row",
    ".check-list",
    "figure.code figcaption",
    ".timeline-label",
    ".timeline-text",
    ".diagram svg text",
    "hr[data-label]",
    ".card + .card",
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

  test("frameworkCss output equals themeTokensCss + frameworkRulesCss for same theme", () => {
    const theme = defaultTheme();
    const expected = `${themeTokensCss(theme)}\n${frameworkRulesCss()}`;
    expect(frameworkCss(theme)).toBe(expected);
  });
});

// ─── Phase B: cs-* selector smoke tests ───────────────────────────────────────

describe("frameworkRulesCss — cs-* interactive control selectors", () => {
  test("contains .cs-questions", () => {
    expect(frameworkRulesCss()).toContain(".cs-questions");
  });

  test("contains .cs-control- selectors", () => {
    expect(frameworkRulesCss()).toContain(".cs-control-");
  });

  test("contains .cs-pick", () => {
    expect(frameworkRulesCss()).toContain(".cs-pick");
  });

  test("contains .cs-submit", () => {
    expect(frameworkRulesCss()).toContain(".cs-submit");
  });

  test("contains .cs-confirm", () => {
    expect(frameworkRulesCss()).toContain(".cs-confirm");
  });

  test("contains .cs-text", () => {
    expect(frameworkRulesCss()).toContain(".cs-text");
  });

  test("contains .cs-slider", () => {
    expect(frameworkRulesCss()).toContain(".cs-slider");
  });

  test("contains .cs-react", () => {
    expect(frameworkRulesCss()).toContain(".cs-react");
  });

  test("contains .cs-answered", () => {
    expect(frameworkRulesCss()).toContain(".cs-answered");
  });

  test("contains .cs-error", () => {
    expect(frameworkRulesCss()).toContain(".cs-error");
  });

  test("contains .cs-banner-ended", () => {
    expect(frameworkRulesCss()).toContain(".cs-banner-ended");
  });

  test("contains .cs-saving", () => {
    expect(frameworkRulesCss()).toContain(".cs-saving");
  });

  test("contains .cs-skip selector", () => {
    expect(frameworkRulesCss()).toContain(".cs-skip {");
  });

  test("contains .cs-button-row selector", () => {
    expect(frameworkRulesCss()).toContain(".cs-button-row {");
  });

  test("contains .cs-answered-skipped selector", () => {
    expect(frameworkRulesCss()).toContain(".cs-answered-skipped {");
  });

  test("cs-* rules use CSS variables (not hardcoded colors except warn red)", () => {
    const css = frameworkRulesCss();
    expect(css).toContain("var(--accent)");
    expect(css).toContain("var(--surface)");
    expect(css).toContain("var(--ink)");
  });

  test("frameworkCss contains all cs-* selectors when built with a theme", () => {
    const css = frameworkCss(defaultTheme());
    expect(css).toContain(".cs-questions");
    expect(css).toContain(".cs-pick");
    expect(css).toContain(".cs-submit");
  });
});

// ─── Phase 5: annotate CSS classes ────────────────────────────────────────────

describe("frameworkRulesCss — annotate cs-* classes (Phase 5)", () => {
  const annotateClasses = [
    ".cs-anchor-affordance",
    ".cs-anchor-affordance-line",
    ".cs-anchor-affordance-block",
    ".cs-comment-popup",
    ".cs-comment-popup-quote",
    ".cs-comment-input",
    ".cs-comment-actions",
    ".cs-comment-save",
    ".cs-comment-cancel",
    ".cs-comment-rail",
    ".cs-comment-bubble",
    ".cs-comment-bubble-head",
    ".cs-comment-anchor-label",
    ".cs-comment-delete",
    ".cs-comment-text",
    ".cs-comment-bubble-quote",
    ".cs-verdict-footer",
    ".cs-verdict-btn",
    ".cs-verdict-approve",
    ".cs-verdict-request_changes",
    ".cs-verdict-comment",
  ];

  for (const cls of annotateClasses) {
    test(`contains ${cls}`, () => {
      expect(frameworkRulesCss()).toContain(cls);
    });
  }

  test("contains anchor affordance hover show rule", () => {
    const css = frameworkRulesCss();
    expect(css).toContain("[data-cesium-anchor]:hover > .cs-anchor-affordance-line");
  });

  test("contains focus-within show rule for accessibility", () => {
    expect(frameworkRulesCss()).toContain("focus-within");
  });

  test("[data-cesium-anchor] has position: relative", () => {
    const css = frameworkRulesCss();
    expect(css).toContain("[data-cesium-anchor]");
    expect(css).toContain("position: relative");
  });

  test("cs-anchor-affordance-block uses position: absolute with top and right", () => {
    const css = frameworkRulesCss();
    expect(css).toContain(".cs-anchor-affordance-block");
    expect(css).toContain("position: absolute");
    expect(css).toContain("top:");
    expect(css).toContain("right:");
  });

  test("cs-anchor-affordance-line uses visibility: hidden and position: absolute", () => {
    const css = frameworkRulesCss();
    expect(css).toContain(".cs-anchor-affordance-line");
    expect(css).toContain("visibility: hidden");
    expect(css).toContain("position: absolute");
  });

  test("cs-selection-menu is present with position: fixed", () => {
    const css = frameworkRulesCss();
    expect(css).toContain(".cs-selection-menu");
    expect(css).toContain("position: fixed");
  });

  test("contains verdict-btn disabled state", () => {
    expect(frameworkRulesCss()).toContain(".cs-verdict-btn:disabled");
  });

  test("contains body padding-bottom rule for annotate scaffold", () => {
    const css = frameworkRulesCss();
    expect(css).toContain("cs-annotate-scaffold");
    expect(css).toContain("padding-bottom");
  });

  test("annotate classes use CSS variables not hardcoded colors", () => {
    const css = frameworkRulesCss();
    // Specific annotate sections should reference theme vars
    expect(css).toContain("var(--accent)");
    expect(css).toContain("var(--surface)");
    expect(css).toContain("var(--rule)");
  });

  test("comment rail is absolute-positioned on wide viewports", () => {
    const css = frameworkRulesCss();
    expect(css).toContain(".cs-comment-rail");
    expect(css).toContain("position: absolute");
    expect(css).not.toContain(".cs-comment-rail {\n  position: fixed");
  });

  test("cs-banner-offline no longer uses position: sticky", () => {
    const css = frameworkRulesCss();
    expect(css).not.toContain("position: sticky");
  });

  test("cs-banner-offline has max-width constraint", () => {
    const css = frameworkRulesCss();
    expect(css).toContain("cs-banner-offline");
    expect(css).toContain("max-width");
  });

  test("cs-anchor-active class is present", () => {
    expect(frameworkRulesCss()).toContain(".cs-anchor-active");
  });

  test("cs-comment-bubble-active class is present", () => {
    expect(frameworkRulesCss()).toContain(".cs-comment-bubble-active");
  });

  test("comment rail collapses on narrow viewports (below 1448px page+rail threshold)", () => {
    // Rail falls back to static layout below the side-by-side threshold so it
    // does not overlap the per-block Comment affordance button.
    expect(frameworkRulesCss()).toContain("max-width: 1447px");
  });

  test("page shifts left when annotate is active and viewport has room for rail", () => {
    const css = frameworkRulesCss();
    expect(css).toContain("min-width: 1448px");
    expect(css).toContain("body.cs-annotate-active .page");
  });

  test("verdict footer is fixed-positioned at bottom", () => {
    const css = frameworkRulesCss();
    expect(css).toContain(".cs-verdict-footer");
    expect(css).toContain("position: fixed");
    expect(css).toContain("bottom: 0");
  });
});
