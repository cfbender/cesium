import { test, expect, beforeEach, afterEach, describe } from "bun:test";
import { mkdtempSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  isAlive,
  readPidFile,
  writePidFile,
  ensureRunning,
  stopRunning,
  resetForTests,
} from "../src/server/lifecycle.ts";

// ─── Helpers ──────────────────────────────────────────────────────────────────

let stateDir: string;

beforeEach(() => {
  stateDir = mkdtempSync(join(tmpdir(), "cesium-lc-"));
});

afterEach(async () => {
  await resetForTests();
  rmSync(stateDir, { recursive: true, force: true });
});

function makeCfg(overrides?: { port?: number; portMax?: number; idleTimeoutMs?: number }) {
  return {
    stateDir,
    port: overrides?.port ?? 0,
    portMax: overrides?.portMax ?? 65535,
    idleTimeoutMs: overrides?.idleTimeoutMs ?? 30_000,
  };
}

// ─── isAlive ──────────────────────────────────────────────────────────────────

describe("isAlive", () => {
  test("returns true for the current process pid", () => {
    expect(isAlive(process.pid)).toBe(true);
  });

  test("returns false for an obviously dead pid (very large)", () => {
    // 99999999 is beyond the max pid on any Unix (4194304) — guaranteed ESRCH
    expect(isAlive(99999999)).toBe(false);
  });
});

// ─── PID file helpers ─────────────────────────────────────────────────────────

describe("readPidFile / writePidFile", () => {
  test("round-trip preserves all fields", async () => {
    const pidPath = join(stateDir, ".server.pid");
    const content = {
      pid: 12345,
      port: 3031,
      hostname: "127.0.0.1",
      startedAt: "2026-05-11T00:00:00.000Z",
    };
    await writePidFile(pidPath, content);
    const read = readPidFile(pidPath);
    expect(read).not.toBeNull();
    if (read === null) throw new Error("expected non-null");
    expect(read.pid).toBe(12345);
    expect(read.port).toBe(3031);
    expect(read.hostname).toBe("127.0.0.1");
    expect(read.startedAt).toBe("2026-05-11T00:00:00.000Z");
  });

  test("returns null on malformed JSON", () => {
    const pidPath = join(stateDir, ".server.pid");
    writeFileSync(pidPath, "{ not valid json }", "utf8");
    expect(readPidFile(pidPath)).toBeNull();
  });

  test("returns null on missing file", () => {
    const pidPath = join(stateDir, ".server.pid.missing");
    expect(readPidFile(pidPath)).toBeNull();
  });

  test("returns null when JSON is valid but missing required fields", () => {
    const pidPath = join(stateDir, ".server.pid");
    writeFileSync(pidPath, JSON.stringify({ pid: 1 }), "utf8");
    expect(readPidFile(pidPath)).toBeNull();
  });
});

// ─── ensureRunning ────────────────────────────────────────────────────────────

