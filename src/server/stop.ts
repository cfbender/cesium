// Cross-process server-stop logic — shared by the CLI and the cesium_stop tool.

import { join } from "node:path";
import { unlink } from "node:fs/promises";
import { readPidFile, isAlive as defaultIsAlive } from "./lifecycle.ts";

export interface StopServerArgs {
  stateDir: string;
  force?: boolean;
  timeoutMs?: number;
  isAlive?: (pid: number) => boolean;
  killProcess?: (pid: number, sig: NodeJS.Signals) => void;
  sleep?: (ms: number) => Promise<void>;
}

export type StopOutcome =
  | { kind: "not-running" }
  | { kind: "stale"; pid: number }
  | { kind: "stopped"; pid: number; port: number; signal: "SIGTERM" | "SIGKILL" }
  | { kind: "permission-denied"; pid: number };

function defaultSleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function stopServer(args: StopServerArgs): Promise<StopOutcome> {
  const {
    stateDir,
    force = false,
    timeoutMs = 3000,
    isAlive: isAliveFn = defaultIsAlive,
    killProcess: killFn = (pid: number, signal: NodeJS.Signals) => {
      process.kill(pid, signal);
    },
    sleep: sleepFn = defaultSleep,
  } = args;

  const pidFilePath = join(stateDir, ".server.pid");

  // 1. Read PID file
  const pidContent = readPidFile(pidFilePath);
  if (pidContent === null) {
    return { kind: "not-running" };
  }

  const { pid, port } = pidContent;

  // 2. Check if alive (stale PID file)
  if (!isAliveFn(pid)) {
    try {
      await unlink(pidFilePath);
    } catch {
      // ENOENT is fine
    }
    return { kind: "stale", pid };
  }

  // 3. Kill the process
  const doKill = (signal: NodeJS.Signals): "ok" | "permission-denied" => {
    try {
      killFn(pid, signal);
      return "ok";
    } catch (err) {
      const e = err as NodeJS.ErrnoException;
      if (e.code === "ESRCH") {
        // Process already gone — treat as success
        return "ok";
      }
      if (e.code === "EPERM") {
        return "permission-denied";
      }
      // Re-throw unexpected errors
      throw err;
    }
  };

  let usedSignal: "SIGTERM" | "SIGKILL";

  if (force) {
    // SIGKILL immediately
    const result = doKill("SIGKILL");
    if (result === "permission-denied") {
      return { kind: "permission-denied", pid };
    }
    usedSignal = "SIGKILL";
  } else {
    // SIGTERM first, then poll, then SIGKILL if still alive
    const termResult = doKill("SIGTERM");
    if (termResult === "permission-denied") {
      return { kind: "permission-denied", pid };
    }

    // Poll every 100ms until dead or timeout — recursive helper avoids await-in-loop
    const deadline = Date.now() + timeoutMs;

    async function poll(): Promise<boolean> {
      if (!isAliveFn(pid)) return true;
      if (Date.now() >= deadline) return false;
      await sleepFn(100);
      return poll();
    }

    const died = await poll();
    if (!died) {
      // Escalate to SIGKILL
      const killResult = doKill("SIGKILL");
      if (killResult === "permission-denied") {
        return { kind: "permission-denied", pid };
      }
      usedSignal = "SIGKILL";
    } else {
      usedSignal = "SIGTERM";
    }
  }

  // 4. Remove PID file (best-effort; the server may have already done it)
  try {
    await unlink(pidFilePath);
  } catch {
    // ENOENT is fine
  }

  return { kind: "stopped", pid, port, signal: usedSignal };
}
