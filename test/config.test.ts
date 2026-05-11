import { test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defaultConfig, loadConfig } from "../src/config.ts";
import { resolveDisplayHost } from "../src/tools/publish.ts";

let workDir: string;
beforeEach(() => {
  workDir = mkdtempSync(join(tmpdir(), "cesium-config-"));
});
afterEach(() => {
  rmSync(workDir, { recursive: true, force: true });
});

test("defaultConfig sets hostname to 127.0.0.1", () => {
  const cfg = defaultConfig({});
  expect(cfg.hostname).toBe("127.0.0.1");
});

test("loadConfig respects hostname from file", () => {
  const path = join(workDir, "cesium.json");
  writeFileSync(path, JSON.stringify({ hostname: "0.0.0.0" }));
  const cfg = loadConfig({ configPath: path, env: {} });
  expect(cfg.hostname).toBe("0.0.0.0");
});

test("loadConfig ignores empty hostname strings", () => {
  const path = join(workDir, "cesium.json");
  writeFileSync(path, JSON.stringify({ hostname: "" }));
  const cfg = loadConfig({ configPath: path, env: {} });
  expect(cfg.hostname).toBe("127.0.0.1");
});

test("CESIUM_HOSTNAME env overrides file config", () => {
  const path = join(workDir, "cesium.json");
  writeFileSync(path, JSON.stringify({ hostname: "10.0.0.5" }));
  const cfg = loadConfig({ configPath: path, env: { CESIUM_HOSTNAME: "0.0.0.0" } });
  expect(cfg.hostname).toBe("0.0.0.0");
});

test("resolveDisplayHost translates 127.0.0.1 to localhost", () => {
  expect(resolveDisplayHost("127.0.0.1")).toBe("localhost");
});

test("resolveDisplayHost translates ::1 to localhost", () => {
  expect(resolveDisplayHost("::1")).toBe("localhost");
});

test("resolveDisplayHost passes through named hosts", () => {
  expect(resolveDisplayHost("example.local")).toBe("example.local");
});

test("resolveDisplayHost on 0.0.0.0 returns a usable host", () => {
  const result = resolveDisplayHost("0.0.0.0");
  // Either a LAN IPv4 (e.g. 10.x / 192.168.x / 172.x) or 'localhost' if no
  // non-loopback iface available. It must NOT be the literal "0.0.0.0".
  expect(result).not.toBe("0.0.0.0");
  expect(result.length).toBeGreaterThan(0);
});

test("defaultConfig does not set themePreset (undefined)", () => {
  const cfg = defaultConfig({});
  expect(cfg.themePreset).toBeUndefined();
});

test("loadConfig reads themePreset from file", () => {
  const path = join(workDir, "cesium.json");
  writeFileSync(path, JSON.stringify({ themePreset: "paper" }));
  const cfg = loadConfig({ configPath: path, env: {} });
  expect(cfg.themePreset).toBe("paper");
});

test("CESIUM_THEME_PRESET env overrides file config", () => {
  const path = join(workDir, "cesium.json");
  writeFileSync(path, JSON.stringify({ themePreset: "paper" }));
  const cfg = loadConfig({ configPath: path, env: { CESIUM_THEME_PRESET: "mono" } });
  expect(cfg.themePreset).toBe("mono");
});

test("invalid themePreset value is stored as-is (validated at use site)", () => {
  const path = join(workDir, "cesium.json");
  writeFileSync(path, JSON.stringify({ themePreset: "rainbow-unicorn" }));
  const cfg = loadConfig({ configPath: path, env: {} });
  expect(cfg.themePreset).toBe("rainbow-unicorn");
});
