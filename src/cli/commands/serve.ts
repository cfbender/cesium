// cesium serve — start the local HTTP server in the foreground.

import { parseArgs } from "node:util";
import { loadConfig, type CesiumConfig } from "../../config.ts";
import { ensureRunning, stopRunning } from "../../server/lifecycle.ts";
import { resolveDisplayHost } from "../../tools/publish.ts";

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
}

/** Parse the argv for serve. Returns null on error (already written to stderr). */
export function parseServeArgs(
  argv: string[],
  ctx: Pick<ServeContext, "stdout" | "stderr">,
): ServeOptions | null | "help" {
  let values: { port: string | undefined; hostname: string | undefined; help: boolean };

  try {
    const parsed = parseArgs({
      args: argv,
      options: {
        port: { type: "string", short: "p" },
        hostname: { type: "string", short: "H" },
        help: { type: "boolean", short: "h", default: false },
      },
      allowPositionals: false,
      strict: true,
    });
    values = parsed.values as typeof values;
  } catch (err) {
    const e = err as Error;
    ctx.stderr.write(`cesium serve: ${e.message}\n`);
    ctx.stderr.write(`Usage: cesium serve [--port N] [--hostname H]\n`);
    return null;
  }

  if (values.help) {
    ctx.stdout.write(
      [
        "Usage: cesium serve [options]",
        "",
        "Options:",
        "  --port, -p N      Override configured port (default: 3030)",
        "  --hostname, -H H  Override configured bind address (default: 127.0.0.1)",
        "  --help, -h        Show this help message",
        "",
        "Starts the cesium HTTP server in the foreground. Press Ctrl-C to stop.",
        "Uses the same config as the opencode plugin (~/.config/opencode/cesium.json).",
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

  return opts;
}

export async function serveCommand(argv: string[], ctx?: Partial<ServeContext>): Promise<number> {
  const resolved: ServeContext = { ...defaultCtx(), ...ctx };

  const parseResult = parseServeArgs(argv, resolved);
  if (parseResult === null) return 1;
  if (parseResult === "help") return 0;

  const opts = parseResult;
  const cfg = (resolved.loadConfig ?? loadConfig)();

  // Apply overrides from CLI flags
  const effectiveCfg = {
    ...cfg,
    ...(opts.port !== undefined ? { port: opts.port, portMax: opts.port } : {}),
    ...(opts.hostname !== undefined ? { hostname: opts.hostname } : {}),
  };

  let serverInfo: { port: number; url: string };
  try {
    serverInfo = await ensureRunning({
      stateDir: effectiveCfg.stateDir,
      port: effectiveCfg.port,
      portMax: effectiveCfg.portMax,
      idleTimeoutMs: effectiveCfg.idleTimeoutMs,
      hostname: effectiveCfg.hostname,
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
