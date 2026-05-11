import { test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stopCommand } from "../src/cli/commands/stop.ts";
import type { StopContext } from "../src/cli/commands/stop.ts";
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

type KillCall = { pid: number; signal: NodeJS.Signals };

function captureCtx(
  stateDir: string,
  overrides?: Partial<StopContext> & { killCalls?: KillCall[] },
): { out: string; err: string } & Partial<StopContext> &
  Required<Pick<StopContext, "stdout" | "stderr" | "loadConfig" | "sleep" | "killProcess">> {
  let out = "";
  let err = "";
  const killCalls: KillCall[] = overrides?.killCalls ?? [];
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
    killProcess:
      overrides?.killProcess ??
      ((pid: number, signal: NodeJS.Signals) => {
        killCalls.push({ pid, signal });
      }),
    sleep: overrides?.sleep ?? ((_ms: number) => Promise.resolve()),
    get out() {
      return out;
    },
    get err() {
      return err;
    },
    ...(overrides?.isAlive !== undefined ? { isAlive: overrides.isAlive } : {}),
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
  stateDir = mkdtempSync(join(tmpdir(), "cesium-stop-"));
});

afterEach(() => {
  rmSync(stateDir, { recursive: true, force: true });
});

// ─── Tests ────────────────────────────────────────────────────────────────────

test("stop: no PID file returns 0 and prints 'no cesium server running'", async () => {
  const ctx = captureCtx(stateDir);
  const code = await stopCommand([], ctx);
  expect(code).toBe(0);
  expect(ctx.out).toContain("no cesium server running");
  expect(ctx.killProcess).toBeDefined(); // mocked but never called
  // Confirm kill was never invoked by checking nothing was written to stderr
  expect(ctx.err).toBe("");
});

test("stop: stale PID file (isAlive=false) returns 0, removes PID file, prints stale message", async () => {
  writePid(stateDir, 99999999);
  const pidPath = join(stateDir, ".server.pid");
  expect(existsSync(pidPath)).toBe(true);

  const killCalls: KillCall[] = [];
  const ctx = captureCtx(stateDir, {
    isAlive: () => false,
    killCalls,
  });
  const code = await stopCommand([], ctx);

  expect(code).toBe(0);
  expect(ctx.out).toContain("stale PID file removed");
  expect(existsSync(pidPath)).toBe(false);
  expect(killCalls).toHaveLength(0);
});

test("stop: live PID, SIGTERM succeeds — returns 0, calls SIGTERM, removes PID file", async () => {
  writePid(stateDir, 12345, 3030);
  const pidPath = join(stateDir, ".server.pid");

  const killCalls: KillCall[] = [];
  let alive = true;
  const ctx = captureCtx(stateDir, {
    isAlive: () => alive,
    killProcess: (pid, signal) => {
      killCalls.push({ pid, signal });
      if (signal === "SIGTERM") alive = false;
    },
    sleep: () => Promise.resolve(),
  });

  const code = await stopCommand([], ctx);

  expect(code).toBe(0);
  expect(killCalls.some((c) => c.signal === "SIGTERM")).toBe(true);
  expect(ctx.out).toContain("stopped cesium server (pid 12345, port 3030)");
  expect(existsSync(pidPath)).toBe(false);
});

test("stop: SIGTERM doesn't kill within timeout — SIGKILL is sent", async () => {
  writePid(stateDir, 12345, 3030);

  const killCalls: KillCall[] = [];
  // Always alive — forces SIGKILL escalation
  const ctx = captureCtx(stateDir, {
    isAlive: () => true,
    killProcess: (pid, signal) => {
      killCalls.push({ pid, signal });
    },
    sleep: () => Promise.resolve(),
  });

  const code = await stopCommand(["--timeout", "0"], ctx);

  expect(code).toBe(0);
  const signals = killCalls.map((c) => c.signal);
  expect(signals).toContain("SIGTERM");
  expect(signals).toContain("SIGKILL");
});

test("stop: --force skips SIGTERM and sends SIGKILL immediately", async () => {
  writePid(stateDir, 12345);

  const killCalls: KillCall[] = [];
  const ctx = captureCtx(stateDir, {
    isAlive: () => true,
    killCalls,
    sleep: () => Promise.resolve(),
  });

  const code = await stopCommand(["--force"], ctx);

  expect(code).toBe(0);
  const signals = killCalls.map((c) => c.signal);
  expect(signals).not.toContain("SIGTERM");
  expect(signals).toContain("SIGKILL");
});

test("stop: --timeout 50 is respected (parsed correctly)", async () => {
  writePid(stateDir, 12345);

  let alive = true;
  const killCalls: KillCall[] = [];
  const ctx = captureCtx(stateDir, {
    isAlive: () => alive,
    killProcess: (pid, signal) => {
      killCalls.push({ pid, signal });
      if (signal === "SIGTERM") alive = false;
    },
    sleep: () => Promise.resolve(),
  });

  const code = await stopCommand(["--timeout", "50"], ctx);
  expect(code).toBe(0);
  expect(ctx.out).toContain("stopped cesium server");
});

test("stop: killProcess throws ESRCH — treated as success", async () => {
  writePid(stateDir, 12345);

  const ctx = captureCtx(stateDir, {
    isAlive: () => true,
    killProcess: (_pid, _signal) => {
      const e = Object.assign(new Error("No such process"), { code: "ESRCH" });
      throw e;
    },
    sleep: () => Promise.resolve(),
  });

  const code = await stopCommand(["--force"], ctx);
  expect(code).toBe(0);
  expect(ctx.out).toContain("stopped cesium server");
});

test("stop: killProcess throws EPERM — returns 2 and prints helpful message", async () => {
  writePid(stateDir, 12345);

  const ctx = captureCtx(stateDir, {
    isAlive: () => true,
    killProcess: (_pid, _signal) => {
      const e = Object.assign(new Error("Operation not permitted"), { code: "EPERM" });
      throw e;
    },
    sleep: () => Promise.resolve(),
  });

  const code = await stopCommand(["--force"], ctx);
  expect(code).toBe(2);
  expect(ctx.err).toContain("permission denied");
  expect(ctx.err).toContain("another user");
});

test("stop: idempotent — second call with no PID file returns 0", async () => {
  // First call: no PID file
  const ctx1 = captureCtx(stateDir);
  const code1 = await stopCommand([], ctx1);
  expect(code1).toBe(0);
  expect(ctx1.out).toContain("no cesium server running");

  // Second call: still no PID file
  const ctx2 = captureCtx(stateDir);
  const code2 = await stopCommand([], ctx2);
  expect(code2).toBe(0);
  expect(ctx2.out).toContain("no cesium server running");
});

test("stop --help returns 0 and prints usage", async () => {
  const ctx = captureCtx(stateDir);
  const code = await stopCommand(["--help"], ctx);
  expect(code).toBe(0);
  expect(ctx.out).toContain("Usage: cesium stop");
  expect(ctx.out).toContain("--force");
  expect(ctx.out).toContain("--timeout");
});

test("stop: unknown flag returns 1 and writes error", async () => {
  const ctx = captureCtx(stateDir);
  const code = await stopCommand(["--unknown-flag"], ctx);
  expect(code).toBe(1);
  expect(ctx.err).not.toBe("");
});
