// cesium serve — start the local HTTP server in the foreground.

import { defineCommand } from "citty";
import { loadConfig, type CesiumConfig } from "../../config.ts";
import { runServerForeground, stopRunning } from "../../server/lifecycle.ts";
import { resolveDisplayHost } from "../../tools/publish.ts";
import { themeFromPreset, mergeTheme } from "../../render/theme.ts";

export interface ServeArgs {
  port?: number;
  hostname?: string;
  stateDir?: string;
  /**
   * Idle timeout in milliseconds. 0 (the default for `cesium serve`) means the
   * server runs forever until SIGINT/SIGTERM. Override with --idle-timeout to
   * opt back into auto-shutdown — useful for long-lived dev sessions that
   * should still recycle eventually.
   */
  idleTimeoutMs?: number;
}

export interface ServeContext {
  stdout: { write: (s: string) => void };
  stderr: { write: (s: string) => void };
  loadConfig?: () => CesiumConfig;
}

function defaultCtx(): ServeContext {
  return {
    stdout: process.stdout,
    stderr: process.stderr,
  };
}

/** Parse a duration string like "30m", "2h", "90s", "0", "never". Returns ms or null. */
export function parseDuration(input: string): number | null {
  const trimmed = input.trim().toLowerCase();
  if (trimmed === "0" || trimmed === "never" || trimmed === "off") return 0;
  const match = /^(\d+(?:\.\d+)?)(ms|s|m|h)?$/.exec(trimmed);
  if (match === null) return null;
  const n = parseFloat(match[1] ?? "");
  if (!isFinite(n) || n < 0) return null;
  const unit = match[2] ?? "ms";
  const mul = unit === "ms" ? 1 : unit === "s" ? 1000 : unit === "m" ? 60_000 : /* h */ 3_600_000;
  return Math.floor(n * mul);
}

interface ValidatedServeArgs {
  port?: number;
  hostname?: string;
  stateDir?: string;
  idleTimeoutMs?: number;
}

/**
 * Validate ServeArgs and return a ValidatedServeArgs object, or null on error.
 * Writes the error message to ctx.stderr.
 */
export function validateServeArgs(args: ServeArgs, ctx: ServeContext): ValidatedServeArgs | null {
  const out: ValidatedServeArgs = {};

  if (args.port !== undefined) {
    if (!Number.isInteger(args.port) || args.port < 1 || args.port > 65535) {
      ctx.stderr.write(`cesium serve: --port must be a number between 1 and 65535\n`);
      return null;
    }
    out.port = args.port;
  }

  if (args.hostname !== undefined) {
    if (args.hostname.length === 0) {
      ctx.stderr.write(`cesium serve: --hostname must not be empty\n`);
      return null;
    }
    out.hostname = args.hostname;
  }

  if (args.stateDir !== undefined) {
    if (args.stateDir.length === 0) {
      ctx.stderr.write(`cesium serve: --state-dir must not be empty\n`);
      return null;
    }
    out.stateDir = args.stateDir;
  }

  if (args.idleTimeoutMs !== undefined) {
    if (!Number.isFinite(args.idleTimeoutMs) || args.idleTimeoutMs < 0) {
      ctx.stderr.write(`cesium serve: --idle-timeout must be a non-negative duration\n`);
      return null;
    }
    out.idleTimeoutMs = args.idleTimeoutMs;
  }

  return out;
}

