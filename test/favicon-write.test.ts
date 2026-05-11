import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeFaviconSvg, faviconSvgPath } from "../src/storage/favicon-write.ts";
import { FAVICON_SVG } from "../src/render/favicon.ts";

let stateDir: string;

beforeEach(() => {
  stateDir = mkdtempSync(join(tmpdir(), "cesium-favicon-write-"));
});

afterEach(() => {
  rmSync(stateDir, { recursive: true, force: true });
});

describe("faviconSvgPath", () => {
  test("returns join(stateDir, 'favicon.svg')", () => {
    expect(faviconSvgPath("/some/state")).toBe("/some/state/favicon.svg");
  });
});

describe("writeFaviconSvg", () => {
  test("writes a file at <stateDir>/favicon.svg", async () => {
    await writeFaviconSvg(stateDir);
    expect(existsSync(join(stateDir, "favicon.svg"))).toBe(true);
  });

  test("returns the absolute path", async () => {
    const path = await writeFaviconSvg(stateDir);
    expect(path).toBe(join(stateDir, "favicon.svg"));
  });

  test("content is the FAVICON_SVG constant", async () => {
    await writeFaviconSvg(stateDir);
    const content = readFileSync(join(stateDir, "favicon.svg"), "utf8");
    expect(content).toBe(FAVICON_SVG);
  });

  test("content is valid svg with the cesium element marker", async () => {
    await writeFaviconSvg(stateDir);
    const content = readFileSync(join(stateDir, "favicon.svg"), "utf8");
    expect(content).toContain("<svg");
    expect(content).toContain("</svg>");
    // Atomic number + symbol
    expect(content).toContain(">55<");
    expect(content).toContain(">Cs<");
    // Claret-dark palette
    expect(content).toContain("#180810"); // bg
    expect(content).toContain("#C75B7A"); // accent
    expect(content).toContain("#DDD3C7"); // ink
  });

  test("idempotent: writing twice produces identical content", async () => {
    await writeFaviconSvg(stateDir);
    const first = readFileSync(join(stateDir, "favicon.svg"), "utf8");
    await writeFaviconSvg(stateDir);
    const second = readFileSync(join(stateDir, "favicon.svg"), "utf8");
    expect(first).toBe(second);
  });
});
