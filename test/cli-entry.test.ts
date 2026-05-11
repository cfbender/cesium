import { test, expect } from "bun:test";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

// ─── Entry point tests via spawned subprocess ─────────────────────────────────

const CLI_PATH = join(import.meta.dir, "..", "src", "cli", "index.ts");

function runCli(args: string[]): { stdout: string; stderr: string; exitCode: number } {
  const result = spawnSync("bun", ["run", CLI_PATH, ...args], {
    encoding: "utf8",
    timeout: 10_000,
  });
  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    exitCode: result.status ?? 1,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test("cesium --help prints help and exits 0", () => {
  const { stdout, exitCode } = runCli(["--help"]);
  expect(exitCode).toBe(0);
  expect(stdout).toContain("cesium — artifact manager");
  expect(stdout).toContain("ls");
  expect(stdout).toContain("open");
  expect(stdout).toContain("serve");
  expect(stdout).toContain("prune");
});

test("cesium with no arguments exits non-zero and prints help", () => {
  const { stdout, exitCode } = runCli([]);
  expect(exitCode).not.toBe(0);
  expect(stdout).toContain("cesium — artifact manager");
});

test("cesium unknown command exits 1 and mentions 'unknown command'", () => {
  const { stderr, exitCode } = runCli(["nonexistent"]);
  expect(exitCode).toBe(1);
  expect(stderr).toContain("unknown command");
});

test("cesium ls --help exits 0 and shows ls usage", () => {
  const { stdout, exitCode } = runCli(["ls", "--help"]);
  expect(exitCode).toBe(0);
  expect(stdout).toContain("Usage: cesium ls");
});
