import { describe, expect, test } from "bun:test";
import {
  THEME_PRESETS,
  isThemePresetName,
  themeFromPreset,
  mergeTheme,
  type ThemePalette,
} from "../src/render/theme.ts";

const PALETTE_KEYS: (keyof ThemePalette)[] = [
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
];

describe("THEME_PRESETS", () => {
  test("exports all four presets", () => {
    expect(Object.keys(THEME_PRESETS)).toEqual(
      expect.arrayContaining(["warm", "cool", "mono", "paper"]),
    );
    expect(Object.keys(THEME_PRESETS)).toHaveLength(4);
  });

  for (const name of ["warm", "cool", "mono", "paper"] as const) {
    describe(name, () => {
      test("has all 12 color tokens defined", () => {
        const palette = THEME_PRESETS[name];
        for (const key of PALETTE_KEYS) {
          expect(palette[key], `${name}.${key} should be defined`).toBeTruthy();
        }
      });

      test("all color tokens start with #", () => {
        const palette = THEME_PRESETS[name];
        for (const key of PALETTE_KEYS) {
          expect(palette[key], `${name}.${key} should start with #`).toMatch(/^#[0-9A-Fa-f]{6}$/);
        }
      });
    });
  }
});

describe("warm preset exact hex values", () => {
  const warm = THEME_PRESETS.warm;

  test("bg is #FAF9F5", () => expect(warm.bg).toBe("#FAF9F5"));
  test("surface is #FFFFFF", () => expect(warm.surface).toBe("#FFFFFF"));
  test("surface2 is #F0EEE6", () => expect(warm.surface2).toBe("#F0EEE6"));
  test("oat is #E3DACC", () => expect(warm.oat).toBe("#E3DACC"));
  test("rule is #D1CFC5", () => expect(warm.rule).toBe("#D1CFC5"));
  test("ink is #141413", () => expect(warm.ink).toBe("#141413"));
  test("inkSoft is #3D3D3A", () => expect(warm.inkSoft).toBe("#3D3D3A"));
  test("muted is #87867F", () => expect(warm.muted).toBe("#87867F"));
  test("accent is #D97757", () => expect(warm.accent).toBe("#D97757"));
  test("olive is #788C5D", () => expect(warm.olive).toBe("#788C5D"));
  test("codeBg is #141413", () => expect(warm.codeBg).toBe("#141413"));
  test("codeFg is #E8E6DE", () => expect(warm.codeFg).toBe("#E8E6DE"));
});

describe("isThemePresetName", () => {
  test("returns true for 'warm'", () => expect(isThemePresetName("warm")).toBe(true));
  test("returns true for 'cool'", () => expect(isThemePresetName("cool")).toBe(true));
  test("returns true for 'mono'", () => expect(isThemePresetName("mono")).toBe(true));
  test("returns true for 'paper'", () => expect(isThemePresetName("paper")).toBe(true));
  test("returns false for unknown string", () => expect(isThemePresetName("galaxy")).toBe(false));
  test("returns false for empty string", () => expect(isThemePresetName("")).toBe(false));
  test("returns false for capitalized name", () => expect(isThemePresetName("Warm")).toBe(false));
});

describe("themeFromPreset", () => {
  test("returns warm theme by default (undefined)", () => {
    const theme = themeFromPreset(undefined);
    expect(theme.colors).toEqual(THEME_PRESETS.warm);
  });

  test("returns warm theme for unknown preset name", () => {
    const theme = themeFromPreset("nonexistent");
    expect(theme.colors).toEqual(THEME_PRESETS.warm);
  });

  test("returns cool preset colors for 'cool'", () => {
    const theme = themeFromPreset("cool");
    expect(theme.colors).toEqual(THEME_PRESETS.cool);
  });

  test("returns mono preset colors for 'mono'", () => {
    const theme = themeFromPreset("mono");
    expect(theme.colors).toEqual(THEME_PRESETS.mono);
  });

  test("returns paper preset colors for 'paper'", () => {
    const theme = themeFromPreset("paper");
    expect(theme.colors).toEqual(THEME_PRESETS.paper);
  });

  test("returns warm preset colors for 'warm'", () => {
    const theme = themeFromPreset("warm");
    expect(theme.colors).toEqual(THEME_PRESETS.warm);
  });

  test("includes standard font stacks", () => {
    const theme = themeFromPreset("cool");
    expect(theme.fonts.serif).toContain("serif");
    expect(theme.fonts.sans).toContain("sans-serif");
    expect(theme.fonts.mono).toContain("monospace");
  });

  test("all presets share the same font stacks", () => {
    const warm = themeFromPreset("warm");
    const cool = themeFromPreset("cool");
    const mono = themeFromPreset("mono");
    const paper = themeFromPreset("paper");
    expect(cool.fonts).toEqual(warm.fonts);
    expect(mono.fonts).toEqual(warm.fonts);
    expect(paper.fonts).toEqual(warm.fonts);
  });
});

describe("mergeTheme with presets", () => {
  test("per-token override stacks on top of preset", () => {
    const theme = mergeTheme(themeFromPreset("cool"), { accent: "#FF0000" });
    expect(theme.colors.accent).toBe("#FF0000");
  });

  test("override does not mutate the preset palette", () => {
    const originalAccent = THEME_PRESETS.cool.accent;
    mergeTheme(themeFromPreset("cool"), { accent: "#FF0000" });
    expect(THEME_PRESETS.cool.accent).toBe(originalAccent);
  });

  test("unoverridden tokens remain from chosen preset", () => {
    const cool = THEME_PRESETS.cool;
    const theme = mergeTheme(themeFromPreset("cool"), { accent: "#FF0000" });
    expect(theme.colors.bg).toBe(cool.bg);
    expect(theme.colors.ink).toBe(cool.ink);
  });
});
