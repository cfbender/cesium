// File-lock implementation to serialize concurrent index writes.

import { open, unlink, stat, utimes } from "node:fs/promises";

export interface LockHandle {
  release(): Promise<void>;
}

export interface AcquireLockArgs {
  lockPath: string;
  timeoutMs?: number;
  retryMs?: number;
  staleMs?: number;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function tryAcquireOnce(lockPath: string): Promise<"acquired" | "exists" | "disappeared"> {
  try {
    const fh = await open(lockPath, "wx");
    const content = JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() });
    await fh.writeFile(content, "utf8");
    await fh.close();
    return "acquired";
  } catch (err) {
    const nodeErr = err as NodeJS.ErrnoException;
    if (nodeErr.code === "EEXIST") return "exists";
    throw err;
  }
}

async function checkStale(lockPath: string, staleMs: number): Promise<boolean> {
  try {
    const s = await stat(lockPath);
    return Date.now() - s.mtimeMs > staleMs;
  } catch {
    return false; // disappeared between EEXIST and stat
  }
}

async function stealLock(lockPath: string): Promise<void> {
  await utimes(lockPath, new Date(), new Date()).catch(() => {
    // ignore — another process may have stolen it
  });
  await unlink(lockPath).catch(() => {
    // ignore — another process may have stolen it
  });
}

async function acquireLoop(
  lockPath: string,
  deadline: number,
  retryMs: number,
  staleMs: number,
  timeoutMs: number,
): Promise<void> {
  const result = await tryAcquireOnce(lockPath);
  if (result === "acquired") return;

  // Lock file exists or disappeared — check staleness
  const isStale = await checkStale(lockPath, staleMs);
  if (isStale) {
    await stealLock(lockPath);
    return acquireLoop(lockPath, deadline, retryMs, staleMs, timeoutMs);
  }

  if (Date.now() >= deadline) {
    throw new Error(`acquireLock: timed out after ${timeoutMs}ms waiting for ${lockPath}`);
  }

  await sleep(retryMs);

  if (Date.now() >= deadline) {
    throw new Error(`acquireLock: timed out after ${timeoutMs}ms waiting for ${lockPath}`);
  }

  return acquireLoop(lockPath, deadline, retryMs, staleMs, timeoutMs);
}

export async function acquireLock(args: AcquireLockArgs): Promise<LockHandle> {
  const { lockPath, timeoutMs = 5000, retryMs = 50, staleMs = 30_000 } = args;
  const deadline = Date.now() + timeoutMs;

  await acquireLoop(lockPath, deadline, retryMs, staleMs, timeoutMs);

  let released = false;
  return {
    release: async () => {
      if (released) return;
      released = true;
      await unlink(lockPath).catch((err: unknown) => {
        const nodeErr = err as NodeJS.ErrnoException;
        if (nodeErr.code !== "ENOENT") throw err;
      });
    },
  };
}

export async function withLock<T>(args: AcquireLockArgs, fn: () => Promise<T>): Promise<T> {
  const handle = await acquireLock(args);
  try {
    return await fn();
  } finally {
    await handle.release();
  }
}
