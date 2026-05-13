import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runExport } from "../src/cli/commands/export.ts";
import type { ExportArgs, ExportContext } from "../src/cli/commands/export.ts";
import type { CesiumConfig } from "../src/config.ts";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeConfig(stateDir: string): CesiumConfig {
  return {
    stateDir,
    port: 3030,
    portMax: 3050,
    idleTimeoutMs: 1800000,
    hostname: "127.0.0.1",
  };
}

function captureCtx(stateDir: string): ExportContext & { out: string; err: string } {
  let out = "";
  let err = "";
  return {
    stdout: {
      write: (s: string) => {
        out += s;
      },
    },
    stderr: {
      write: (s: string) => {
        err += s;
      },
    },
    loadConfig: () => makeConfig(stateDir),
    get out() {
      return out;
    },
    get err() {
      return err;
    },
  };
}

function makeIndexEntry(
  overrides: Partial<{
    id: string;
    title: string;
    kind: string;
    projectSlug: string;
    filename: string;
  }> = {},
) {
  const id = overrides.id ?? "abc123";
  const slug = overrides.projectSlug ?? "github-com-cfb-test";
  const filename = overrides.filename ?? `2026-05-13T00-00-00Z__test-plan__${id}.html`;
  return {
    id,
    title: overrides.title ?? "Test Plan",
    kind: overrides.kind ?? "plan",
    summary: null,
    tags: [],
    createdAt: "2026-05-13T00:00:00.000Z",
    filename,
    supersedes: null,
    supersededBy: null,
    gitBranch: null,
    gitCommit: null,
    contentSha256: "abc",
    projectSlug: slug,
    projectName: "test",
    bodyText: "",
  };
}

function writeGlobalIndex(stateDir: string, entries: ReturnType<typeof makeIndexEntry>[]) {
  mkdirSync(stateDir, { recursive: true });
  writeFileSync(join(stateDir, "index.json"), JSON.stringify(entries, null, 2));
}

/** Write a synthetic artifact file to <stateDir>/projects/<slug>/artifacts/<filename>. */
function writeArtifact(stateDir: string, slug: string, filename: string, html: string): string {
  const artifactsDir = join(stateDir, "projects", slug, "artifacts");
  mkdirSync(artifactsDir, { recursive: true });
  const path = join(artifactsDir, filename);
  writeFileSync(path, html);
  return path;
}

const SAMPLE_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Sample · cesium</title>
  <style>:root { --accent: #C75B7A; } .card { border: 1px solid; }</style>
  <link rel="stylesheet" href="../../../theme.css">
  <script type="application/json" id="cesium-meta">{"id":"abc123"}</script>
</head>
<body>
<p>Hello</p>
</body>
</html>`;

// ─── runExport ────────────────────────────────────────────────────────────────

let stateDir: string;

beforeEach(() => {
  stateDir = mkdtempSync(join(tmpdir(), "cesium-export-"));
});

afterEach(() => {
  rmSync(stateDir, { recursive: true, force: true });
});

const baseArgs: ExportArgs = { idPrefix: "", out: null };

describe("runExport", () => {
  test("missing id-prefix returns 1", async () => {
    writeGlobalIndex(stateDir, []);
    const ctx = captureCtx(stateDir);
    const code = await runExport(baseArgs, ctx);
    expect(code).toBe(1);
    expect(ctx.err).toContain("missing required argument");
  });

  test("non-matching prefix returns 1", async () => {
    writeGlobalIndex(stateDir, [makeIndexEntry({ id: "abc123" })]);
    const ctx = captureCtx(stateDir);
    const code = await runExport({ ...baseArgs, idPrefix: "xyz" }, ctx);
    expect(code).toBe(1);
    expect(ctx.err).toContain("no artifact found");
  });

  test("ambiguous prefix returns 2 and lists matches", async () => {
    writeGlobalIndex(stateDir, [
      makeIndexEntry({ id: "abc123", title: "Plan A" }),
      makeIndexEntry({ id: "abc456", title: "Plan B" }),
    ]);
    const ctx = captureCtx(stateDir);
    const code = await runExport({ ...baseArgs, idPrefix: "abc" }, ctx);
    expect(code).toBe(2);
    expect(ctx.err).toContain("ambiguous prefix");
    expect(ctx.err).toContain("abc123");
    expect(ctx.err).toContain("abc456");
  });

  test("stdout receives the on-disk HTML verbatim", async () => {
    const entry = makeIndexEntry({ id: "abc123" });
    writeGlobalIndex(stateDir, [entry]);
    writeArtifact(stateDir, entry.projectSlug, entry.filename, SAMPLE_HTML);

    const ctx = captureCtx(stateDir);
    const code = await runExport({ ...baseArgs, idPrefix: "abc123" }, ctx);
    expect(code).toBe(0);
    // Bit-for-bit equal — export is a pure copy
    expect(ctx.out).toBe(SAMPLE_HTML);
  });

  test("--out writes file atomically and reports path on stderr", async () => {
    const entry = makeIndexEntry({ id: "abc123" });
    writeGlobalIndex(stateDir, [entry]);
    writeArtifact(stateDir, entry.projectSlug, entry.filename, SAMPLE_HTML);

    const outPath = join(stateDir, "exported.html");
    const ctx = captureCtx(stateDir);
    const code = await runExport({ ...baseArgs, idPrefix: "abc123", out: outPath }, ctx);
    expect(code).toBe(0);
    expect(existsSync(outPath)).toBe(true);
    expect(readFileSync(outPath, "utf8")).toBe(SAMPLE_HTML);
    // Stdout stays clean when --out is used; user gets a confirmation on stderr
    expect(ctx.out).toBe("");
    expect(ctx.err).toContain("Wrote");
    expect(ctx.err).toContain(outPath);
  });

  test("case-insensitive prefix match works", async () => {
    const entry = makeIndexEntry({ id: "AbCdEf" });
    writeGlobalIndex(stateDir, [entry]);
    writeArtifact(stateDir, entry.projectSlug, entry.filename, SAMPLE_HTML);

    const ctx = captureCtx(stateDir);
    const code = await runExport({ ...baseArgs, idPrefix: "abcdef" }, ctx);
    expect(code).toBe(0);
    expect(ctx.out).toBe(SAMPLE_HTML);
  });

  test("missing artifact file returns 1 with error", async () => {
    const entry = makeIndexEntry({ id: "abc123" });
    writeGlobalIndex(stateDir, [entry]);
    // Don't write the artifact file — index says it exists but file is missing

    const ctx = captureCtx(stateDir);
    const code = await runExport({ ...baseArgs, idPrefix: "abc123" }, ctx);
    expect(code).toBe(1);
    expect(ctx.err).toContain("failed to read artifact");
  });

  test("missing global index returns 1", async () => {
    // No index.json — empty stateDir
    mkdirSync(stateDir, { recursive: true });
    const ctx = captureCtx(stateDir);
    const code = await runExport({ ...baseArgs, idPrefix: "abc123" }, ctx);
    // loadIndex returns [] for a missing file, so we hit "no artifact found"
    expect(code).toBe(1);
    expect(ctx.err).toContain("no artifact found");
  });
});
