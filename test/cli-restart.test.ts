import { test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runRestart } from "../src/cli/commands/restart.ts";
import type { RestartArgs, RestartContext } from "../src/cli/commands/restart.ts";
import type { CesiumConfig } from "../src/config.ts";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeConfig(stateDir: string): CesiumConfig {
  return {
    stateDir,
    port: 3030,
    portMax: 3050,
    idleTimeoutMs: 1800000,
    hostname: "127.0.0.1",
  };
}

/** A serveCommand stub that resolves immediately so tests don't block. */
function mockServe(): Promise<number> {
  return Promise.resolve(0);
}

function captureCtx(
  stateDir: string,
  overrides?: Partial<RestartContext>,
): { out: string; err: string } & Partial<RestartContext> &
  Required<Pick<RestartContext, "stdout" | "stderr" | "loadConfig" | "sleep" | "serveImpl">> {
  let out = "";
  let err = "";
  const obj = {
    stdout: {
      write: (s: string) => {
        out += s;
      },
    },
    stderr: {
      write: (s: string) => {
        err += s;
      },
    },
    loadConfig: () => makeConfig(stateDir),
    sleep: overrides?.sleep ?? ((_ms: number) => Promise.resolve()),
    serveImpl: overrides?.serveImpl ?? mockServe,
    get out() {
      return out;
    },
    get err() {
      return err;
    },
    ...(overrides?.isAlive !== undefined ? { isAlive: overrides.isAlive } : {}),
    ...(overrides?.killProcess !== undefined ? { killProcess: overrides.killProcess } : {}),
  };
  return obj;
}

function writePid(stateDir: string, pid: number, port = 3030): void {
  mkdirSync(stateDir, { recursive: true });
  writeFileSync(
    join(stateDir, ".server.pid"),
    JSON.stringify({ pid, port, hostname: "127.0.0.1", startedAt: new Date().toISOString() }),
    "utf8",
  );
}

// ─── Test lifecycle ───────────────────────────────────────────────────────────

let stateDir: string;

beforeEach(() => {
  stateDir = mkdtempSync(join(tmpdir(), "cesium-restart-"));
});

afterEach(() => {
  rmSync(stateDir, { recursive: true, force: true });
});

// ─── Tests ────────────────────────────────────────────────────────────────────

const baseArgs: RestartArgs = { force: false, timeoutMs: 3000 };

test("restart: stop returns 0 (live PID killed) → serve is called", async () => {
  writePid(stateDir, 12345, 3030);

  let serveCalled = false;
  let alive = true;

  const ctx = captureCtx(stateDir, {
    isAlive: () => alive,
    killProcess: (_pid, signal) => {
      if (signal === "SIGTERM") alive = false;
    },
    sleep: () => Promise.resolve(),
    serveImpl: () => {
      serveCalled = true;
      return Promise.resolve(0);
    },
  });

  const code = await runRestart(baseArgs, ctx);

  expect(code).toBe(0);
  expect(serveCalled).toBe(true);
  expect(ctx.out).toContain("stopped cesium server (pid 12345");
  expect(ctx.out).toContain("starting new cesium server...");
});

test("restart: stop returns 2 (EPERM) → serve is NOT called, restart returns 2", async () => {
  writePid(stateDir, 12345, 3030);

  let serveCalled = false;

  const ctx = captureCtx(stateDir, {
    isAlive: () => true,
    killProcess: (_pid, _signal) => {
      const e = Object.assign(new Error("Operation not permitted"), { code: "EPERM" });
      throw e;
    },
    sleep: () => Promise.resolve(),
    serveImpl: () => {
      serveCalled = true;
      return Promise.resolve(0);
    },
  });

  const code = await runRestart({ ...baseArgs, force: true }, ctx);

  expect(code).toBe(2);
  expect(serveCalled).toBe(false);
  expect(ctx.out).not.toContain("starting new cesium server...");
});

test("restart: no running server (stop returns 0 with 'no server running') → serve is still called", async () => {
  // No PID file — stop will output "no cesium server running" and return 0
  let serveCalled = false;

  const ctx = captureCtx(stateDir, {
    sleep: () => Promise.resolve(),
    serveImpl: () => {
      serveCalled = true;
      return Promise.resolve(0);
    },
  });

  const code = await runRestart(baseArgs, ctx);

  expect(code).toBe(0);
  expect(serveCalled).toBe(true);
  expect(ctx.out).toContain("no cesium server running");
  expect(ctx.out).toContain("starting new cesium server...");
});

test("restart: passes --force through to stop", async () => {
  writePid(stateDir, 12345, 3030);

  const killCalls: { pid: number; signal: NodeJS.Signals }[] = [];

  const ctx = captureCtx(stateDir, {
    isAlive: () => true,
    killProcess: (pid, signal) => {
      killCalls.push({ pid, signal });
    },
    sleep: () => Promise.resolve(),
    serveImpl: () => Promise.resolve(0),
  });

  await runRestart({ ...baseArgs, force: true }, ctx);

  // With --force, SIGTERM should NOT be in the kill calls
  expect(killCalls.map((c) => c.signal)).not.toContain("SIGTERM");
  expect(killCalls.map((c) => c.signal)).toContain("SIGKILL");
});

test("restart: stale PID file → cleans up and starts new server", async () => {
  writePid(stateDir, 99999999, 3030);

  let serveCalled = false;

  const ctx = captureCtx(stateDir, {
    isAlive: () => false,
    sleep: () => Promise.resolve(),
    serveImpl: () => {
      serveCalled = true;
      return Promise.resolve(0);
    },
  });

  const code = await runRestart(baseArgs, ctx);

  expect(code).toBe(0);
  expect(serveCalled).toBe(true);
  expect(ctx.out).toContain("stale PID file removed");
  expect(ctx.out).toContain("starting new cesium server...");
});
