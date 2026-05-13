// cesium restart — stop the running server and start a new one in the foreground.

import { defineCommand } from "citty";
import { type StopContext, type StopArgs, runStop } from "./stop.ts";
import { type ServeContext, type ServeArgs, runServe, parseDuration } from "./serve.ts";

export interface RestartContext extends StopContext, ServeContext {
  /** Test injection: replace runServe with a mock so tests don't block. */
  serveImpl?: (args: ServeArgs, ctx?: Partial<RestartContext>) => Promise<number>;
}

export interface RestartArgs extends StopArgs, ServeArgs {}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function runRestart(
  args: RestartArgs,
  ctxOverride?: Partial<RestartContext>,
): Promise<number> {
  const sleepFn = ctxOverride?.sleep ?? defaultSleep;
  const serveFn = ctxOverride?.serveImpl ?? runServe;

  const stopArgs: StopArgs = { force: args.force, timeoutMs: args.timeoutMs };

  // 1. Stop any running server
  const stopCode = await runStop(stopArgs, ctxOverride);
  if (stopCode !== 0) {
    // e.g. EPERM — bail, pass through exit code
    return stopCode;
  }

  // 2. Brief pause to let the port fully release
  await sleepFn(200);

  // 3. Announce restart
  const stdout = ctxOverride?.stdout ?? process.stdout;
  stdout.write("starting new cesium server...\n");

  // 4. Start the new server in foreground (blocks until Ctrl-C)
  const serveArgs: ServeArgs = {};
  if (args.port !== undefined) serveArgs.port = args.port;
  if (args.hostname !== undefined) serveArgs.hostname = args.hostname;
  if (args.stateDir !== undefined) serveArgs.stateDir = args.stateDir;
  if (args.idleTimeoutMs !== undefined) serveArgs.idleTimeoutMs = args.idleTimeoutMs;

  return serveFn(serveArgs, ctxOverride);
}

export const restartCmd = defineCommand({
  meta: {
    name: "restart",
    description: "Stop the running cesium server and start a new one in the foreground.",
  },
  args: {
    // Stop args
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
    // Serve args (mirrored)
    port: {
      type: "string",
      alias: "p",
      description: "Override configured port (default: 3030)",
    },
    hostname: {
      type: "string",
      alias: "H",
      description: "Override configured bind address",
    },
    "state-dir": {
      type: "string",
      description: "Override the cesium state directory",
    },
    "idle-timeout": {
      type: "string",
      description: 'Auto-shutdown after DUR of inactivity (e.g. "30m"). Default: never.',
    },
  },
  async run({ args }) {
    const timeoutMs = parseInt(args.timeout, 10);
    if (isNaN(timeoutMs) || timeoutMs < 0) {
      process.stderr.write(`cesium restart: --timeout must be a non-negative integer\n`);
      process.exit(1);
    }

    const restartArgs: RestartArgs = {
      force: args.force,
      timeoutMs,
    };

    if (args.port !== undefined) {
      const p = parseInt(args.port, 10);
      if (isNaN(p) || p < 1 || p > 65535) {
        process.stderr.write(`cesium restart: --port must be a number between 1 and 65535\n`);
        process.exit(1);
      }
      restartArgs.port = p;
    }
    if (args.hostname !== undefined) restartArgs.hostname = args.hostname;
    if (args["state-dir"] !== undefined) restartArgs.stateDir = args["state-dir"];

    if (args["idle-timeout"] !== undefined) {
      const ms = parseDuration(args["idle-timeout"]);
      if (ms === null) {
        process.stderr.write(
          `cesium restart: --idle-timeout must be a duration like "30m", "2h", "90s", or "0"/"never" to disable\n`,
        );
        process.exit(1);
      }
      restartArgs.idleTimeoutMs = ms;
    }

    const code = await runRestart(restartArgs);
    if (code !== 0) process.exit(code);
  },
});
