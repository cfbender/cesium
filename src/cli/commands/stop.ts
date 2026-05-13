// cesium stop — kill the running cesium server cross-process via PID file.

import { defineCommand } from "citty";
import { loadConfig, type CesiumConfig } from "../../config.ts";
import { stopServer } from "../../server/stop.ts";
import type { StopServerArgs } from "../../server/stop.ts";

export interface StopArgs {
  force: boolean;
  timeoutMs: number;
}

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

export async function runStop(args: StopArgs, ctxOverride?: Partial<StopContext>): Promise<number> {
  const ctx: StopContext = { ...defaultCtx(), ...ctxOverride };

  if (!Number.isInteger(args.timeoutMs) || args.timeoutMs < 0) {
    ctx.stderr.write(`cesium stop: --timeout must be a non-negative integer\n`);
    return 1;
  }

  const cfg = (ctx.loadConfig ?? loadConfig)();

  const stopArgs: StopServerArgs = {
    stateDir: cfg.stateDir,
    force: args.force,
    timeoutMs: args.timeoutMs,
  };
  if (ctx.isAlive !== undefined) stopArgs.isAlive = ctx.isAlive;
  if (ctx.killProcess !== undefined) stopArgs.killProcess = ctx.killProcess;
  if (ctx.sleep !== undefined) stopArgs.sleep = ctx.sleep;

  const outcome = await stopServer(stopArgs);

  switch (outcome.kind) {
    case "not-running":
      ctx.stdout.write("no cesium server running\n");
      return 0;
    case "stale":
      ctx.stdout.write("server not running (stale PID file removed)\n");
      return 0;
    case "stopped":
      ctx.stdout.write(`stopped cesium server (pid ${outcome.pid}, port ${outcome.port})\n`);
      return 0;
    case "permission-denied":
      ctx.stderr.write(
        `cesium stop: permission denied — process ${outcome.pid} is owned by another user\n`,
      );
      return 2;
  }
}

export const stopCmd = defineCommand({
  meta: {
    name: "stop",
    description:
      "Stop the running cesium server via its PID file. Idempotent when no server is running.",
  },
  args: {
    force: {
      type: "boolean",
      alias: "f",
      default: false,
      description: "SIGKILL immediately — skip the SIGTERM grace period",
    },
    timeout: {
      type: "string",
      default: "3000",
      description: "Grace period in ms before SIGKILL",
    },
  },
  async run({ args }) {
    const t = parseInt(args.timeout, 10);
    if (isNaN(t) || t < 0) {
      process.stderr.write(`cesium stop: --timeout must be a non-negative integer\n`);
      process.exit(1);
    }
    const code = await runStop({ force: args.force, timeoutMs: t });
    if (code !== 0) process.exit(code);
  },
});
