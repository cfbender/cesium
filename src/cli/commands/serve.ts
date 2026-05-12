// cesium serve — start the local HTTP server in the foreground.

import { parseArgs } from "node:util";
import { loadConfig, type CesiumConfig } from "../../config.ts";
import { runServerForeground, stopRunning } from "../../server/lifecycle.ts";
import { resolveDisplayHost } from "../../tools/publish.ts";
import { themeFromPreset, mergeTheme } from "../../render/theme.ts";

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

export interface ServeOptions {
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

/** Parse a duration string like "30m", "2h", "90s", "0", "never". Returns ms or null. */
function parseDuration(input: string): number | null {
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

/** Parse the argv for serve. Returns null on error (already written to stderr). */
export function parseServeArgs(
  argv: string[],
  ctx: Pick<ServeContext, "stdout" | "stderr">,
): ServeOptions | null | "help" {
  let values: {
    port: string | undefined;
    hostname: string | undefined;
    "idle-timeout": string | undefined;
    "state-dir": string | undefined;
    help: boolean;
  };

  try {
    const parsed = parseArgs({
      args: argv,
      options: {
        port: { type: "string", short: "p" },
        hostname: { type: "string", short: "H" },
        "idle-timeout": { type: "string" },
        "state-dir": { type: "string" },
        help: { type: "boolean", short: "h", default: false },
      },
      allowPositionals: false,
      strict: true,
    });
    values = parsed.values as typeof values;
  } catch (err) {
    const e = err as Error;
    ctx.stderr.write(`cesium serve: ${e.message}\n`);
    ctx.stderr.write(`Usage: cesium serve [--port N] [--hostname H] [--idle-timeout DUR]\n`);
    return null;
  }

  if (values.help) {
    ctx.stdout.write(
      [
        "Usage: cesium serve [options]",
        "",
        "Options:",
        "  --port, -p N        Override configured port (default: 3030)",
        "  --hostname, -H H    Override configured bind address (default: 127.0.0.1)",
        "  --state-dir DIR     Override the cesium state directory",
        "  --idle-timeout DUR  Auto-shutdown after DUR of inactivity. Accepts plain",
        "                      milliseconds or a suffixed value (90s, 30m, 2h).",
        "                      Use 0 / never / off to disable. Default: 0 (never).",
        "  --help, -h          Show this help message",
        "",
        "Starts the cesium HTTP server in the foreground. Press Ctrl-C to stop.",
        "Uses the same config as the opencode plugin (~/.config/opencode/cesium.json).",
        "",
        "Note: foreground `cesium serve` ignores the configured idleTimeoutMs by",
        "default — the timeout exists for the plugin's lazy-started server, not",
        "for a server you launched explicitly.",
        "",
      ].join("\n"),
    );
    return "help";
  }

  const opts: ServeOptions = {};

  if (values.port !== undefined) {
    const p = parseInt(values.port, 10);
    if (isNaN(p) || p < 1 || p > 65535) {
      ctx.stderr.write(`cesium serve: --port must be a number between 1 and 65535\n`);
      return null;
    }
    opts.port = p;
  }

  if (values.hostname !== undefined) {
    if (values.hostname.length === 0) {
      ctx.stderr.write(`cesium serve: --hostname must not be empty\n`);
      return null;
    }
    opts.hostname = values.hostname;
  }

  if (values["state-dir"] !== undefined) {
    if (values["state-dir"].length === 0) {
      ctx.stderr.write(`cesium serve: --state-dir must not be empty\n`);
      return null;
    }
    opts.stateDir = values["state-dir"];
  }

  if (values["idle-timeout"] !== undefined) {
    const ms = parseDuration(values["idle-timeout"]);
    if (ms === null) {
      ctx.stderr.write(
        `cesium serve: --idle-timeout must be a duration like "30m", "2h", "90s", or "0"/"never" to disable\n`,
      );
      return null;
    }
    opts.idleTimeoutMs = ms;
  }

  return opts;
}

export async function serveCommand(argv: string[], ctx?: Partial<ServeContext>): Promise<number> {
  const resolved: ServeContext = { ...defaultCtx(), ...ctx };

  const parseResult = parseServeArgs(argv, resolved);
  if (parseResult === null) return 1;
  if (parseResult === "help") return 0;

  const opts = parseResult;
  const cfg = (resolved.loadConfig ?? loadConfig)();

  // Foreground `cesium serve` defaults to NO idle timeout — when the user
  // launches the server explicitly, they want it to live until they Ctrl-C.
  // The configured idleTimeoutMs only applies to the plugin's lazy-started
  // server. --idle-timeout opts back into auto-shutdown.
  const effectiveIdleTimeoutMs = opts.idleTimeoutMs ?? 0;

  // Apply overrides from CLI flags
  const effectiveCfg = {
    ...cfg,
    ...(opts.stateDir !== undefined ? { stateDir: opts.stateDir } : {}),
    ...(opts.port !== undefined ? { port: opts.port, portMax: opts.port } : {}),
    ...(opts.hostname !== undefined ? { hostname: opts.hostname } : {}),
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
    resolved.stderr.write(`cesium serve: failed to start server: ${e.message}\n`);
    return 1;
  }

  const displayHost = resolveDisplayHost(effectiveCfg.hostname);
  const displayUrl = `http://${displayHost}:${serverInfo.port}`;

  // Expand home dir in stateDir for display
  const home = process.env["HOME"] ?? "";
  const stateDirDisplay = home ? effectiveCfg.stateDir.replace(home, "~") : effectiveCfg.stateDir;

  resolved.stdout.write(`cesium serve · ${displayUrl}\n`);
  resolved.stdout.write(`  serving ${stateDirDisplay}\n`);
  if (effectiveIdleTimeoutMs <= 0) {
    resolved.stdout.write(`  no idle timeout — runs until Ctrl-C\n`);
  } else {
    const minutes = Math.round(effectiveIdleTimeoutMs / 60_000);
    resolved.stdout.write(
      `  idle timeout: ${minutes >= 1 ? `${minutes}m` : `${effectiveIdleTimeoutMs}ms`} of inactivity\n`,
    );
  }
  resolved.stdout.write(`  Ctrl-C to stop\n`);

  // If binding on all interfaces, also print the LAN URL
  if (effectiveCfg.hostname === "0.0.0.0" || effectiveCfg.hostname === "::") {
    // resolveDisplayHost already returns the LAN IP for 0.0.0.0
    resolved.stdout.write(`  LAN: ${displayUrl}\n`);
  }

  // Run in the foreground until SIGINT/SIGTERM (handled by lifecycle module's signal handlers)
  // Keep the process alive by returning a promise that never resolves (until signal fires)
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
