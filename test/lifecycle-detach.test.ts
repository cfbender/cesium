// Tests for ensureServerRunning — detached subprocess spawn and readiness.
// Each test uses an isolated temp state dir and cleans up spawned processes.

import { test, expect, beforeEach, afterEach, describe } from "bun:test";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ensureServerRunning,
  readPidFile,
  writePidFile,
  isAlive,
} from "../src/server/lifecycle.ts";

// ─── Helpers ──────────────────────────────────────────────────────────────────

let stateDir: string;
const spawnedPids: number[] = [];

beforeEach(() => {
  stateDir = mkdtempSync(join(tmpdir(), "cesium-detach-"));
});

afterEach(async () => {
  // Kill any spawned server processes
  for (const pid of spawnedPids) {
    if (isAlive(pid)) {
      try {
        process.kill(pid, "SIGTERM");
        // Brief wait for process to exit
        await new Promise<void>((resolve) => setTimeout(resolve, 200));
        if (isAlive(pid)) {
          process.kill(pid, "SIGKILL");
        }
      } catch {
        // best-effort
      }
    }
  }
  spawnedPids.length = 0;

  // Clean up temp state dir
  rmSync(stateDir, { recursive: true, force: true });
});

function makeCfg(overrides?: { port?: number; portMax?: number }) {
  return {
    stateDir,
    port: overrides?.port ?? 0,
    portMax: overrides?.portMax ?? 65535,
    idleTimeoutMs: 30_000,
    hostname: "127.0.0.1",
  };
}

// ─── Core detach tests ────────────────────────────────────────────────────────

describe("ensureServerRunning (detached)", () => {
  test("spawns a detached subprocess — PID is NOT the test process PID", async () => {
    const info = await ensureServerRunning(makeCfg());
    spawnedPids.push(info.pid);

    // The subprocess PID must differ from the test process PID
    expect(info.pid).not.toBe(process.pid);
    expect(info.pid).toBeGreaterThan(0);
    expect(info.port).toBeGreaterThan(0);
    // URL contains the hostname as configured (may be 0.0.0.0 or 127.0.0.1)
    expect(info.url).toMatch(/^http:\/\/[^:]+:\d+$/);
    expect(typeof info.startedAt).toBe("string");
  }, 20_000);

  test("PID file points to the subprocess, not the parent", async () => {
    const info = await ensureServerRunning(makeCfg());
    spawnedPids.push(info.pid);

    const pidPath = join(stateDir, ".server.pid");
    expect(existsSync(pidPath)).toBe(true);

    const pid = readPidFile(pidPath);
    expect(pid).not.toBeNull();
    if (pid === null) throw new Error("expected pid file");
    expect(pid.pid).toBe(info.pid);
    expect(pid.pid).not.toBe(process.pid);
  }, 20_000);

  test("spawned server responds to HTTP", async () => {
    const info = await ensureServerRunning(makeCfg());
    spawnedPids.push(info.pid);

    // Server should respond on its port
    const res = await fetch(`${info.url}/`);
    // Any response (including 404) confirms the server is up
    expect(res.status).toBeLessThan(600);
  }, 20_000);

  test("idempotent — second call returns same server, no new spawn", async () => {
    const info1 = await ensureServerRunning(makeCfg());
    spawnedPids.push(info1.pid);

    const info2 = await ensureServerRunning(makeCfg());
    // If info2 returns a different PID, track that too
    if (!spawnedPids.includes(info2.pid)) {
      spawnedPids.push(info2.pid);
    }

    // Same port and pid — no double-start
    expect(info2.pid).toBe(info1.pid);
    expect(info2.port).toBe(info1.port);
  }, 30_000);

  test("re-spawns when previous PID is dead (stale PID file)", async () => {
    // Plant a stale PID file referencing a dead process
    const pidPath = join(stateDir, ".server.pid");
    await writePidFile(pidPath, {
      pid: 99999999, // guaranteed dead
      port: 3099,
      hostname: "127.0.0.1",
      startedAt: "2020-01-01T00:00:00.000Z",
    });

    const info = await ensureServerRunning(makeCfg());
    spawnedPids.push(info.pid);

    expect(info.pid).not.toBe(99999999);
    expect(info.pid).not.toBe(process.pid);
    expect(info.port).toBeGreaterThan(0);

    // Confirm new PID file was written
    const newPid = readPidFile(pidPath);
    expect(newPid).not.toBeNull();
    if (newPid === null) throw new Error("expected pid file");
    expect(newPid.pid).toBe(info.pid);
  }, 20_000);

  test("killing the spawned subprocess does not kill the test process", async () => {
    const info = await ensureServerRunning(makeCfg());
    spawnedPids.push(info.pid);

    expect(isAlive(info.pid)).toBe(true);

    // Kill only the server child
    process.kill(info.pid, "SIGTERM");

    // Give it a moment to exit
    await new Promise<void>((resolve) => setTimeout(resolve, 500));

    // The child should be dead
    expect(isAlive(info.pid)).toBe(false);

    // The test process must still be alive
    expect(isAlive(process.pid)).toBe(true);

    // Clean up PID file left by test
    try {
      await unlink(join(stateDir, ".server.pid"));
    } catch {
      // ENOENT is fine
    }
  }, 20_000);
});
