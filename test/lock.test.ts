import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync, utimesSync } from "node:fs";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { acquireLock, withLock } from "../src/storage/lock.ts";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "cesium-lock-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("acquireLock", () => {
  test("succeeds when no existing lock; lock file is created with valid JSON", async () => {
    const lockPath = join(dir, "test.lock");
    const handle = await acquireLock({ lockPath });
    expect(existsSync(lockPath)).toBe(true);
    const content = await Bun.file(lockPath).text();
    const parsed = JSON.parse(content) as Record<string, unknown>;
    expect(typeof parsed["pid"]).toBe("number");
    expect(typeof parsed["createdAt"]).toBe("string");
    await handle.release();
    expect(existsSync(lockPath)).toBe(false);
  });

  test("sequential acquire-release-acquire works", async () => {
    const lockPath = join(dir, "seq.lock");
    const h1 = await acquireLock({ lockPath });
    await h1.release();
    const h2 = await acquireLock({ lockPath });
    expect(existsSync(lockPath)).toBe(true);
    await h2.release();
    expect(existsSync(lockPath)).toBe(false);
  });

  test("release is idempotent (double-release does not throw)", async () => {
    const lockPath = join(dir, "idem.lock");
    const handle = await acquireLock({ lockPath });
    await handle.release();
    await expect(handle.release()).resolves.toBeUndefined();
  });

  test("concurrent: second acquire waits for first's release then succeeds", async () => {
    const lockPath = join(dir, "conc.lock");
    const h1 = await acquireLock({ lockPath, timeoutMs: 3000, retryMs: 20 });

    let secondAcquired = false;
    const secondPromise = acquireLock({ lockPath, timeoutMs: 3000, retryMs: 20 }).then((h) => {
      secondAcquired = true;
      return h;
    });

    // Give second a chance to try
    await new Promise((r) => setTimeout(r, 60));
    expect(secondAcquired).toBe(false);

    // Release first
    await h1.release();

    // Second should now succeed
    const h2 = await secondPromise;
    expect(secondAcquired).toBe(true);
    await h2.release();
  });

  test("stale lock is stolen and acquire succeeds", async () => {
    const lockPath = join(dir, "stale.lock");
    // Pre-create a lock file with an old mtime (1 hour ago)
    writeFileSync(lockPath, JSON.stringify({ pid: 99999, createdAt: new Date().toISOString() }));
    const oneHourAgo = new Date(Date.now() - 3_600_000);
    utimesSync(lockPath, oneHourAgo, oneHourAgo);

    // Should steal and succeed
    const handle = await acquireLock({ lockPath, staleMs: 30_000, timeoutMs: 1000 });
    expect(existsSync(lockPath)).toBe(true);
    await handle.release();
  });

  test("timeout throws when lock is held by a fresh lock file", async () => {
    const lockPath = join(dir, "timeout.lock");
    // Pre-create a fresh lock file (non-stale)
    writeFileSync(lockPath, JSON.stringify({ pid: 99999, createdAt: new Date().toISOString() }));

    const start = Date.now();
    await expect(
      acquireLock({ lockPath, timeoutMs: 100, retryMs: 20, staleMs: 30_000 }),
    ).rejects.toThrow(/timed out/);
    const elapsed = Date.now() - start;
    // Should have thrown within a reasonable window (not too early, not way too late)
    expect(elapsed).toBeGreaterThanOrEqual(90);
    expect(elapsed).toBeLessThan(800);
  });
});

describe("withLock", () => {
  test("releases lock on successful fn execution", async () => {
    const lockPath = join(dir, "wl-success.lock");
    await withLock({ lockPath }, async () => {
      expect(existsSync(lockPath)).toBe(true);
    });
    expect(existsSync(lockPath)).toBe(false);
  });

  test("releases lock even when fn throws", async () => {
    const lockPath = join(dir, "wl-throw.lock");
    await expect(
      withLock({ lockPath }, async () => {
        expect(existsSync(lockPath)).toBe(true);
        throw new Error("fn error");
      }),
    ).rejects.toThrow("fn error");
    expect(existsSync(lockPath)).toBe(false);
  });

  test("fn return value is passed through", async () => {
    const lockPath = join(dir, "wl-ret.lock");
    const result = await withLock({ lockPath }, async () => 42);
    expect(result).toBe(42);
  });
});
