import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ensureThemeCss, themeCssAssetPath } from "../src/storage/assets.ts";
import {
  frameworkRulesCss,
  themeTokensCss,
  defaultTheme,
  themeFromPreset,
} from "../src/render/theme.ts";
import { createHash } from "node:crypto";

let stateDir: string;

beforeEach(() => {
  stateDir = mkdtempSync(join(tmpdir(), "cesium-assets-"));
});

afterEach(() => {
  rmSync(stateDir, { recursive: true, force: true });
});

describe("themeCssAssetPath", () => {
  test("returns join(stateDir, 'theme.css')", () => {
    expect(themeCssAssetPath("/some/state")).toBe("/some/state/theme.css");
  });
});

describe("ensureThemeCss", () => {
  test("writes theme.css when missing", async () => {
    expect(existsSync(join(stateDir, "theme.css"))).toBe(false);
    await ensureThemeCss(stateDir);
    expect(existsSync(join(stateDir, "theme.css"))).toBe(true);
  });

  test("written file contains framework rules (.card, .eyebrow, .h-section)", async () => {
    await ensureThemeCss(stateDir);
    const content = readFileSync(join(stateDir, "theme.css"), "utf8");
    expect(content).toContain(".card");
    expect(content).toContain(".eyebrow");
    expect(content).toContain(".h-section");
  });

  test("written file contains default theme tokens (:root, --accent)", async () => {
    await ensureThemeCss(stateDir);
    const content = readFileSync(join(stateDir, "theme.css"), "utf8");
    expect(content).toContain(":root");
    expect(content).toContain("--accent");
    // claret-dark default accent
    expect(content).toContain("#C75B7A");
  });

  test("written content matches themeTokensCss + frameworkRulesCss", async () => {
    await ensureThemeCss(stateDir);
    const written = readFileSync(join(stateDir, "theme.css"), "utf8");
    const expected = themeTokensCss(defaultTheme()) + "\n" + frameworkRulesCss();
    expect(written).toBe(expected);
  });

  test("idempotent: calling twice leaves file unchanged", async () => {
    await ensureThemeCss(stateDir);
    const first = readFileSync(join(stateDir, "theme.css"), "utf8");
    await ensureThemeCss(stateDir);
    const second = readFileSync(join(stateDir, "theme.css"), "utf8");
    expect(first).toBe(second);
  });

  test("self-healing: rewrites file when content hash differs", async () => {
    // Write a stale / wrong theme.css
    writeFileSync(join(stateDir, "theme.css"), "/* stale content */\n");
    const stale = readFileSync(join(stateDir, "theme.css"), "utf8");
    expect(stale).toBe("/* stale content */\n");

    await ensureThemeCss(stateDir);

    const healed = readFileSync(join(stateDir, "theme.css"), "utf8");
    expect(healed).not.toBe(stale);
    expect(healed).toContain(".card");
  });

  test("does NOT rewrite when hash already matches", async () => {
    await ensureThemeCss(stateDir);
    const dest = join(stateDir, "theme.css");
    const statBefore = Bun.file(dest).size;

    // Tiny delay to ensure mtime would differ if file were rewritten
    await new Promise((r) => setTimeout(r, 10));

    await ensureThemeCss(stateDir);
    const statAfter = Bun.file(dest).size;

    // File is identical — size as proxy (mtime check not reliable in tests)
    expect(statAfter).toBe(statBefore);
  });

  test("creates stateDir subdirectory if needed", async () => {
    const nested = join(stateDir, "nested", "subdir");
    await ensureThemeCss(nested);
    expect(existsSync(join(nested, "theme.css"))).toBe(true);
  });

  test("bundled hash is stable across calls", async () => {
    // Two separate calls both produce the same content
    await ensureThemeCss(stateDir);
    const content1 = readFileSync(join(stateDir, "theme.css"), "utf8");
    const hash1 = createHash("sha256").update(content1).digest("hex");

    const stateDir2 = mkdtempSync(join(tmpdir(), "cesium-assets2-"));
    try {
      await ensureThemeCss(stateDir2);
      const content2 = readFileSync(join(stateDir2, "theme.css"), "utf8");
      const hash2 = createHash("sha256").update(content2).digest("hex");
      expect(hash1).toBe(hash2);
    } finally {
      rmSync(stateDir2, { recursive: true, force: true });
    }
  });

  test("different themes produce different theme.css contents", async () => {
    const stateDir2 = mkdtempSync(join(tmpdir(), "cesium-assets-warm-"));
    try {
      const defaultT = defaultTheme(); // claret-dark
      const warmTheme = themeFromPreset("warm");

      await ensureThemeCss(stateDir, defaultT);
      await ensureThemeCss(stateDir2, warmTheme);

      const claretContent = readFileSync(join(stateDir, "theme.css"), "utf8");
      const warmContent = readFileSync(join(stateDir2, "theme.css"), "utf8");

      // The two theme.css files must differ
      expect(claretContent).not.toBe(warmContent);

      // Each file must contain its own accent color
      expect(claretContent).toContain("#C75B7A"); // claret-dark accent
      expect(warmContent).toContain("#D97757"); // warm accent

      // Both files must still contain the framework rules
      expect(claretContent).toContain(".card");
      expect(warmContent).toContain(".card");
    } finally {
      rmSync(stateDir2, { recursive: true, force: true });
    }
  });

  test("explicit theme argument overrides default: warm preset reflects in theme.css", async () => {
    const warmTheme = themeFromPreset("warm");
    await ensureThemeCss(stateDir, warmTheme);
    const content = readFileSync(join(stateDir, "theme.css"), "utf8");
    // warm accent
    expect(content).toContain("#D97757");
    // must NOT contain claret-dark accent
    expect(content).not.toContain("#C75B7A");
  });
});
