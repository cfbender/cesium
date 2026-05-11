// cesium theme — show or apply the configured theme.

import { parseArgs } from "node:util";
import { readFile } from "node:fs/promises";
import { loadConfig, type CesiumConfig } from "../../config.ts";
import {
  themeFromPreset,
  mergeTheme,
  type ThemeTokens,
  type ThemePalette,
} from "../../render/theme.ts";
import { writeThemeCss, themeCssPath } from "../../storage/theme-write.ts";
import { themeTokensCss } from "../../render/theme.ts";
import { atomicWrite } from "../../storage/write.ts";
import { readdir } from "node:fs/promises";
import { join } from "node:path";

export interface ThemeContext {
  stdout: { write: (s: string) => void };
  stderr: { write: (s: string) => void };
  loadConfig?: () => CesiumConfig;
}

function defaultCtx(): ThemeContext {
  return {
    stdout: process.stdout,
    stderr: process.stderr,
  };
}

function resolveTheme(cfg: CesiumConfig): { theme: ThemeTokens; presetLabel: string } {
  const theme = mergeTheme(themeFromPreset(cfg.themePreset), cfg.theme);
  let presetLabel: string;
  if (cfg.themePreset === undefined) {
    presetLabel = "claret-dark (default)";
  } else if (cfg.themePreset === "claret") {
    presetLabel = "claret-dark (alias for claret)";
  } else {
    presetLabel = cfg.themePreset;
  }
  return { theme, presetLabel };
}

function printTokenTable(
  out: { write: (s: string) => void },
  theme: ThemeTokens,
  presetLabel: string,
  cssPath: string,
  writeNeeded: boolean,
): void {
  out.write(`Resolved theme: ${presetLabel}\n\n`);
  out.write("Tokens:\n");
  const { colors } = theme;
  const keys: (keyof ThemePalette)[] = [
    "bg",
    "surface",
    "surface2",
    "oat",
    "rule",
    "ink",
    "inkSoft",
    "muted",
    "accent",
    "olive",
    "codeBg",
    "codeFg",
  ];
  for (const key of keys) {
    out.write(`  ${key.padEnd(12)}${colors[key]}\n`);
  }
  out.write("\n");
  const suffix = writeNeeded ? "  (write needed)" : "";
  out.write(`theme.css path: ${cssPath}${suffix}\n`);
}

async function isWriteNeeded(cssPath: string, theme: ThemeTokens): Promise<boolean> {
  const expected = themeTokensCss(theme) + "\n";
  try {
    const existing = await readFile(cssPath, "utf8");
    return existing !== expected;
  } catch {
    return true;
  }
}

// ─── Retrofit logic ───────────────────────────────────────────────────────────

/**
 * Compute the relative path to theme.css from a given file path within stateDir.
 * - artifact:       <stateDir>/projects/<slug>/artifacts/<file>.html → ../../../theme.css
 * - project index:  <stateDir>/projects/<slug>/index.html            → ../../theme.css
 * - global index:   <stateDir>/index.html                            → theme.css
 */
function relThemeCssPath(filePath: string, stateDir: string): string {
  // Normalize: strip stateDir prefix
  const norm = stateDir.endsWith("/") ? stateDir : stateDir + "/";
  const rel = filePath.startsWith(norm) ? filePath.slice(norm.length) : filePath;
  const parts = rel.split("/");
  // parts.length - 1 = directory depth
  const depth = parts.length - 1;
  if (depth === 0) return "theme.css"; // root = global index
  if (depth === 2) return "../../theme.css"; // projects/<slug>/index.html
  if (depth === 3) return "../../../theme.css"; // projects/<slug>/artifacts/*.html
  // Fallback: go up depth directories
  return "../".repeat(depth) + "theme.css";
}

async function retrofitFile(
  filePath: string,
  stateDir: string,
  out: { write: (s: string) => void },
): Promise<boolean> {
  let html: string;
  try {
    html = await readFile(filePath, "utf8");
  } catch {
    return false;
  }

  const relPath = relThemeCssPath(filePath, stateDir);
  const linkTag = `<link rel="stylesheet" href="${relPath}">`;

  // Check if already has this exact link
  if (html.includes(linkTag)) return false;

  // Insert before </head>
  const newHtml = html.replace("</head>", `${linkTag}\n</head>`);
  if (newHtml === html) return false; // no </head> found — skip

  try {
    await atomicWrite(filePath, newHtml);
    out.write(`  retrofitted ${filePath}\n`);
    return true;
  } catch {
    return false;
  }
}