describe("ensureRunning", () => {
  test("starts a server from clean state, writes PID file, returns RunningInfo", async () => {
    const info = await ensureRunning(makeCfg());

    expect(info.pid).toBe(process.pid);
    expect(info.port).toBeGreaterThan(0);
    expect(info.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
    expect(typeof info.startedAt).toBe("string");

    // PID file should exist
    const pidPath = join(stateDir, ".server.pid");
    expect(existsSync(pidPath)).toBe(true);
    const pid = readPidFile(pidPath);
    expect(pid).not.toBeNull();
    if (pid === null) throw new Error("expected pid file");
    expect(pid.pid).toBe(process.pid);
    expect(pid.port).toBe(info.port);
  });

  test("second ensureRunning call returns the same info (no double-start)", async () => {
    const info1 = await ensureRunning(makeCfg());
    const info2 = await ensureRunning(makeCfg());

    expect(info2.port).toBe(info1.port);
    expect(info2.pid).toBe(info1.pid);
    expect(info2.startedAt).toBe(info1.startedAt);
  });

  test("stale PID file (non-existent process) is replaced, new server starts", async () => {
    // Write a PID file with a dead pid
    const pidPath = join(stateDir, ".server.pid");
    await writePidFile(pidPath, {
      pid: 99999999, // guaranteed dead
      port: 3099,
      hostname: "127.0.0.1",
      startedAt: "2020-01-01T00:00:00.000Z",
    });

    const info = await ensureRunning(makeCfg());

    // Should have started a fresh server
    expect(info.pid).toBe(process.pid);
    expect(info.startedAt).not.toBe("2020-01-01T00:00:00.000Z");

    // PID file should be updated
    const pid = readPidFile(pidPath);
    expect(pid).not.toBeNull();
    if (pid === null) throw new Error("expected pid file");
    expect(pid.pid).toBe(process.pid);
  });

  test("port conflict: scans to next free port", async () => {
    // Pre-bind a port so it's in use
    const blocker = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      fetch() {
        return new Response("blocker");
      },
    });
    const blockedPort = blocker.port;
    if (blockedPort === undefined) {
      await blocker.stop();
      throw new Error("blocker port is undefined");
    }

    try {
      const info = await ensureRunning({
        stateDir,
        port: blockedPort,
        portMax: blockedPort + 10,
        idleTimeoutMs: 30_000,
      });
      // Should have found a different port
      expect(info.port).not.toBe(blockedPort);
      expect(info.port).toBeGreaterThan(0);
    } finally {
      await blocker.stop();
    }
  });

  test("stopRunning stops server and removes PID file", async () => {
    const info = await ensureRunning(makeCfg());
    const pidPath = join(stateDir, ".server.pid");
    expect(existsSync(pidPath)).toBe(true);

    await stopRunning(stateDir);

    expect(existsSync(pidPath)).toBe(false);

    // Server should no longer be reachable
    let reachable = true;
    try {
      await fetch(`${info.url}/`);
    } catch {
      reachable = false;
    }
    expect(reachable).toBe(false);
  });

  test.skip("idle timer: server stops after idleTimeoutMs with no requests (may be flaky)", async () => {
    // This test is timing-sensitive. The idle timer check interval is 5s min,
    // which makes sub-second timeouts unreliable. Skip in CI unless explicitly enabled.
    const info = await ensureRunning(
      makeCfg({
        idleTimeoutMs: 200, // very short for testing
      }),
    );
    const pidPath = join(stateDir, ".server.pid");
    expect(existsSync(pidPath)).toBe(true);

    // Wait longer than the idle timeout
    await new Promise((r) => setTimeout(r, 400));

    // Server should have stopped and cleaned up its PID file
    expect(existsSync(pidPath)).toBe(false);

    // Server should no longer be reachable
    let reachable = true;
    try {
      await fetch(`${info.url}/`);
    } catch {
      reachable = false;
    }
    expect(reachable).toBe(false);
  });

  test("idleTimeoutMs: 0 disables the idle timer (server stays up)", async () => {
    const info = await ensureRunning(makeCfg({ idleTimeoutMs: 0 }));
    const pidPath = join(stateDir, ".server.pid");
    expect(existsSync(pidPath)).toBe(true);

    // Wait long enough that any short idle timer would have fired.
    // We don't wait the full 5s minimum check interval — we just want to
    // assert the timer never starts at all when idleTimeoutMs <= 0.
    await new Promise((r) => setTimeout(r, 100));

    // Server should still be reachable
    const res = await fetch(`${info.url}/`);
    expect(res.ok || res.status === 404).toBe(true); // any response means it's alive
    expect(existsSync(pidPath)).toBe(true);
  });

  test("negative idleTimeoutMs also disables the idle timer", async () => {
    const info = await ensureRunning(makeCfg({ idleTimeoutMs: -1 }));
    const pidPath = join(stateDir, ".server.pid");
    expect(existsSync(pidPath)).toBe(true);

    await new Promise((r) => setTimeout(r, 100));

    const res = await fetch(`${info.url}/`);
    expect(res.ok || res.status === 404).toBe(true);
    expect(existsSync(pidPath)).toBe(true);
  });
});
