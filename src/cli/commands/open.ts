// cesium open — find an artifact by id prefix and open it in the browser.

import { parseArgs } from "node:util";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { platform } from "node:os";
import { loadConfig, type CesiumConfig } from "../../config.ts";
import { loadIndex } from "../../storage/index-cache.ts";
import { pathsFor } from "../../storage/paths.ts";
import {
  ensureRunning,
  readPidFile,
  isAlive,
  type LifecycleConfig,
} from "../../server/lifecycle.ts";
import { resolveDisplayHost } from "../../tools/publish.ts";

export interface OpenContext {
  stdout: { write: (s: string) => void };
  stderr: { write: (s: string) => void };
  loadConfig?: () => CesiumConfig;
  opener?: (url: string) => Promise<void>;
  ensureRunning?: (cfg: LifecycleConfig) => Promise<{ port: number; url: string } | null>;
}

function defaultCtx(): OpenContext {
  return {
    stdout: process.stdout,
    stderr: process.stderr,
  };
}

/** Default OS-native URL opener. */
async function defaultOpener(url: string): Promise<void> {
  const os = platform();
  let cmd: string;
  let args: string[];

  if (os === "darwin") {
    cmd = "open";
    args = [url];
  } else if (os === "linux") {
    cmd = "xdg-open";
    args = [url];
  } else {
    // Windows and others: not supported in v1
    throw new Error(
      "cesium open: browser launch is not supported on this platform. Use --print to get the URL.",
    );
  }

  await new Promise<void>((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: "ignore", detached: true });
    child.unref();
    child.on("error", reject);
    child.on("spawn", resolve);
  });
}

/** Try to resolve an http URL for the artifact. Returns null if server unavailable. */
async function tryGetHttpUrl(
  cfg: CesiumConfig,
  serverPath: string,
  runEnsureRunning: (cfg: LifecycleConfig) => Promise<{ port: number; url: string } | null>,
): Promise<string | null> {
  // First check existing PID file (fast path — no new server start needed for `open`)
  const pidFilePath = join(cfg.stateDir, ".server.pid");
  const pidContent = readPidFile(pidFilePath);
  if (pidContent !== null && isAlive(pidContent.pid)) {
    const displayHost = resolveDisplayHost(pidContent.hostname);
    return `http://${displayHost}:${pidContent.port}${serverPath}`;
  }

  // Try to start server
  try {
    const info = await runEnsureRunning({
      stateDir: cfg.stateDir,
      port: cfg.port,
      portMax: cfg.portMax,
      idleTimeoutMs: cfg.idleTimeoutMs,
      hostname: cfg.hostname,
    });
    if (info !== null) {
      const displayHost = resolveDisplayHost(cfg.hostname);
      return `http://${displayHost}:${info.port}${serverPath}`;
    }
  } catch {
    // server failed to start — fall back to file://
  }
  return null;
}

export async function openCommand(argv: string[], ctx?: Partial<OpenContext>): Promise<number> {
  const resolved: OpenContext = { ...defaultCtx(), ...ctx };

  let values: { print: boolean; help: boolean };
  let positionals: string[];

  try {
    const parsed = parseArgs({
      args: argv,
      options: {
        print: { type: "boolean", default: false },
        help: { type: "boolean", short: "h", default: false },
      },
      allowPositionals: true,
      strict: true,
    });
    values = parsed.values as typeof values;
    positionals = parsed.positionals;
  } catch (err) {
    const e = err as Error;
    resolved.stderr.write(`cesium open: ${e.message}\n`);
    resolved.stderr.write(`Usage: cesium open <id-prefix> [--print]\n`);
    return 1;
  }

  if (values.help) {
    resolved.stdout.write(
      [
        "Usage: cesium open <id-prefix> [options]",
        "",
        "Options:",
        "  --print     Print the URL instead of opening in the browser",
        "  --help, -h  Show this help message",
        "",
        "Notes:",
        "  Browser launch is supported on macOS (open) and Linux (xdg-open).",
        "  On Windows, use --print to get the URL.",
        "",
      ].join("\n"),
    );
    return 0;
  }

  const idPrefix = positionals[0];
  if (idPrefix === undefined || idPrefix.length === 0) {
    resolved.stderr.write(`cesium open: missing required argument <id-prefix>\n`);
    resolved.stderr.write(`Usage: cesium open <id-prefix> [--print]\n`);
    return 1;
  }

  const prefixLower = idPrefix.toLowerCase();

  const cfg = (resolved.loadConfig ?? loadConfig)();

  // Search global index for matches
  const globalJsonPath = join(cfg.stateDir, "index.json");
  let allEntries;
  try {
    allEntries = await loadIndex(globalJsonPath);
  } catch (err) {
    const e = err as Error;
    resolved.stderr.write(`cesium open: failed to read index: ${e.message}\n`);
    return 1;
  }

  const matches = allEntries.filter((e) => e.id.toLowerCase().startsWith(prefixLower));

  if (matches.length === 0) {
    resolved.stderr.write(`cesium open: no artifact found with id prefix "${idPrefix}"\n`);
    return 1;
  }

  if (matches.length > 1) {
    resolved.stderr.write(
      `cesium open: ambiguous prefix "${idPrefix}" — ${matches.length} matches:\n`,
    );
    for (const m of matches) {
      resolved.stderr.write(`  ${m.id}  ${m.title}  (${m.kind})\n`);
    }
    return 2;
  }

  const entry = matches[0];
  if (entry === undefined) {
    // Unreachable: guarded by matches.length === 1, but satisfies the type checker
    resolved.stderr.write(`cesium open: internal error — no match\n`);
    return 1;
  }
  const paths = pathsFor({
    stateDir: cfg.stateDir,
    projectSlug: entry.projectSlug,
    filename: entry.filename,
  });

  // Resolve URL
  const runEnsureRunning = resolved.ensureRunning ?? ensureRunning;
  const httpUrl = await tryGetHttpUrl(cfg, paths.serverPath, runEnsureRunning);
  const url = httpUrl ?? paths.fileUrl;

  if (values.print) {
    resolved.stdout.write(url + "\n");
    return 0;
  }

  const open = resolved.opener ?? defaultOpener;
  try {
    await open(url);
  } catch (err) {
    const e = err as Error;
    resolved.stderr.write(`cesium open: ${e.message}\n`);
    resolved.stdout.write(`URL: ${url}\n`);
    return 1;
  }

  return 0;
}