async function retrofitAll(
  stateDir: string,
  out: { write: (s: string) => void },
): Promise<{ artifacts: number; indexes: number }> {
  // Collect all file paths to potentially retrofit
  const tasks: Array<{ filePath: string; kind: "artifact" | "index" }> = [];

  // Global index
  tasks.push({ filePath: join(stateDir, "index.html"), kind: "index" });

  // Walk projects
  const projectsDir = join(stateDir, "projects");
  let slugs: string[] = [];
  try {
    slugs = await readdir(projectsDir);
  } catch {
    // No projects dir yet
  }

  const perSlugFiles = await Promise.all(
    slugs.map(async (slug) => {
      const projectDir = join(projectsDir, slug);
      const results: Array<{ filePath: string; kind: "artifact" | "index" }> = [];

      results.push({ filePath: join(projectDir, "index.html"), kind: "index" });

      const artifactsDir = join(projectDir, "artifacts");
      let files: string[] = [];
      try {
        files = (await readdir(artifactsDir)).filter((f) => f.endsWith(".html"));
      } catch {
        // No artifacts dir yet
      }
      for (const filename of files) {
        results.push({ filePath: join(artifactsDir, filename), kind: "artifact" });
      }
      return results;
    }),
  );

  for (const batch of perSlugFiles) {
    for (const item of batch) {
      tasks.push(item);
    }
  }

  // Retrofit all files in parallel
  const results = await Promise.all(
    tasks.map(async ({ filePath, kind }) => {
      const changed = await retrofitFile(filePath, stateDir, out);
      return { changed, kind };
    }),
  );

  let artifacts = 0;
  let indexes = 0;
  for (const { changed, kind } of results) {
    if (changed) {
      if (kind === "artifact") artifacts++;
      else indexes++;
    }
  }

  return { artifacts, indexes };
}

// ─── Command ──────────────────────────────────────────────────────────────────

export async function themeCommand(argv: string[], ctx?: Partial<ThemeContext>): Promise<number> {
  const resolved: ThemeContext = { ...defaultCtx(), ...ctx };

  const subcommand = argv[0];
  const rest = argv.slice(1);

  if (!subcommand || subcommand === "--help" || subcommand === "-h") {
    resolved.stdout.write(
      [
        "Usage: cesium theme <subcommand> [options]",
        "",
        "Subcommands:",
        "  show                        Print resolved theme tokens",
        "  apply [--rewrite-artifacts] Write theme.css from current config",
        "",
        "Options:",
        "  --help, -h  Show this help message",
        "",
      ].join("\n"),
    );
    return subcommand ? 0 : 1;
  }

  if (subcommand === "show") {
    return themeShowCommand(rest, resolved);
  }

  if (subcommand === "apply") {
    return themeApplyCommand(rest, resolved);
  }

  resolved.stderr.write(`cesium theme: unknown subcommand: ${subcommand}\n`);
  return 1;
}

async function themeShowCommand(argv: string[], ctx: ThemeContext): Promise<number> {
  let values: { help: boolean };
  try {
    const parsed = parseArgs({
      args: argv,
      options: { help: { type: "boolean", short: "h", default: false } },
      allowPositionals: false,
      strict: true,
    });
    values = parsed.values as typeof values;
  } catch (err) {
    const e = err as Error;
    ctx.stderr.write(`cesium theme show: ${e.message}\n`);
    return 1;
  }

  if (values.help) {
    ctx.stdout.write("Usage: cesium theme show\n\nPrint resolved theme tokens.\n\n");
    return 0;
  }

  const cfg = (ctx.loadConfig ?? loadConfig)();
  const { theme, presetLabel } = resolveTheme(cfg);
  const cssPath = themeCssPath(cfg.stateDir);
  const writeNeeded = await isWriteNeeded(cssPath, theme);

  printTokenTable(ctx.stdout, theme, presetLabel, cssPath, writeNeeded);
  return 0;
}

async function themeApplyCommand(argv: string[], ctx: ThemeContext): Promise<number> {
  let values: { "rewrite-artifacts": boolean; help: boolean };
  try {
    const parsed = parseArgs({
      args: argv,
      options: {
        "rewrite-artifacts": { type: "boolean", default: false },
        help: { type: "boolean", short: "h", default: false },
      },
      allowPositionals: false,
      strict: true,
    });
    values = parsed.values as typeof values;
  } catch (err) {
    const e = err as Error;
    ctx.stderr.write(`cesium theme apply: ${e.message}\n`);
    return 1;
  }

  if (values.help) {
    ctx.stdout.write(
      [
        "Usage: cesium theme apply [--rewrite-artifacts]",
        "",
        "Write theme.css from the current config.",
        "",
        "Options:",
        "  --rewrite-artifacts  Retrofit existing artifacts and index pages with the theme link",
        "  --help, -h           Show this help message",
        "",
      ].join("\n"),
    );
    return 0;
  }

  const cfg = (ctx.loadConfig ?? loadConfig)();
  const { theme, presetLabel } = resolveTheme(cfg);
  const cssPath = await writeThemeCss(cfg.stateDir, theme);

  if (values["rewrite-artifacts"]) {
    const { artifacts, indexes } = await retrofitAll(cfg.stateDir, ctx.stdout);
    ctx.stdout.write(
      [
        `Wrote ${cssPath} (${presetLabel} preset).`,
        `Retrofitted ${artifacts} artifact${artifacts !== 1 ? "s" : ""} and ${indexes} index${indexes !== 1 ? "es" : ""} with the theme link.`,
        "Files without prior theme links now pick up theme.css.",
        "",
      ].join("\n"),
    );
  } else {
    ctx.stdout.write(
      [
        `Wrote ${cssPath} (${presetLabel} preset).`,
        "Existing artifacts continue rendering with their inline fallback theme.",
        "Run with --rewrite-artifacts to retrofit them.",
        "",
      ].join("\n"),
    );
  }

  return 0;
}
