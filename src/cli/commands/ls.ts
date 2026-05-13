// cesium ls — list artifacts for current project (or all).

import { defineCommand } from "citty";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { loadConfig, type CesiumConfig } from "../../config.ts";
import { loadIndex, type IndexEntry } from "../../storage/index-cache.ts";
import { deriveProjectIdentity } from "../../storage/paths.ts";

export interface LsArgs {
  all: boolean;
  json: boolean;
  limit: number;
}

export interface LsContext {
  stdout: { write: (s: string) => void };
  stderr: { write: (s: string) => void };
  cwd: string;
  loadConfig?: () => CesiumConfig;
}

function defaultCtx(): LsContext {
  return {
    stdout: process.stdout,
    stderr: process.stderr,
    cwd: process.cwd(),
  };
}

/** Truncate a string to maxLen, appending "…" if truncated. */
function trunc(s: string, maxLen: number): string {
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen - 1) + "…";
}

/** Format an ISO date as "YYYY-MM-DDTHH:MM:SS" (no ms, no tz suffix). */
function fmtDate(iso: string): string {
  return iso.slice(0, 19);
}

/** Derive SUPER column value for an entry. */
function superCol(entry: IndexEntry): string {
  const parts: string[] = [];
  if (entry.supersededBy !== null) {
    parts.push(`→ ${entry.supersededBy.slice(0, 6)}`);
  }
  if (entry.supersedes !== null) {
    parts.push(`← ${entry.supersedes.slice(0, 6)}`);
  }
  return parts.join(" ");
}

function getGitRemote(cwd: string): string | null {
  try {
    const result = execSync("git config --get remote.origin.url", {
      cwd,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    return result || null;
  } catch {
    return null;
  }
}

/**
 * Inner command logic. Tests call this directly with typed args + injected
 * context for fast feedback; the Citty wrapper handles argv parsing.
 */
export async function runLs(args: LsArgs, ctxOverride?: Partial<LsContext>): Promise<number> {
  const ctx: LsContext = { ...defaultCtx(), ...ctxOverride };

  if (args.limit < 1) {
    ctx.stderr.write(`cesium ls: --limit must be a positive integer\n`);
    return 1;
  }

  const cfg = (ctx.loadConfig ?? loadConfig)();

  // Determine which index.json to read
  let jsonPath: string;
  if (args.all) {
    jsonPath = join(cfg.stateDir, "index.json");
  } else {
    const gitRemote = getGitRemote(ctx.cwd);
    const identity = deriveProjectIdentity({ cwd: ctx.cwd, gitRemote });
    jsonPath = join(cfg.stateDir, "projects", identity.slug, "index.json");
  }

  let entries: IndexEntry[];
  try {
    entries = await loadIndex(jsonPath);
  } catch (err) {
    const e = err as Error;
    ctx.stderr.write(`cesium ls: failed to read index: ${e.message}\n`);
    return 1;
  }

  const limited = entries.slice(0, args.limit);

  if (args.json) {
    ctx.stdout.write(JSON.stringify(limited, null, 2) + "\n");
    return 0;
  }

  if (limited.length === 0) {
    ctx.stdout.write("No artifacts found.\n");
    return 0;
  }

  const COL_ID = 6;
  const COL_KIND = 10;
  const COL_TITLE = 37;
  const COL_DATE = 19;

  const header =
    "ID".padEnd(COL_ID) +
    "  " +
    "KIND".padEnd(COL_KIND) +
    "  " +
    "TITLE".padEnd(COL_TITLE) +
    "  " +
    "CREATED".padEnd(COL_DATE) +
    "  " +
    "SUPER";

  const sep = "─".repeat(header.length);

  ctx.stdout.write(header + "\n");
  ctx.stdout.write(sep + "\n");

  for (const e of limited) {
    const row =
      e.id.slice(0, COL_ID).padEnd(COL_ID) +
      "  " +
      trunc(e.kind, COL_KIND).padEnd(COL_KIND) +
      "  " +
      trunc(e.title, COL_TITLE).padEnd(COL_TITLE) +
      "  " +
      fmtDate(e.createdAt).padEnd(COL_DATE) +
      "  " +
      superCol(e);
    ctx.stdout.write(row + "\n");
  }

  return 0;
}

export const lsCmd = defineCommand({
  meta: {
    name: "ls",
    description: "List artifacts in the current project (or all with --all).",
  },
  args: {
    all: {
      type: "boolean",
      alias: "a",
      default: false,
      description: "Show artifacts for all projects (default: current project only)",
    },
    json: {
      type: "boolean",
      default: false,
      description: "Output as JSON array",
    },
    limit: {
      type: "string",
      alias: "n",
      default: "50",
      description: "Show at most N most recent artifacts",
    },
  },
  async run({ args }) {
    const limit = parseInt(args.limit, 10);
    if (isNaN(limit) || limit < 1) {
      process.stderr.write(`cesium ls: --limit must be a positive integer\n`);
      process.exit(1);
    }
    const code = await runLs({ all: args.all, json: args.json, limit });
    if (code !== 0) process.exit(code);
  },
});
