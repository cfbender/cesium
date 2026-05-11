import { test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stopServer } from "../src/server/stop.ts";
import type { StopServerArgs } from "../src/server/stop.ts";

// ─── Helpers ──────────────────────────────────────────────────────────────────

type KillCall = { pid: number; signal: NodeJS.Signals };

function writePid(stateDir: string, pid: number, port = 3030): void {
  mkdirSync(stateDir, { recursive: true });
  writeFileSync(
    join(stateDir, ".server.pid"),
    JSON.stringify({ pid, port, hostname: "127.0.0.1", startedAt: new Date().toISOString() }),
    "utf8",
  );
}

function makeArgs(stateDir: string, overrides?: Partial<StopServerArgs>): StopServerArgs {
  return {
    stateDir,
    sleep: () => Promise.resolve(),
    ...overrides,
  };
}

// ─── Test lifecycle ───────────────────────────────────────────────────────────

let stateDir: string;

beforeEach(() => {
  stateDir = mkdtempSync(join(tmpdir(), "cesium-stopserver-"));
});

afterEach(() => {
  rmSync(stateDir, { recursive: true, force: true });
});

// ─── Tests ────────────────────────────────────────────────────────────────────

test("stopServer: no PID file returns { kind: 'not-running' }", async () => {
  const outcome = await stopServer(makeArgs(stateDir));
  expect(outcome.kind).toBe("not-running");
});

test("stopServer: stale PID (isAlive=false) returns { kind: 'stale', pid }", async () => {
  writePid(stateDir, 99999999);
  const pidPath = join(stateDir, ".server.pid");
  expect(existsSync(pidPath)).toBe(true);

  const outcome = await stopServer(makeArgs(stateDir, { isAlive: () => false }));

  expect(outcome.kind).toBe("stale");
  if (outcome.kind === "stale") {
    expect(outcome.pid).toBe(99999999);
  }
  expect(existsSync(pidPath)).toBe(false);
});

test("stopServer: SIGTERM success returns stopped with SIGTERM signal", async () => {
  writePid(stateDir, 12345, 3030);

  const killCalls: KillCall[] = [];
  let alive = true;

  const outcome = await stopServer(
    makeArgs(stateDir, {
      isAlive: () => alive,
      killProcess: (pid, signal) => {
        killCalls.push({ pid, signal });
        if (signal === "SIGTERM") alive = false;
      },
    }),
  );

  expect(outcome.kind).toBe("stopped");
  if (outcome.kind === "stopped") {
    expect(outcome.pid).toBe(12345);
    expect(outcome.port).toBe(3030);
    expect(outcome.signal).toBe("SIGTERM");
  }
  expect(killCalls.some((c) => c.signal === "SIGTERM")).toBe(true);
  expect(existsSync(join(stateDir, ".server.pid"))).toBe(false);
});

test("stopServer: SIGTERM timeout → SIGKILL escalation, returns stopped with SIGKILL signal", async () => {
  writePid(stateDir, 12345, 3030);

  const killCalls: KillCall[] = [];

  const outcome = await stopServer(
    makeArgs(stateDir, {
      isAlive: () => true, // never dies → forces SIGKILL
      killProcess: (pid, signal) => {
        killCalls.push({ pid, signal });
      },
      timeoutMs: 0,
    }),
  );

  expect(outcome.kind).toBe("stopped");
  if (outcome.kind === "stopped") {
    expect(outcome.signal).toBe("SIGKILL");
  }
  const signals = killCalls.map((c) => c.signal);
  expect(signals).toContain("SIGTERM");
  expect(signals).toContain("SIGKILL");
});

test("stopServer: force=true sends SIGKILL immediately, no SIGTERM", async () => {
  writePid(stateDir, 12345, 3030);

  const killCalls: KillCall[] = [];

  const outcome = await stopServer(
    makeArgs(stateDir, {
      isAlive: () => true,
      killProcess: (pid, signal) => {
        killCalls.push({ pid, signal });
      },
      force: true,
    }),
  );

  expect(outcome.kind).toBe("stopped");
  if (outcome.kind === "stopped") {
    expect(outcome.signal).toBe("SIGKILL");
  }
  const signals = killCalls.map((c) => c.signal);
  expect(signals).not.toContain("SIGTERM");
  expect(signals).toContain("SIGKILL");
});

test("stopServer: killProcess throws ESRCH — treated as success", async () => {
  writePid(stateDir, 12345, 3030);

  const outcome = await stopServer(
    makeArgs(stateDir, {
      isAlive: () => true,
      killProcess: () => {
        const e = Object.assign(new Error("No such process"), { code: "ESRCH" });
        throw e;
      },
      force: true,
    }),
  );

  expect(outcome.kind).toBe("stopped");
});

test("stopServer: killProcess throws EPERM — returns { kind: 'permission-denied', pid }", async () => {
  writePid(stateDir, 12345, 3030);

  const outcome = await stopServer(
    makeArgs(stateDir, {
      isAlive: () => true,
      killProcess: () => {
        const e = Object.assign(new Error("Operation not permitted"), { code: "EPERM" });
        throw e;
      },
      force: true,
    }),
  );

  expect(outcome.kind).toBe("permission-denied");
  if (outcome.kind === "permission-denied") {
    expect(outcome.pid).toBe(12345);
  }
});

test("stopServer: EPERM on SIGTERM during graceful stop returns permission-denied", async () => {
  writePid(stateDir, 12345, 3030);

  const outcome = await stopServer(
    makeArgs(stateDir, {
      isAlive: () => true,
      killProcess: () => {
        const e = Object.assign(new Error("Operation not permitted"), { code: "EPERM" });
        throw e;
      },
      force: false,
    }),
  );

  expect(outcome.kind).toBe("permission-denied");
});

test("stopServer: idempotent — second call with no PID file returns not-running", async () => {
  // First call: no PID file
  const outcome1 = await stopServer(makeArgs(stateDir));
  expect(outcome1.kind).toBe("not-running");

  // Second call: still no PID file
  const outcome2 = await stopServer(makeArgs(stateDir));
  expect(outcome2.kind).toBe("not-running");
});

test("stopServer: stopped outcome includes correct pid and port from PID file", async () => {
  writePid(stateDir, 55555, 4444);

  let alive = true;
  const outcome = await stopServer(
    makeArgs(stateDir, {
      isAlive: () => alive,
      killProcess: (_pid, signal) => {
        if (signal === "SIGTERM") alive = false;
      },
    }),
  );

  expect(outcome.kind).toBe("stopped");
  if (outcome.kind === "stopped") {
    expect(outcome.pid).toBe(55555);
    expect(outcome.port).toBe(4444);
  }
});
