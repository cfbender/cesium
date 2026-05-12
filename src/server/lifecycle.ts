// Lazy server start, idle shutdown, and PID file management.

import { join } from "node:path";
import { readFileSync, unlinkSync } from "node:fs";
import { unlink, writeFile } from "node:fs/promises";
import { startServer, type ServerHandle } from "./http.ts";
import { acquireLock } from "../storage/lock.ts";
import { createApiHandler } from "./api.ts";
import { createFaviconHandler } from "./favicon.ts";
import { ensureThemeCss } from "../storage/assets.ts";

export interface LifecycleConfig {
  stateDir: string;
  port: number; // start port for scan
  portMax: number; // upper bound (inclusive)
  idleTimeoutMs: number;
  hostname?: string; // default "127.0.0.1"
}

export interface RunningInfo {
  port: number;
  url: string;
  pid: number;
  startedAt: string; // ISO UTC
}

export interface PidFileContent {
  pid: number;
  port: number;
  hostname: string;
  startedAt: string;
}

// ─── Module-level singleton ───────────────────────────────────────────────────

let currentHandle: ServerHandle | null = null;
let currentInfo: RunningInfo | null = null;
let idleInterval: ReturnType<typeof setInterval> | null = null;
let lastRequestAt: number = Date.now();
let exitHandler: (() => void) | null = null;
let sigTermHandler: (() => void) | null = null;
let sigIntHandler: (() => void) | null = null;
let currentPidFilePath: string | null = null;

// ─── PID file helpers ─────────────────────────────────────────────────────────

