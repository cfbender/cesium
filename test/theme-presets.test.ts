import { describe, expect, test } from "bun:test";
import {
  THEME_PRESETS,
  defaultTheme,
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
  test("exports all seven presets (claret, claret-dark, claret-light, warm, cool, mono, paper)", () => {
    expect(Object.keys(THEME_PRESETS)).toEqual(
      expect.arrayContaining([
        "claret",
        "claret-dark",
        "claret-light",
        "warm",
        "cool",
        "mono",
        "paper",
      ]),
    );
    expect(Object.keys(THEME_PRESETS)).toHaveLength(7);
  });

  for (const name of [
    "claret",
    "claret-dark",
    "claret-light",
    "warm",
    "cool",
    "mono",
    "paper",
  ] as const) {
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

describe("claret-dark preset exact hex values", () => {
  const dark = THEME_PRESETS["claret-dark"];

  test("bg is #180810", () => expect(dark.bg).toBe("#180810"));
  test("surface is #211618", () => expect(dark.surface).toBe("#211618"));
  test("surface2 is #2B1F22", () => expect(dark.surface2).toBe("#2B1F22"));
  test("oat is #3A2E25", () => expect(dark.oat).toBe("#3A2E25"));
  test("rule is #3A2E25", () => expect(dark.rule).toBe("#3A2E25"));
  test("ink is #DDD3C7", () => expect(dark.ink).toBe("#DDD3C7"));
  test("inkSoft is #BDB3A7", () => expect(dark.inkSoft).toBe("#BDB3A7"));
  test("muted is #9E9288", () => expect(dark.muted).toBe("#9E9288"));
  test("accent is #C75B7A", () => expect(dark.accent).toBe("#C75B7A"));
  test("olive is #8FA86E", () => expect(dark.olive).toBe("#8FA86E"));
  test("codeBg is #0F0509", () => expect(dark.codeBg).toBe("#0F0509"));
  test("codeFg is #DDD3C7", () => expect(dark.codeFg).toBe("#DDD3C7"));
});

describe("claret-light preset exact hex values (old 'claret' palette)", () => {
  const light = THEME_PRESETS["claret-light"];

  test("bg is #FDF8F3", () => expect(light.bg).toBe("#FDF8F3"));
  test("surface is #FFFFFF", () => expect(light.surface).toBe("#FFFFFF"));
  test("surface2 is #F5EDE3", () => expect(light.surface2).toBe("#F5EDE3"));
  test("oat is #E8DDD0", () => expect(light.oat).toBe("#E8DDD0"));
  test("rule is #D4C8B8", () => expect(light.rule).toBe("#D4C8B8"));
  test("ink is #2A1F1A", () => expect(light.ink).toBe("#2A1F1A"));
  test("inkSoft is #5A4D42", () => expect(light.inkSoft).toBe("#5A4D42"));
  test("muted is #7D7068", () => expect(light.muted).toBe("#7D7068"));
  test("accent is #8B2252", () => expect(light.accent).toBe("#8B2252"));
  test("olive is #5A6B40", () => expect(light.olive).toBe("#5A6B40"));
  test("codeBg is #180810", () => expect(light.codeBg).toBe("#180810"));
  test("codeFg is #DDD3C7", () => expect(light.codeFg).toBe("#DDD3C7"));
});

describe("claret preset is an alias for claret-dark", () => {
  test("THEME_PRESETS.claret is byte-equal to THEME_PRESETS['claret-dark']", () => {
    expect(THEME_PRESETS.claret).toEqual(THEME_PRESETS["claret-dark"]);
  });

  test("claret.bg matches claret-dark.bg (#180810)", () => {
    expect(THEME_PRESETS.claret.bg).toBe("#180810");
  });

  test("themeFromPreset('claret') and themeFromPreset('claret-dark') return identical palettes", () => {
    expect(themeFromPreset("claret").colors).toEqual(themeFromPreset("claret-dark").colors);
  });
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

describe("defaultTheme", () => {
  test("defaultTheme().colors.bg is claret-dark bg #180810", () => {
    expect(defaultTheme().colors.bg).toBe("#180810");
  });

  test("defaultTheme().colors.accent is claret-dark accent #C75B7A", () => {
    expect(defaultTheme().colors.accent).toBe("#C75B7A");
  });

  test("defaultTheme() returns claret-dark preset", () => {
    expect(defaultTheme().colors).toEqual(THEME_PRESETS["claret-dark"]);
  });
});

describe("isThemePresetName", () => {
  test("returns true for 'claret'", () => expect(isThemePresetName("claret")).toBe(true));
  test("returns true for 'claret-dark'", () => expect(isThemePresetName("claret-dark")).toBe(true));
  test("returns true for 'claret-light'", () =>
    expect(isThemePresetName("claret-light")).toBe(true));
  test("returns true for 'warm'", () => expect(isThemePresetName("warm")).toBe(true));
  test("returns true for 'cool'", () => expect(isThemePresetName("cool")).toBe(true));
  test("returns true for 'mono'", () => expect(isThemePresetName("mono")).toBe(true));
  test("returns true for 'paper'", () => expect(isThemePresetName("paper")).toBe(true));
  test("returns false for 'claret-mid'", () => expect(isThemePresetName("claret-mid")).toBe(false));
  test("returns false for unknown string", () => expect(isThemePresetName("galaxy")).toBe(false));
  test("returns false for empty string", () => expect(isThemePresetName("")).toBe(false));
  test("returns false for capitalized name", () => expect(isThemePresetName("Warm")).toBe(false));
});

describe("themeFromPreset", () => {
  test("returns claret-dark theme by default (undefined)", () => {
    const theme = themeFromPreset(undefined);
    expect(theme.colors).toEqual(THEME_PRESETS["claret-dark"]);
  });

  test("returns claret-dark theme for unknown preset name", () => {
    const theme = themeFromPreset("nonexistent");
    expect(theme.colors).toEqual(THEME_PRESETS["claret-dark"]);
  });

  test("themeFromPreset() (no arg) returns claret-dark", () => {
    const theme = themeFromPreset();
    expect(theme.colors).toEqual(THEME_PRESETS["claret-dark"]);
  });

  test("themeFromPreset('xxx') returns claret-dark", () => {
    const theme = themeFromPreset("xxx");
    expect(theme.colors).toEqual(THEME_PRESETS["claret-dark"]);
  });

  test("returns warm preset colors for 'warm'", () => {
    const theme = themeFromPreset("warm");
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

  test("returns claret-dark for 'claret' (alias)", () => {
    const theme = themeFromPreset("claret");
    expect(theme.colors).toEqual(THEME_PRESETS["claret-dark"]);
  });

  test("returns claret-dark for 'claret-dark'", () => {
    const theme = themeFromPreset("claret-dark");
    expect(theme.colors).toEqual(THEME_PRESETS["claret-dark"]);
  });

  test("returns claret-light for 'claret-light' (light palette, bg #FDF8F3)", () => {
    const theme = themeFromPreset("claret-light");
    expect(theme.colors).toEqual(THEME_PRESETS["claret-light"]);
    expect(theme.colors.bg).toBe("#FDF8F3");
  });

  test("includes standard font stacks", () => {
    const theme = themeFromPreset("cool");
    expect(theme.fonts.serif).toContain("serif");
    expect(theme.fonts.sans).toContain("sans-serif");
    expect(theme.fonts.mono).toContain("monospace");
  });

  test("all presets share the same font stacks", () => {
    const dark = themeFromPreset("claret-dark");
    const light = themeFromPreset("claret-light");
    const warm = themeFromPreset("warm");
    const cool = themeFromPreset("cool");
    const mono = themeFromPreset("mono");
    const paper = themeFromPreset("paper");
    expect(light.fonts).toEqual(dark.fonts);
    expect(warm.fonts).toEqual(dark.fonts);
    expect(cool.fonts).toEqual(dark.fonts);
    expect(mono.fonts).toEqual(dark.fonts);
    expect(paper.fonts).toEqual(dark.fonts);
  });

  test("backward-compat: themeFromPreset('warm') still returns warm hexes", () => {
    const theme = themeFromPreset("warm");
    expect(theme.colors.bg).toBe("#FAF9F5");
    expect(theme.colors.accent).toBe("#D97757");
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

  test("warm palette hex values unchanged after adding claret variants", () => {
    expect(THEME_PRESETS.warm.bg).toBe("#FAF9F5");
    expect(THEME_PRESETS.warm.accent).toBe("#D97757");
    expect(THEME_PRESETS.warm.codeBg).toBe("#141413");
  });
});
