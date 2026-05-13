// cesium open — find an artifact by id prefix and open it in the browser.

import { defineCommand } from "citty";
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

export interface OpenArgs {
  idPrefix: string;
  print: boolean;
}

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

export async function runOpen(args: OpenArgs, ctxOverride?: Partial<OpenContext>): Promise<number> {
  const ctx: OpenContext = { ...defaultCtx(), ...ctxOverride };

  if (args.idPrefix.length === 0) {
    ctx.stderr.write(`cesium open: missing required argument <id-prefix>\n`);
    return 1;
  }

  const prefixLower = args.idPrefix.toLowerCase();
  const cfg = (ctx.loadConfig ?? loadConfig)();

  // Search global index for matches
  const globalJsonPath = join(cfg.stateDir, "index.json");
  let allEntries;
  try {
    allEntries = await loadIndex(globalJsonPath);
  } catch (err) {
    const e = err as Error;
    ctx.stderr.write(`cesium open: failed to read index: ${e.message}\n`);
    return 1;
  }

  const matches = allEntries.filter((e) => e.id.toLowerCase().startsWith(prefixLower));

  if (matches.length === 0) {
    ctx.stderr.write(`cesium open: no artifact found with id prefix "${args.idPrefix}"\n`);
    return 1;
  }

  if (matches.length > 1) {
    ctx.stderr.write(
      `cesium open: ambiguous prefix "${args.idPrefix}" — ${matches.length} matches:\n`,
    );
    for (const m of matches) {
      ctx.stderr.write(`  ${m.id}  ${m.title}  (${m.kind})\n`);
    }
    return 2;
  }

  const entry = matches[0];
  if (entry === undefined) {
    // Unreachable: guarded by matches.length === 1, but satisfies the type checker
    ctx.stderr.write(`cesium open: internal error — no match\n`);
    return 1;
  }
  const paths = pathsFor({
    stateDir: cfg.stateDir,
    projectSlug: entry.projectSlug,
    filename: entry.filename,
  });

  // Resolve URL
  const runEnsureRunning = ctx.ensureRunning ?? ensureRunning;
  const httpUrl = await tryGetHttpUrl(cfg, paths.serverPath, runEnsureRunning);
  const url = httpUrl ?? paths.fileUrl;

  if (args.print) {
    ctx.stdout.write(url + "\n");
    return 0;
  }

  const open = ctx.opener ?? defaultOpener;
  try {
    await open(url);
  } catch (err) {
    const e = err as Error;
    ctx.stderr.write(`cesium open: ${e.message}\n`);
    ctx.stdout.write(`URL: ${url}\n`);
    return 1;
  }

  return 0;
}

export const openCmd = defineCommand({
  meta: {
    name: "open",
    description: "Open an artifact by id prefix in the browser.",
  },
  args: {
    idPrefix: {
      type: "positional",
      description: "Artifact id prefix (any unique substring of the id)",
      required: true,
    },
    print: {
      type: "boolean",
      default: false,
      description: "Print the URL instead of opening in the browser",
    },
  },
  async run({ args }) {
    const code = await runOpen({ idPrefix: args.idPrefix, print: args.print });
    if (code !== 0) process.exit(code);
  },
});