export function readPidFile(path: string): PidFileContent | null {
  try {
    const raw = readFileSync(path, "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed !== null &&
      typeof parsed === "object" &&
      !Array.isArray(parsed) &&
      "pid" in parsed &&
      "port" in parsed &&
      "hostname" in parsed &&
      "startedAt" in parsed &&
      typeof (parsed as Record<string, unknown>)["pid"] === "number" &&
      typeof (parsed as Record<string, unknown>)["port"] === "number" &&
      typeof (parsed as Record<string, unknown>)["hostname"] === "string" &&
      typeof (parsed as Record<string, unknown>)["startedAt"] === "string"
    ) {
      const p = parsed as Record<string, unknown>;
      return {
        pid: p["pid"] as number,
        port: p["port"] as number,
        hostname: p["hostname"] as string,
        startedAt: p["startedAt"] as string,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export async function writePidFile(path: string, content: PidFileContent): Promise<void> {
  await writeFile(path, JSON.stringify(content, null, 2), "utf8");
}

export function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === "ESRCH") return false;
    // EPERM → process exists but owned by different user
    if (e.code === "EPERM") return true;
    return false;
  }
}

// ─── Idle timer management ────────────────────────────────────────────────────

function clearIdleTimer(): void {
  if (idleInterval !== null) {
    clearInterval(idleInterval);
    idleInterval = null;
  }
}

function startIdleTimer(idleTimeoutMs: number): void {
  clearIdleTimer();
  // 0 (or negative) means "never time out" — used by `cesium serve` in the
  // foreground, where the user expects the server to live until they Ctrl-C.
  if (idleTimeoutMs <= 0) return;
  // Check every 10% of the timeout (but at least every 5s, at most every 60s)
  const checkMs = Math.max(5_000, Math.min(60_000, Math.floor(idleTimeoutMs / 10)));
  const interval = setInterval(() => {
    if (Date.now() - lastRequestAt > idleTimeoutMs) {
      void stopRunning(currentPidFilePath ? currentPidFilePath.replace(/\/.server\.pid$/, "") : "");
    }
  }, checkMs);
  // Unref so the interval doesn't keep the process alive
  interval.unref();
  idleInterval = interval;
}

// ─── Signal / exit handler management ────────────────────────────────────────

function removeSignalHandlers(): void {
  if (sigTermHandler !== null) {
    process.removeListener("SIGTERM", sigTermHandler);
    sigTermHandler = null;
  }
  if (sigIntHandler !== null) {
    process.removeListener("SIGINT", sigIntHandler);
    sigIntHandler = null;
  }
  if (exitHandler !== null) {
    process.removeListener("exit", exitHandler);
    exitHandler = null;
  }
}

function installSignalHandlers(pidFilePath: string): void {
  removeSignalHandlers();

  sigTermHandler = () => {
    void stopRunning(pidFilePath.replace(/\/.server\.pid$/, "")).finally(() => {
      process.exit(0);
    });
  };

  sigIntHandler = () => {
    void stopRunning(pidFilePath.replace(/\/.server\.pid$/, "")).finally(() => {
      process.exit(0);
    });
  };

  // Synchronous exit handler — last resort PID file cleanup
  exitHandler = () => {
    try {
      unlinkSync(pidFilePath);
    } catch {
      // ignore ENOENT and any other error
    }
  };

  process.on("SIGTERM", sigTermHandler);
  process.on("SIGINT", sigIntHandler);
  process.on("exit", exitHandler);
}

// ─── Core lifecycle ───────────────────────────────────────────────────────────

export async function stopRunning(stateDir: string): Promise<void> {
  clearIdleTimer();
  removeSignalHandlers();

  const handle = currentHandle;
  currentHandle = null;
  currentInfo = null;
  const pidPath = currentPidFilePath;
  currentPidFilePath = null;
  lastRequestAt = Date.now();

  if (handle !== null) {
    try {
      await handle.stop();
    } catch {
      // best-effort
    }
  }

  if (pidPath !== null) {
    try {
      await unlink(pidPath);
    } catch {
      // ENOENT is fine
    }
  } else if (stateDir) {
    try {
      await unlink(join(stateDir, ".server.pid"));
    } catch {
      // ENOENT is fine
    }
  }
}

export async function ensureRunning(cfg: LifecycleConfig): Promise<RunningInfo> {
  const { stateDir, port, portMax, idleTimeoutMs, hostname = "127.0.0.1" } = cfg;
  const pidFilePath = join(stateDir, ".server.pid");
  const lockPath = join(stateDir, ".server-start.lock");

  // Fast path: already running in this process
  if (currentHandle !== null && currentInfo !== null) {
    return currentInfo;
  }

  const lock = await acquireLock({ lockPath, timeoutMs: 10_000, staleMs: 30_000 });
  try {
    // Re-check after acquiring lock (another concurrent call may have started it)
    if (currentHandle !== null && currentInfo !== null) {
      return currentInfo;
    }

    // Read existing PID file
    const existing = readPidFile(pidFilePath);
    if (existing !== null) {
      if (existing.pid === process.pid) {
        // Our own PID but no in-process handle — stale from a previous test reset or crash
        // Fall through to start new
      } else if (isAlive(existing.pid)) {
        // Another process owns this server
        const info: RunningInfo = {
          port: existing.port,
          url: `http://${existing.hostname}:${existing.port}`,
          pid: existing.pid,
          startedAt: existing.startedAt,
        };
        return info;
      }
      // Stale — delete and start fresh
      try {
        await unlink(pidFilePath);
      } catch {
        // ENOENT is fine
      }
    }

    // Scan for a free port using a recursive helper (avoids await-in-loop lint rule)
    async function tryBindPort(p: number): Promise<ServerHandle> {
      if (p > portMax) {
        throw new Error(`cesium: no free port found in range ${port}–${portMax}`);
      }
      try {
        return await startServer({ stateDir, port: p, hostname });
      } catch (err) {
        const e = err as NodeJS.ErrnoException;
        if (e.code === "EADDRINUSE" || e.code === "EACCES") {
          return tryBindPort(p + 1);
        }
        throw err;
      }
    }

    const handle = await tryBindPort(port);
    const boundPort = handle.port;

    // Materialize theme.css before serving — self-heals on plugin upgrade
    await ensureThemeCss(stateDir);

    // Wire API handler before static file fallback
    handle.addHandler(createApiHandler({ stateDir }));
    // /favicon.ico shim — browsers auto-request this even when the page
    // declares an SVG favicon. Serve the SVG bytes inline so we don't 404.
    handle.addHandler(createFaviconHandler());

    const startedAt = new Date().toISOString();

    // Write PID file
    await writePidFile(pidFilePath, {
      pid: process.pid,
      port: boundPort,
      hostname,
      startedAt,
    });

    currentHandle = handle;
    currentPidFilePath = pidFilePath;
    lastRequestAt = Date.now();

    const info: RunningInfo = {
      port: boundPort,
      url: `http://${hostname}:${boundPort}`,
      pid: process.pid,
      startedAt,
    };
    currentInfo = info;

    // Attach idle tracking
    handle.onRequest(() => {
      lastRequestAt = Date.now();
    });

    // Install signal handlers
    installSignalHandlers(pidFilePath);

    // Start idle timer
    startIdleTimer(idleTimeoutMs);

    return info;
  } finally {
    await lock.release();
  }
}

// ─── Test reset hook ──────────────────────────────────────────────────────────
// This function is intended for test use only. It clears module-level singleton
// state, stops any running server, and removes signal/exit listeners.

export async function resetForTests(): Promise<void> {
  clearIdleTimer();
  removeSignalHandlers();

  if (currentHandle !== null) {
    try {
      await currentHandle.stop();
    } catch {
      // best-effort
    }
    currentHandle = null;
  }

  if (currentPidFilePath !== null) {
    try {
      await unlink(currentPidFilePath);
    } catch {
      // ENOENT is fine
    }
    currentPidFilePath = null;
  }

  currentInfo = null;
  lastRequestAt = Date.now();
}
