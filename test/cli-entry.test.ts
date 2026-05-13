import { test, expect } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// ─── Entry point tests via spawned subprocess ─────────────────────────────────

const CLI_PATH = join(import.meta.dir, "..", "src", "cli", "index.ts");

function runCli(args: string[]): { stdout: string; stderr: string; exitCode: number } {
  // Each call gets a fresh isolated state dir so stop/status operations never
  // touch the real user state dir (which could have a live PID file pointing
  // at a running opencode process).
  const isolatedStateDir = mkdtempSync(join(tmpdir(), "cesium-cli-test-"));
  const result = spawnSync("bun", ["run", CLI_PATH, ...args], {
    encoding: "utf8",
    timeout: 10_000,
    env: {
      ...process.env,
      CESIUM_STATE_DIR: isolatedStateDir,
      XDG_STATE_HOME: undefined,
      // Disable ANSI color so help assertions match plain text
      NO_COLOR: "1",
    },
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
  expect(stdout).toContain("artifact manager for opencode sessions");
  // Lists all subcommands
  expect(stdout).toContain("ls");
  expect(stdout).toContain("open");
  expect(stdout).toContain("serve");
  expect(stdout).toContain("stop");
  expect(stdout).toContain("restart");
  expect(stdout).toContain("prune");
  expect(stdout).toContain("theme");
});

test("cesium with no arguments prints help and exits non-zero", () => {
  const { stdout, exitCode } = runCli([]);
  // Citty prints help and exits non-zero when no subcommand is given.
  expect(exitCode).not.toBe(0);
  expect(stdout).toContain("artifact manager for opencode sessions");
});

test("cesium ls --help exits 0 and shows ls usage", () => {
  const { stdout, exitCode } = runCli(["ls", "--help"]);
  expect(exitCode).toBe(0);
  expect(stdout).toContain("cesium ls");
  expect(stdout).toContain("--all");
  expect(stdout).toContain("--json");
  expect(stdout).toContain("--limit");
});

test("cesium stop is recognized as a valid command", () => {
  // No PID file → exits 0 with "no cesium server running"
  const { stdout, exitCode } = runCli(["stop"]);
  expect(exitCode).toBe(0);
  expect(stdout).toContain("no cesium server running");
});

test("cesium stop --help exits 0 and prints stop usage", () => {
  const { stdout, exitCode } = runCli(["stop", "--help"]);
  expect(exitCode).toBe(0);
  expect(stdout).toContain("cesium stop");
  expect(stdout).toContain("--force");
  expect(stdout).toContain("--timeout");
});

test("cesium restart --help exits 0", () => {
  const { exitCode } = runCli(["restart", "--help"]);
  expect(exitCode).toBe(0);
});

test("cesium theme --help lists show and apply subcommands", () => {
  const { stdout, exitCode } = runCli(["theme", "--help"]);
  expect(exitCode).toBe(0);
  expect(stdout).toContain("show");
  expect(stdout).toContain("apply");
});

test("cesium --version prints the version and exits 0", () => {
  const { stdout, exitCode } = runCli(["--version"]);
  expect(exitCode).toBe(0);
  expect(stdout).toMatch(/^\d+\.\d+\.\d+\s*$/);
});

test("cesium -v prints the version and exits 0", () => {
  const { stdout, exitCode } = runCli(["-v"]);
  expect(exitCode).toBe(0);
  expect(stdout).toMatch(/^\d+\.\d+\.\d+\s*$/);
});
