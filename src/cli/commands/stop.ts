// cesium stop — kill the running cesium server cross-process via PID file.

import { parseArgs } from "node:util";
import { join } from "node:path";
import { unlink } from "node:fs/promises";
import { loadConfig, type CesiumConfig } from "../../config.ts";
import { readPidFile, isAlive as defaultIsAlive } from "../../server/lifecycle.ts";

export interface StopContext {
  stdout: { write: (s: string) => void };
  stderr: { write: (s: string) => void };
  loadConfig?: () => CesiumConfig;
  // Test injection points:
  isAlive?: (pid: number) => boolean;
  killProcess?: (pid: number, signal: NodeJS.Signals) => void;
  sleep?: (ms: number) => Promise<void>;
}

function defaultCtx(): StopContext {
  return {
    stdout: process.stdout,
    stderr: process.stderr,
  };
}

export interface StopOptions {
  force: boolean;
  timeout: number;
}

/** Parse stop-command argv. Returns null on parse error. */
export function parseStopArgs(
  argv: string[],
  ctx: Pick<StopContext, "stdout" | "stderr">,
): StopOptions | null | "help" {
  let values: { force: boolean; timeout: string | undefined; help: boolean };

  try {
    const parsed = parseArgs({
      args: argv,
      options: {
        force: { type: "boolean", short: "f", default: false },
        timeout: { type: "string" },
        help: { type: "boolean", short: "h", default: false },
      },
      allowPositionals: false,
      strict: true,
    });
    values = parsed.values as typeof values;
  } catch (err) {
    const e = err as Error;
    ctx.stderr.write(`cesium stop: ${e.message}\n`);
    ctx.stderr.write(`Usage: cesium stop [--force] [--timeout <ms>]\n`);
    return null;
  }

  if (values.help) {
    ctx.stdout.write(
      [
        "Usage: cesium stop [options]",
        "",
        "Options:",
        "  --force, -f        SIGKILL immediately — skip the SIGTERM grace period",
        "  --timeout <ms>     Grace period in ms before SIGKILL (default: 3000)",
        "  --help, -h         Show this help message",
        "",
        "Stops the running cesium server via its PID file. Idempotent when no",
        "server is running.",
        "",
      ].join("\n"),
    );
    return "help";
  }

  let timeout = 3000;
  if (values.timeout !== undefined) {
    const t = parseInt(values.timeout, 10);
    if (isNaN(t) || t < 0) {
      ctx.stderr.write(`cesium stop: --timeout must be a non-negative integer\n`);
      return null;
    }
    timeout = t;
  }

  return { force: values.force, timeout };
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function stopCommand(argv: string[], ctx?: Partial<StopContext>): Promise<number> {
  const resolved: StopContext = { ...defaultCtx(), ...ctx };

  const parseResult = parseStopArgs(argv, resolved);
  if (parseResult === null) return 1;
  if (parseResult === "help") return 0;

  const opts = parseResult;
  const cfg = (resolved.loadConfig ?? loadConfig)();
  const pidFilePath = join(cfg.stateDir, ".server.pid");

  const isAliveFn = resolved.isAlive ?? defaultIsAlive;
  const killFn =
    resolved.killProcess ??
    ((pid: number, signal: NodeJS.Signals) => {
      process.kill(pid, signal);
    });
  const sleepFn = resolved.sleep ?? defaultSleep;

  // 1. Read PID file
  const pidContent = readPidFile(pidFilePath);
  if (pidContent === null) {
    resolved.stdout.write("no cesium server running\n");
    return 0;
  }

  const { pid, port } = pidContent;

  // 2. Check if alive (stale PID file)
  if (!isAliveFn(pid)) {
    try {
      await unlink(pidFilePath);
    } catch {
      // ENOENT is fine
    }
    resolved.stdout.write("server not running (stale PID file removed)\n");
    return 0;
  }

  // 3. Kill the process
  const doKill = (signal: NodeJS.Signals): boolean => {
    try {
      killFn(pid, signal);
      return true;
    } catch (err) {
      const e = err as NodeJS.ErrnoException;
      if (e.code === "ESRCH") {
        // Process already gone — fine
        return true;
      }
      if (e.code === "EPERM") {
        resolved.stderr.write(
          `cesium stop: permission denied — process ${pid} is owned by another user\n`,
        );
        return false;
      }
      // Re-throw unexpected errors
      throw err;
    }
  };

  if (opts.force) {
    // SIGKILL immediately
    const ok = doKill("SIGKILL");
    if (!ok) return 2;
  } else {
    // SIGTERM first, then poll, then SIGKILL if still alive
    const ok = doKill("SIGTERM");
    if (!ok) return 2;

    // Poll every 100ms until dead or timeout — use a recursive helper to
    // satisfy the no-await-in-loop lint rule.
    const deadline = Date.now() + opts.timeout;

    async function poll(): Promise<boolean> {
      if (!isAliveFn(pid)) return true;
      if (Date.now() >= deadline) return false;
      await sleepFn(100);
      return poll();
    }

    const died = await poll();
    if (!died) {
      // Escalate to SIGKILL
      const ok2 = doKill("SIGKILL");
      if (!ok2) return 2;
    }
  }

  // 4. Remove PID file (best-effort; the server may have already done it)
  try {
    await unlink(pidFilePath);
  } catch {
    // ENOENT is fine
  }

  resolved.stdout.write(`stopped cesium server (pid ${pid}, port ${port})\n`);
  return 0;
}
