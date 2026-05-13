import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runThemeShow, runThemeApply } from "../src/cli/commands/theme.ts";
import type { ThemeContext } from "../src/cli/commands/theme.ts";
import { themeFromPreset } from "../src/render/theme.ts";
import { writeThemeCss } from "../src/storage/theme-write.ts";

let stateDir: string;

beforeEach(() => {
  stateDir = mkdtempSync(join(tmpdir(), "cesium-cli-theme-"));
});

afterEach(() => {
  rmSync(stateDir, { recursive: true, force: true });
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeCtx(overrides: Partial<ThemeContext> = {}): ThemeContext & { output: string } {
  let output = "";
  return {
    stdout: {
      write: (s: string) => {
        output += s;
      },
    },
    stderr: {
      write: (s: string) => {
        output += s;
      },
    },
    loadConfig: () => ({
      stateDir,
      port: 3030,
      portMax: 3050,
      idleTimeoutMs: 1800000,
      hostname: "127.0.0.1",
    }),
    get output() {
      return output;
    },
    ...overrides,
  };
}

// ─── cesium theme show ────────────────────────────────────────────────────────

describe("cesium theme show", () => {
  test("prints resolved theme name", async () => {
    const ctx = makeCtx();
    await runThemeShow(ctx);
    expect(ctx.output).toContain("claret-dark (default)");
  });

  test("prints all 12 color tokens", async () => {
    const ctx = makeCtx();
    await runThemeShow(ctx);
    const keys = [
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
      expect(ctx.output).toContain(key);
    }
  });

  test("prints hex values for claret-dark palette", async () => {
    const ctx = makeCtx();
    await runThemeShow(ctx);
    expect(ctx.output).toContain("#180810"); // bg
    expect(ctx.output).toContain("#C75B7A"); // accent
  });

  test("indicates (write needed) when theme.css does not exist", async () => {
    const ctx = makeCtx();
    await runThemeShow(ctx);
    expect(ctx.output).toContain("write needed");
  });

  test("does NOT indicate write needed after theme apply", async () => {
    // Apply first
    await runThemeApply({ rewriteArtifacts: false }, makeCtx());
    // Then show
    const ctx = makeCtx();
    await runThemeShow(ctx);
    expect(ctx.output).not.toContain("write needed");
  });

  test("indicates write needed when theme.css has different content", async () => {
    // Write a stale theme.css manually
    await writeThemeCss(stateDir, themeFromPreset("warm"));
    const ctx = makeCtx();
    await runThemeShow(ctx);
    // Default theme is claret, but file has warm → write needed
    expect(ctx.output).toContain("write needed");
  });

  test("prints theme.css path", async () => {
    const ctx = makeCtx();
    await runThemeShow(ctx);
    expect(ctx.output).toContain(join(stateDir, "theme.css"));
  });

  test("returns exit code 0", async () => {
    const ctx = makeCtx();
    const code = await runThemeShow(ctx);
    expect(code).toBe(0);
  });
});

// ─── cesium theme apply ───────────────────────────────────────────────────────

describe("cesium theme apply", () => {
  test("writes theme.css to stateDir", async () => {
    await runThemeApply({ rewriteArtifacts: false }, makeCtx());
    expect(existsSync(join(stateDir, "theme.css"))).toBe(true);
  });

  test("theme.css contains claret-dark accent", async () => {
    await runThemeApply({ rewriteArtifacts: false }, makeCtx());
    const content = readFileSync(join(stateDir, "theme.css"), "utf8");
    expect(content).toContain("--accent: #C75B7A");
  });

  test("prints wrote path in output", async () => {
    const ctx = makeCtx();
    await runThemeApply({ rewriteArtifacts: false }, ctx);
    expect(ctx.output).toContain(join(stateDir, "theme.css"));
  });

  test("mentions inline fallback theme in output", async () => {
    const ctx = makeCtx();
    await runThemeApply({ rewriteArtifacts: false }, ctx);
    expect(ctx.output).toContain("inline fallback");
  });

  test("mentions --rewrite-artifacts hint", async () => {
    const ctx = makeCtx();
    await runThemeApply({ rewriteArtifacts: false }, ctx);
    expect(ctx.output).toContain("--rewrite-artifacts");
  });

  test("after apply, theme show no longer shows write needed", async () => {
    await runThemeApply({ rewriteArtifacts: false }, makeCtx());
    const ctx = makeCtx();
    await runThemeShow(ctx);
    expect(ctx.output).not.toContain("write needed");
  });

  test("returns exit code 0", async () => {
    const ctx = makeCtx();
    const code = await runThemeApply({ rewriteArtifacts: false }, ctx);
    expect(code).toBe(0);
  });
});

// ─── cesium theme apply --rewrite-artifacts ───────────────────────────────────

describe("cesium theme apply --rewrite-artifacts", () => {
  async function buildSyntheticStateDir(): Promise<{
    artifactPath: string;
    alreadyLinkedPath: string;
    projectIndexPath: string;
    globalIndexPath: string;
  }> {
    // Create a synthetic stateDir with a project, 2 artifacts (one missing link, one with it)
    const slug = "test-project";
    const artifactsDir = join(stateDir, "projects", slug, "artifacts");
    mkdirSync(artifactsDir, { recursive: true });

    const minimalArtifact = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Test · cesium</title>
  <style>:root { --bg: #fff; }</style>
  <script type="application/json" id="cesium-meta">{}</script>
</head>
<body><p>Test</p></body>
</html>`;

    const alreadyLinked = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Linked · cesium</title>
  <style>:root { --bg: #fff; }</style>
  <link rel="stylesheet" href="../../../theme.css">
  <script type="application/json" id="cesium-meta">{}</script>
</head>
<body><p>Linked</p></body>
</html>`;

    const artifactPath = join(artifactsDir, "test-artifact.html");
    const alreadyLinkedPath = join(artifactsDir, "already-linked.html");
    writeFileSync(artifactPath, minimalArtifact);
    writeFileSync(alreadyLinkedPath, alreadyLinked);

    // Project index
    const projectIndexPath = join(stateDir, "projects", slug, "index.html");
    writeFileSync(projectIndexPath, minimalArtifact);

    // Global index
    const globalIndexPath = join(stateDir, "index.html");
    writeFileSync(globalIndexPath, minimalArtifact);

    return { artifactPath, alreadyLinkedPath, projectIndexPath, globalIndexPath };
  }

  test("adds link to artifact missing it", async () => {
    const { artifactPath } = await buildSyntheticStateDir();
    await runThemeApply({ rewriteArtifacts: true }, makeCtx());
    const html = readFileSync(artifactPath, "utf8");
    expect(html).toContain('<link rel="stylesheet" href="../../../theme.css">');
  });

  test("does NOT add duplicate link to artifact that already has it", async () => {
    const { alreadyLinkedPath } = await buildSyntheticStateDir();
    await runThemeApply({ rewriteArtifacts: true }, makeCtx());
    const html = readFileSync(alreadyLinkedPath, "utf8");
    // Should have exactly one link tag
    const linkCount = (html.match(/<link rel="stylesheet"/g) ?? []).length;
    expect(linkCount).toBe(1);
  });

  test("idempotent: running twice has no additional effect on artifact", async () => {
    const { artifactPath } = await buildSyntheticStateDir();
    await runThemeApply({ rewriteArtifacts: true }, makeCtx());
    const afterFirst = readFileSync(artifactPath, "utf8");
    await runThemeApply({ rewriteArtifacts: true }, makeCtx());
    const afterSecond = readFileSync(artifactPath, "utf8");
    expect(afterFirst).toBe(afterSecond);
  });

  test("adds correct relative path for project index (../../theme.css)", async () => {
    const { projectIndexPath } = await buildSyntheticStateDir();
    await runThemeApply({ rewriteArtifacts: true }, makeCtx());
    const html = readFileSync(projectIndexPath, "utf8");
    expect(html).toContain('<link rel="stylesheet" href="../../theme.css">');
  });

  test("adds correct relative path for global index (theme.css)", async () => {
    const { globalIndexPath } = await buildSyntheticStateDir();
    await runThemeApply({ rewriteArtifacts: true }, makeCtx());
    const html = readFileSync(globalIndexPath, "utf8");
    expect(html).toContain('<link rel="stylesheet" href="theme.css">');
  });

  test("prints retrofit count summary", async () => {
    await buildSyntheticStateDir();
    const ctx = makeCtx();
    await runThemeApply({ rewriteArtifacts: true }, ctx);
    expect(ctx.output).toContain("Retrofitted");
    expect(ctx.output).toContain("artifact");
  });

  test("returns exit code 0", async () => {
    const ctx = makeCtx();
    const code = await runThemeApply({ rewriteArtifacts: true }, ctx);
    expect(code).toBe(0);
  });
});
