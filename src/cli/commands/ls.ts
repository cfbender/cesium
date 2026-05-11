// cesium ls — list artifacts for current project (or all).

import { parseArgs } from "node:util";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { loadConfig, type CesiumConfig } from "../../config.ts";
import { loadIndex, type IndexEntry } from "../../storage/index-cache.ts";
import { deriveProjectIdentity } from "../../storage/paths.ts";

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

export async function lsCommand(argv: string[], ctx?: Partial<LsContext>): Promise<number> {
  const resolved: LsContext = { ...defaultCtx(), ...ctx };

  let values: {
    all: boolean;
    json: boolean;
    limit: string | undefined;
    help: boolean;
  };

  try {
    const parsed = parseArgs({
      args: argv,
      options: {
        all: { type: "boolean", short: "a", default: false },
        json: { type: "boolean", default: false },
        limit: { type: "string", short: "n" },
        help: { type: "boolean", short: "h", default: false },
      },
      allowPositionals: false,
      strict: true,
    });
    values = parsed.values as typeof values;
  } catch (err) {
    const e = err as Error;
    resolved.stderr.write(`cesium ls: ${e.message}\n`);
    resolved.stderr.write(`Usage: cesium ls [--all] [--json] [--limit N]\n`);
    return 1;
  }

  if (values.help) {
    resolved.stdout.write(
      [
        "Usage: cesium ls [options]",
        "",
        "Options:",
        "  --all, -a      Show artifacts for all projects (default: current project only)",
        "  --json         Output as JSON array",
        "  --limit, -n N  Show at most N most recent artifacts (default: 50)",
        "  --help, -h     Show this help message",
        "",
      ].join("\n"),
    );
    return 0;
  }

  const limitRaw = values.limit !== undefined ? parseInt(values.limit, 10) : 50;
  if (isNaN(limitRaw) || limitRaw < 1) {
    resolved.stderr.write(`cesium ls: --limit must be a positive integer\n`);
    return 1;
  }
  const limit = limitRaw;

  // Load config
  const cfg = (resolved.loadConfig ?? loadConfig)();

  // Determine which index.json to read
  let jsonPath: string;
  if (values.all) {
    jsonPath = join(cfg.stateDir, "index.json");
  } else {
    const gitRemote = getGitRemote(resolved.cwd);
    const identity = deriveProjectIdentity({ cwd: resolved.cwd, gitRemote });
    jsonPath = join(cfg.stateDir, "projects", identity.slug, "index.json");
  }

  let entries: IndexEntry[];
  try {
    entries = await loadIndex(jsonPath);
  } catch (err) {
    const e = err as Error;
    resolved.stderr.write(`cesium ls: failed to read index: ${e.message}\n`);
    return 1;
  }

  // Already sorted newest-first by loadIndex / appendEntry; apply limit
  const limited = entries.slice(0, limit);

  if (values.json) {
    resolved.stdout.write(JSON.stringify(limited, null, 2) + "\n");
    return 0;
  }

  // Table output
  if (limited.length === 0) {
    resolved.stdout.write("No artifacts found.\n");
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

  resolved.stdout.write(header + "\n");
  resolved.stdout.write(sep + "\n");

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
    resolved.stdout.write(row + "\n");
  }

  return 0;
}
