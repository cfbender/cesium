// cesium prune — delete artifacts older than a given duration.

import { parseArgs } from "node:util";
import { join } from "node:path";
import { readdir, unlink as fsUnlink, stat } from "node:fs/promises";
import { loadConfig, type CesiumConfig } from "../../config.ts";
import { loadIndex, writeIndex, type IndexEntry } from "../../storage/index-cache.ts";
import { atomicWrite } from "../../storage/write.ts";
import {
  renderProjectIndex,
  renderGlobalIndex,
  summarizeProject,
} from "../../storage/index-gen.ts";
import { themeFromPreset, mergeTheme } from "../../render/theme.ts";
import { readEmbeddedMetadata } from "../../storage/write.ts";
import { readFile } from "node:fs/promises";

export interface PruneContext {
  stdout: { write: (s: string) => void };
  stderr: { write: (s: string) => void };
  loadConfig?: () => CesiumConfig;
  now?: () => Date;
}

function defaultCtx(): PruneContext {
  return {
    stdout: process.stdout,
    stderr: process.stderr,
  };
}

// ─── Duration parser ──────────────────────────────────────────────────────────

/** Parse a duration string like "90d", "2w", "12h", "30m" into milliseconds. */
export function parseDuration(s: string): number | null {
  const trimmed = s.trim().toLowerCase();
  const match = /^(\d+)(d|w|h|m)$/.exec(trimmed);
  if (!match) return null;

  const n = parseInt(match[1] ?? "", 10);
  const unit = match[2] ?? "";

  switch (unit) {
    case "m":
      return n * 60 * 1000;
    case "h":
      return n * 60 * 60 * 1000;
    case "d":
      return n * 24 * 60 * 60 * 1000;
    case "w":
      return n * 7 * 24 * 60 * 60 * 1000;
    default:
      return null;
  }
}

// ─── Prune implementation ─────────────────────────────────────────────────────

interface ArtifactCandidate {
  projectSlug: string;
  projectDir: string;
  filename: string;
  filePath: string;
  createdAt: string;
}

/** Read metadata + fallback from one artifact file. Returns null to skip. */
async function readArtifactCandidate(
  stateDir: string,
  slug: string,
  filename: string,
): Promise<ArtifactCandidate | null> {
  const projectsDir = join(stateDir, "projects");
  const filePath = join(projectsDir, slug, "artifacts", filename);
  let createdAt: string | null = null;
  try {
    const html = await readFile(filePath, "utf8");
    const meta = readEmbeddedMetadata(html);
    if (meta !== null && typeof meta["createdAt"] === "string") {
      createdAt = meta["createdAt"];
    }
  } catch {
    return null;
  }
  if (createdAt === null) {
    try {
      const s = await stat(filePath);
      createdAt = s.mtime.toISOString();
    } catch {
      return null;
    }
  }
  return {
    projectSlug: slug,
    projectDir: join(projectsDir, slug),
    filename,
    filePath,
    createdAt,
  };
}

/** Read all artifact filenames for one project slug. Returns [] on missing dir. */
async function readProjectFilenames(stateDir: string, slug: string): Promise<string[]> {
  const artifactsDir = join(stateDir, "projects", slug, "artifacts");
  try {
    const files = await readdir(artifactsDir);
    return files.filter((f) => f.endsWith(".html"));
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === "ENOENT") return [];
    throw err;
  }
}

async function collectAllArtifacts(stateDir: string): Promise<ArtifactCandidate[]> {
  const projectsDir = join(stateDir, "projects");
  let projectSlugs: string[];
  try {
    projectSlugs = await readdir(projectsDir);
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === "ENOENT") return [];
    throw err;
  }

  // Read all filenames for each project in parallel
  const filenameLists = await Promise.all(
    projectSlugs.map((slug) => readProjectFilenames(stateDir, slug)),
  );

  // Read each artifact's metadata in parallel
  const perProjectCandidates = await Promise.all(
    projectSlugs.map((slug, i) => {
      const filenames = filenameLists[i] ?? [];
      return Promise.all(
        filenames.map((filename) => readArtifactCandidate(stateDir, slug, filename)),
      );
    }),
  );

  return perProjectCandidates.flat().filter((c): c is ArtifactCandidate => c !== null);
}

