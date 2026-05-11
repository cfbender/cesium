// cesium stop — kill the running cesium server cross-process via PID file.

import { parseArgs } from "node:util";
import { loadConfig, type CesiumConfig } from "../../config.ts";
import { stopServer } from "../../server/stop.ts";
import type { StopServerArgs } from "../../server/stop.ts";

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

export async function stopCommand(argv: string[], ctx?: Partial<StopContext>): Promise<number> {
  const resolved: StopContext = { ...defaultCtx(), ...ctx };

  const parseResult = parseStopArgs(argv, resolved);
  if (parseResult === null) return 1;
  if (parseResult === "help") return 0;

  const opts = parseResult;
  const cfg = (resolved.loadConfig ?? loadConfig)();

  const stopArgs: StopServerArgs = {
    stateDir: cfg.stateDir,
    force: opts.force,
    timeoutMs: opts.timeout,
  };
  if (resolved.isAlive !== undefined) {
    stopArgs.isAlive = resolved.isAlive;
  }
  if (resolved.killProcess !== undefined) {
    stopArgs.killProcess = resolved.killProcess;
  }
  if (resolved.sleep !== undefined) {
    stopArgs.sleep = resolved.sleep;
  }

  const outcome = await stopServer(stopArgs);

  switch (outcome.kind) {
    case "not-running":
      resolved.stdout.write("no cesium server running\n");
      return 0;
    case "stale":
      resolved.stdout.write("server not running (stale PID file removed)\n");
      return 0;
    case "stopped":
      resolved.stdout.write(`stopped cesium server (pid ${outcome.pid}, port ${outcome.port})\n`);
      return 0;
    case "permission-denied":
      resolved.stderr.write(
        `cesium stop: permission denied — process ${outcome.pid} is owned by another user\n`,
      );
      return 2;
  }
}
