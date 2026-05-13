// cesium export — emit an artifact's HTML to stdout (or a file).
//
// Because cesium artifacts are written with the full theme CSS baked into a
// <style> tag at generation time, an artifact file on disk is already a
// fully self-contained HTML document. Export is therefore a thin wrapper:
// resolve by id-prefix, read the file, write to stdout or --out.
//
// (When served by the cesium HTTP server, the <link rel="stylesheet"
// href=".../theme.css"> in the same artifact still loads and overrides the
// baked CSS in cascade order, so live theme changes apply server-side. The
// baked CSS only acts as the standalone fallback.)

import { defineCommand } from "citty";
import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { loadConfig, type CesiumConfig } from "../../config.ts";
import { loadIndex } from "../../storage/index-cache.ts";
import { pathsFor } from "../../storage/paths.ts";
import { atomicWrite } from "../../storage/write.ts";

export interface ExportArgs {
  idPrefix: string;
  out: string | null;
}

export interface ExportContext {
  stdout: { write: (s: string) => void };
  stderr: { write: (s: string) => void };
  loadConfig?: () => CesiumConfig;
}

function defaultCtx(): ExportContext {
  return {
    stdout: process.stdout,
    stderr: process.stderr,
  };
}

export async function runExport(
  args: ExportArgs,
  ctxOverride?: Partial<ExportContext>,
): Promise<number> {
  const ctx: ExportContext = { ...defaultCtx(), ...ctxOverride };

  if (args.idPrefix.length === 0) {
    ctx.stderr.write(`cesium export: missing required argument <id-prefix>\n`);
    return 1;
  }

  const prefixLower = args.idPrefix.toLowerCase();
  const cfg = (ctx.loadConfig ?? loadConfig)();

  // Resolve artifact via global index (same matching as `open`)
  const globalJsonPath = join(cfg.stateDir, "index.json");
  let allEntries;
  try {
    allEntries = await loadIndex(globalJsonPath);
  } catch (err) {
    const e = err as Error;
    ctx.stderr.write(`cesium export: failed to read index: ${e.message}\n`);
    return 1;
  }

  const matches = allEntries.filter((e) => e.id.toLowerCase().startsWith(prefixLower));

  if (matches.length === 0) {
    ctx.stderr.write(`cesium export: no artifact found with id prefix "${args.idPrefix}"\n`);
    return 1;
  }

  if (matches.length > 1) {
    ctx.stderr.write(
      `cesium export: ambiguous prefix "${args.idPrefix}" — ${matches.length} matches:\n`,
    );
    for (const m of matches) {
      ctx.stderr.write(`  ${m.id}  ${m.title}  (${m.kind})\n`);
    }
    return 2;
  }

  const entry = matches[0];
  if (entry === undefined) {
    // Unreachable; satisfies type checker
    ctx.stderr.write(`cesium export: internal error — no match\n`);
    return 1;
  }

  const paths = pathsFor({
    stateDir: cfg.stateDir,
    projectSlug: entry.projectSlug,
    filename: entry.filename,
  });

  let html: string;
  try {
    html = await readFile(paths.artifactPath, "utf8");
  } catch (err) {
    const e = err as Error;
    ctx.stderr.write(`cesium export: failed to read artifact: ${e.message}\n`);
    return 1;
  }

  if (args.out !== null) {
    try {
      await atomicWrite(args.out, html);
    } catch (err) {
      const e = err as Error;
      ctx.stderr.write(`cesium export: failed to write ${args.out}: ${e.message}\n`);
      return 1;
    }
    ctx.stderr.write(`Wrote ${args.out}\n`);
    return 0;
  }

  ctx.stdout.write(html);
  return 0;
}

export const exportCmd = defineCommand({
  meta: {
    name: "export",
    description: "Emit an artifact's self-contained HTML to stdout (or --out file).",
  },
  args: {
    idPrefix: {
      type: "positional",
      description: "Artifact id prefix (any unique substring of the id)",
      required: true,
    },
    out: {
      type: "string",
      alias: "o",
      description: "Write to this file path instead of stdout",
    },
  },
  async run({ args }) {
    const code = await runExport({
      idPrefix: args.idPrefix,
      out: args.out ?? null,
    });
    if (code !== 0) process.exit(code);
  },
});