export async function runServe(
  args: ServeArgs,
  ctxOverride?: Partial<ServeContext>,
): Promise<number> {
  const ctx: ServeContext = { ...defaultCtx(), ...ctxOverride };

  const validated = validateServeArgs(args, ctx);
  if (validated === null) return 1;

  const cfg = (ctx.loadConfig ?? loadConfig)();

  // Foreground `cesium serve` defaults to NO idle timeout — when the user
  // launches the server explicitly, they want it to live until they Ctrl-C.
  // The configured idleTimeoutMs only applies to the plugin's lazy-started
  // server. --idle-timeout opts back into auto-shutdown.
  const effectiveIdleTimeoutMs = validated.idleTimeoutMs ?? 0;

  // Apply overrides from CLI flags
  const effectiveCfg = {
    ...cfg,
    ...(validated.stateDir !== undefined ? { stateDir: validated.stateDir } : {}),
    ...(validated.port !== undefined ? { port: validated.port, portMax: validated.port } : {}),
    ...(validated.hostname !== undefined ? { hostname: validated.hostname } : {}),
    idleTimeoutMs: effectiveIdleTimeoutMs,
  };

  let serverInfo: { port: number; url: string };
  try {
    const theme = mergeTheme(themeFromPreset(effectiveCfg.themePreset), effectiveCfg.theme);
    serverInfo = await runServerForeground({
      stateDir: effectiveCfg.stateDir,
      port: effectiveCfg.port,
      portMax: effectiveCfg.portMax,
      idleTimeoutMs: effectiveCfg.idleTimeoutMs,
      hostname: effectiveCfg.hostname,
      theme,
    });
  } catch (err) {
    const e = err as Error;
    ctx.stderr.write(`cesium serve: failed to start server: ${e.message}\n`);
    return 1;
  }

  const displayHost = resolveDisplayHost(effectiveCfg.hostname);
  const displayUrl = `http://${displayHost}:${serverInfo.port}`;

  // Expand home dir in stateDir for display
  const home = process.env["HOME"] ?? "";
  const stateDirDisplay = home ? effectiveCfg.stateDir.replace(home, "~") : effectiveCfg.stateDir;

  ctx.stdout.write(`cesium serve · ${displayUrl}\n`);
  ctx.stdout.write(`  serving ${stateDirDisplay}\n`);
  if (effectiveIdleTimeoutMs <= 0) {
    ctx.stdout.write(`  no idle timeout — runs until Ctrl-C\n`);
  } else {
    const minutes = Math.round(effectiveIdleTimeoutMs / 60_000);
    ctx.stdout.write(
      `  idle timeout: ${minutes >= 1 ? `${minutes}m` : `${effectiveIdleTimeoutMs}ms`} of inactivity\n`,
    );
  }
  ctx.stdout.write(`  Ctrl-C to stop\n`);

  // If binding on all interfaces, also print the LAN URL
  if (effectiveCfg.hostname === "0.0.0.0" || effectiveCfg.hostname === "::") {
    ctx.stdout.write(`  LAN: ${displayUrl}\n`);
  }

  // Run in the foreground until SIGINT/SIGTERM
  await new Promise<void>((resolve) => {
    const cleanup = () => {
      void stopRunning(effectiveCfg.stateDir).finally(() => {
        resolve();
      });
    };
    process.once("SIGINT", cleanup);
    process.once("SIGTERM", cleanup);
  });

  return 0;
}

export const serveCmd = defineCommand({
  meta: {
    name: "serve",
    description: "Start the cesium HTTP server in the foreground. Press Ctrl-C to stop.",
  },
  args: {
    port: {
      type: "string",
      alias: "p",
      description: "Override configured port (default: 3030)",
    },
    hostname: {
      type: "string",
      alias: "H",
      description: "Override configured bind address (default: 127.0.0.1)",
    },
    "state-dir": {
      type: "string",
      description: "Override the cesium state directory",
    },
    "idle-timeout": {
      type: "string",
      description:
        'Auto-shutdown after DUR of inactivity (e.g. "30m", "2h", "90s"). Use 0/never/off to disable. Default: never.',
    },
  },
  async run({ args }) {
    const serveArgs: ServeArgs = {};

    if (args.port !== undefined) {
      const p = parseInt(args.port, 10);
      if (isNaN(p) || p < 1 || p > 65535) {
        process.stderr.write(`cesium serve: --port must be a number between 1 and 65535\n`);
        process.exit(1);
      }
      serveArgs.port = p;
    }

    if (args.hostname !== undefined) serveArgs.hostname = args.hostname;
    if (args["state-dir"] !== undefined) serveArgs.stateDir = args["state-dir"];

    if (args["idle-timeout"] !== undefined) {
      const ms = parseDuration(args["idle-timeout"]);
      if (ms === null) {
        process.stderr.write(
          `cesium serve: --idle-timeout must be a duration like "30m", "2h", "90s", or "0"/"never" to disable\n`,
        );
        process.exit(1);
      }
      serveArgs.idleTimeoutMs = ms;
    }

    const code = await runServe(serveArgs);
    if (code !== 0) process.exit(code);
  },
});
