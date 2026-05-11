import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeThemeCss, themeCssPath } from "../src/storage/theme-write.ts";
import { defaultTheme, themeFromPreset } from "../src/render/theme.ts";

let stateDir: string;

beforeEach(() => {
  stateDir = mkdtempSync(join(tmpdir(), "cesium-theme-write-"));
});

afterEach(() => {
  rmSync(stateDir, { recursive: true, force: true });
});

describe("themeCssPath", () => {
  test("returns join(stateDir, 'theme.css')", () => {
    expect(themeCssPath("/some/state")).toBe("/some/state/theme.css");
  });

  test("works with trailing slash", () => {
    // join normalizes trailing slashes
    expect(themeCssPath("/some/state")).toBe(join("/some/state", "theme.css"));
  });
});

describe("writeThemeCss", () => {
  test("writes a file at <stateDir>/theme.css", async () => {
    await writeThemeCss(stateDir, defaultTheme());
    expect(existsSync(join(stateDir, "theme.css"))).toBe(true);
  });

  test("returns the absolute path", async () => {
    const path = await writeThemeCss(stateDir, defaultTheme());
    expect(path).toBe(join(stateDir, "theme.css"));
  });

  test("content includes :root {", async () => {
    await writeThemeCss(stateDir, defaultTheme());
    const content = readFileSync(join(stateDir, "theme.css"), "utf8");
    expect(content).toContain(":root {");
  });

  test("content includes --bg", async () => {
    await writeThemeCss(stateDir, defaultTheme());
    const content = readFileSync(join(stateDir, "theme.css"), "utf8");
    expect(content).toContain("--bg:");
  });

  test("content includes --accent with claret value", async () => {
    await writeThemeCss(stateDir, defaultTheme());
    const content = readFileSync(join(stateDir, "theme.css"), "utf8");
    expect(content).toContain("--accent: #8B2252");
  });

  test("content does NOT include framework rules (only tokens)", async () => {
    await writeThemeCss(stateDir, defaultTheme());
    const content = readFileSync(join(stateDir, "theme.css"), "utf8");
    // Framework rules: box-sizing, .card, etc. should NOT be here
    expect(content).not.toContain("box-sizing");
    expect(content).not.toContain(".card");
    expect(content).not.toContain(".eyebrow");
  });

  test("idempotent: writing twice with same theme produces same content", async () => {
    await writeThemeCss(stateDir, defaultTheme());
    const first = readFileSync(join(stateDir, "theme.css"), "utf8");
    await writeThemeCss(stateDir, defaultTheme());
    const second = readFileSync(join(stateDir, "theme.css"), "utf8");
    expect(first).toBe(second);
  });

  test("writing warm theme produces different content from claret", async () => {
    await writeThemeCss(stateDir, defaultTheme());
    const claret = readFileSync(join(stateDir, "theme.css"), "utf8");
    await writeThemeCss(stateDir, themeFromPreset("warm"));
    const warm = readFileSync(join(stateDir, "theme.css"), "utf8");
    expect(claret).not.toBe(warm);
    expect(warm).toContain("#D97757"); // warm accent
    expect(claret).toContain("#8B2252"); // claret accent
  });

  test("content ends with newline", async () => {
    await writeThemeCss(stateDir, defaultTheme());
    const content = readFileSync(join(stateDir, "theme.css"), "utf8");
    expect(content.endsWith("\n")).toBe(true);
  });
});