function formatTable(candidates: ArtifactCandidate[]): string {
  const COL_PROJECT = 32;
  const COL_ID = 8;

  const header = "PROJECT".padEnd(COL_PROJECT) + "  " + "ID".padEnd(COL_ID) + "  CREATED";
  const sep = "─".repeat(header.length);

  const rows = candidates.map((c) => {
    // Extract id from filename: <date>__<slug>__<id>.html
    const parts = c.filename.replace(/\.html$/, "").split("__");
    const id = parts[parts.length - 1] ?? c.filename.slice(0, 8);

    const project =
      c.projectSlug.length > COL_PROJECT
        ? c.projectSlug.slice(0, COL_PROJECT - 1) + "…"
        : c.projectSlug.padEnd(COL_PROJECT);

    return project + "  " + id.slice(0, COL_ID).padEnd(COL_ID) + "  " + c.createdAt.slice(0, 19);
  });

  return [header, sep, ...rows].join("\n");
}

export async function pruneCommand(argv: string[], ctx?: Partial<PruneContext>): Promise<number> {
  const resolved: PruneContext = { ...defaultCtx(), ...ctx };

  let values: {
    "older-than": string | undefined;
    "dry-run": boolean;
    yes: boolean;
    help: boolean;
  };

  try {
    const parsed = parseArgs({
      args: argv,
      options: {
        "older-than": { type: "string" },
        "dry-run": { type: "boolean", default: false },
        yes: { type: "boolean", short: "y", default: false },
        help: { type: "boolean", short: "h", default: false },
      },
      allowPositionals: false,
      strict: true,
    });
    values = parsed.values as typeof values;
  } catch (err) {
    const e = err as Error;
    resolved.stderr.write(`cesium prune: ${e.message}\n`);
    resolved.stderr.write(`Usage: cesium prune --older-than <duration> [--yes]\n`);
    return 1;
  }

  if (values.help) {
    resolved.stdout.write(
      [
        "Usage: cesium prune --older-than <duration> [options]",
        "",
        "Options:",
        "  --older-than <dur>  Delete artifacts older than this duration (e.g. 90d, 2w, 12h, 30m)",
        "  --yes, -y           Actually delete (default is dry-run)",
        "  --dry-run           Explicit dry-run (same as omitting --yes)",
        "  --help, -h          Show this help message",
        "",
        "Duration format: <N><unit> where unit is d (days), w (weeks), h (hours), m (minutes).",
        "",
        "Note: prune deletes by age only. It does not check revision chains.",
        "      Deleting an early version in a supersedes chain does not affect the newer version.",
        "",
      ].join("\n"),
    );
    return 0;
  }

  const durationStr = values["older-than"];
  if (durationStr === undefined || durationStr.length === 0) {
    resolved.stderr.write(`cesium prune: --older-than is required\n`);
    resolved.stderr.write(`Usage: cesium prune --older-than <duration> [--yes]\n`);
    return 1;
  }

  const durationMs = parseDuration(durationStr);
  if (durationMs === null) {
    resolved.stderr.write(
      `cesium prune: invalid duration "${durationStr}". Use format like 90d, 2w, 12h, 30m\n`,
    );
    return 1;
  }

  const isDryRun = !values.yes;
  const cfg = (resolved.loadConfig ?? loadConfig)();
  const now = (resolved.now ?? (() => new Date()))();
  const cutoff = now.getTime() - durationMs;

  // Collect all artifacts
  let allArtifacts: ArtifactCandidate[];
  try {
    allArtifacts = await collectAllArtifacts(cfg.stateDir);
  } catch (err) {
    const e = err as Error;
    resolved.stderr.write(`cesium prune: failed to scan artifacts: ${e.message}\n`);
    return 1;
  }

  // Filter to those older than the cutoff
  const toDelete = allArtifacts.filter((c) => {
    const ts = new Date(c.createdAt).getTime();
    return ts < cutoff;
  });

  if (toDelete.length === 0) {
    resolved.stdout.write(`No artifacts older than ${durationStr} found.\n`);
    return 0;
  }

  if (isDryRun) {
    resolved.stdout.write(
      `Would delete ${toDelete.length} artifact${toDelete.length !== 1 ? "s" : ""} older than ${durationStr}:\n`,
    );
    resolved.stdout.write(formatTable(toDelete) + "\n\n");
    resolved.stdout.write(`Re-run with --yes to delete.\n`);
    return 0;
  }

  // Actually delete — in parallel, track counts
  const deleteResults = await Promise.all(
    toDelete.map(async (candidate) => {
      try {
        await fsUnlink(candidate.filePath);
        return true;
      } catch (err) {
        const e = err as NodeJS.ErrnoException;
        if (e.code !== "ENOENT") {
          resolved.stderr.write(
            `cesium prune: failed to delete ${candidate.filePath}: ${e.message}\n`,
          );
        }
        return false;
      }
    }),
  );
  const deletedCount = deleteResults.filter(Boolean).length;

  // Regenerate indexes for affected projects — in parallel
  const affectedSlugs = [...new Set(toDelete.map((c) => c.projectSlug))];
  const theme = mergeTheme(themeFromPreset(cfg.themePreset), cfg.theme);

  await Promise.all(
    affectedSlugs.map(async (slug) => {
      const projectDir = join(cfg.stateDir, "projects", slug);
      const projectIndexJsonPath = join(projectDir, "index.json");
      try {
        const projectEntries = await loadIndex(projectIndexJsonPath);
        const deletedFilenames = new Set(
          toDelete.filter((c) => c.projectSlug === slug).map((c) => c.filename),
        );
        const surviving: IndexEntry[] = projectEntries.filter(
          (e) => !deletedFilenames.has(e.filename),
        );
        await writeIndex(projectIndexJsonPath, surviving);
        const projectName = surviving[0]?.projectName ?? slug;
        const projectIndexHtml = renderProjectIndex({
          projectSlug: slug,
          projectName,
          entries: surviving,
          theme,
        });
        await atomicWrite(join(projectDir, "index.html"), projectIndexHtml);
      } catch {
        // best-effort — if project index is missing, skip
      }
    }),
  );

  // Regenerate global index
  try {
    const globalJsonPath = join(cfg.stateDir, "index.json");
    const globalEntries = await loadIndex(globalJsonPath);
    const deletedFilenames = new Set(toDelete.map((c) => c.filename));
    const survivingGlobal: IndexEntry[] = globalEntries.filter(
      (e) => !deletedFilenames.has(e.filename),
    );
    await writeIndex(globalJsonPath, survivingGlobal);

    // Build project summaries from surviving global entries
    const bySlug = new Map<string, { name: string; entries: IndexEntry[] }>();
    for (const e of survivingGlobal) {
      const g = bySlug.get(e.projectSlug) ?? { name: e.projectName, entries: [] };
      g.entries.push(e);
      bySlug.set(e.projectSlug, g);
    }
    const summaries = [...bySlug.entries()].map(([slug, { name, entries }]) =>
      summarizeProject({ slug, name, entries }),
    );
    const globalIndexHtml = renderGlobalIndex({ projects: summaries, theme });
    await atomicWrite(join(cfg.stateDir, "index.html"), globalIndexHtml);
  } catch {
    // best-effort
  }

  resolved.stdout.write(
    `Deleted ${deletedCount} artifact${deletedCount !== 1 ? "s" : ""}. Indexes regenerated.\n`,
  );
  return 0;
}
