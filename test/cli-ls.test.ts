import { test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runLs } from "../src/cli/commands/ls.ts";
import type { LsArgs, LsContext } from "../src/cli/commands/ls.ts";
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

function captureCtx(stateDir: string, cwd?: string): LsContext & { out: string; err: string } {
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
    cwd: cwd ?? "/tmp/fake-cwd",
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
    createdAt: string;
    supersedes: string | null;
    supersededBy: string | null;
    projectSlug: string;
    projectName: string;
    filename: string;
  }> = {},
) {
  return {
    id: overrides.id ?? "abc123",
    title: overrides.title ?? "Test Plan",
    kind: overrides.kind ?? "plan",
    summary: null,
    tags: [],
    createdAt: overrides.createdAt ?? "2026-05-11T14:22:09.000Z",
    filename: overrides.filename ?? "2026-05-11T14-22-09Z__test-plan__abc123.html",
    supersedes: overrides.supersedes ?? null,
    supersededBy: overrides.supersededBy ?? null,
    gitBranch: null,
    gitCommit: null,
    contentSha256: "abc",
    projectSlug: overrides.projectSlug ?? "github-com-cfb-cesium",
    projectName: overrides.projectName ?? "cfb/cesium",
    bodyText: "",
  };
}

function writeProjectIndex(
  stateDir: string,
  slug: string,
  entries: ReturnType<typeof makeIndexEntry>[],
) {
  const dir = join(stateDir, "projects", slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "index.json"), JSON.stringify(entries, null, 2));
}

function writeGlobalIndex(stateDir: string, entries: ReturnType<typeof makeIndexEntry>[]) {
  mkdirSync(stateDir, { recursive: true });
  writeFileSync(join(stateDir, "index.json"), JSON.stringify(entries, null, 2));
}

// ─── Test lifecycle ───────────────────────────────────────────────────────────

let stateDir: string;

beforeEach(() => {
  stateDir = mkdtempSync(join(tmpdir(), "cesium-ls-"));
});

afterEach(() => {
  rmSync(stateDir, { recursive: true, force: true });
});

// ─── Tests ────────────────────────────────────────────────────────────────────

const baseArgs: LsArgs = { all: false, json: false, limit: 50 };

test("ls empty index prints 'No artifacts found' and returns 0", async () => {
  writeProjectIndex(stateDir, "github-com-cfb-cesium", []);
  const ctx = captureCtx(stateDir);
  // Use --all to read the global index (which also has 0 entries)
  writeGlobalIndex(stateDir, []);
  const code = await runLs({ ...baseArgs, all: true }, ctx);
  expect(code).toBe(0);
  expect(ctx.out).toContain("No artifacts found");
});

test("ls returns 0 and prints table headers when entries exist", async () => {
  const slug = "github-com-cfb-test";
  const entry = makeIndexEntry({ id: "xyzabc", title: "My Plan", kind: "plan", projectSlug: slug });
  writeGlobalIndex(stateDir, [entry]);
  writeProjectIndex(stateDir, slug, [entry]);

  const ctx = captureCtx(stateDir);
  const code = await runLs({ ...baseArgs, all: true }, ctx);
  expect(code).toBe(0);
  expect(ctx.out).toContain("ID");
  expect(ctx.out).toContain("KIND");
  expect(ctx.out).toContain("TITLE");
  expect(ctx.out).toContain("CREATED");
  expect(ctx.out).toContain("xyzabc");
  expect(ctx.out).toContain("My Plan");
  expect(ctx.out).toContain("plan");
});

test("ls --json outputs valid JSON array", async () => {
  const entry = makeIndexEntry({ id: "json01", title: "JSON Test", kind: "review" });
  writeGlobalIndex(stateDir, [entry]);

  const ctx = captureCtx(stateDir);
  const code = await runLs({ ...baseArgs, all: true, json: true }, ctx);
  expect(code).toBe(0);
  const parsed = JSON.parse(ctx.out) as unknown[];
  expect(Array.isArray(parsed)).toBe(true);
  expect(parsed).toHaveLength(1);
  expect((parsed[0] as Record<string, unknown>)["id"]).toBe("json01");
});

test("ls --limit caps the output", async () => {
  const entries = Array.from({ length: 10 }, (_, i) =>
    makeIndexEntry({
      id: `id${i.toString().padStart(4, "0")}`,
      title: `Plan ${i}`,
      createdAt: `2026-05-${(11 + i).toString().padStart(2, "0")}T10:00:00.000Z`,
    }),
  );
  writeGlobalIndex(stateDir, entries);

  const ctx = captureCtx(stateDir);
  const code = await runLs({ ...baseArgs, all: true, limit: 3 }, ctx);
  expect(code).toBe(0);
  // Count artifact rows by counting lines with "plan" (kind column)
  const lines = ctx.out.split("\n").filter((l) => l.includes("plan") && !l.includes("TITLE"));
  expect(lines.length).toBeLessThanOrEqual(3);
});

test("ls --limit 0 returns exit code 1 with error message", async () => {
  const ctx = captureCtx(stateDir);
  const code = await runLs({ ...baseArgs, all: true, limit: 0 }, ctx);
  expect(code).toBe(1);
  expect(ctx.err).toContain("--limit");
});

test("ls SUPER column shows → for supersededBy", async () => {
  const e1 = makeIndexEntry({ id: "aaa111", supersededBy: "bbb222" });
  const e2 = makeIndexEntry({ id: "bbb222", supersedes: "aaa111" });
  writeGlobalIndex(stateDir, [e2, e1]);

  const ctx = captureCtx(stateDir);
  const code = await runLs({ ...baseArgs, all: true }, ctx);
  expect(code).toBe(0);
  expect(ctx.out).toContain("→ bbb222");
  expect(ctx.out).toContain("← aaa111");
});

test("ls missing global index.json returns 0 with no artifacts message", async () => {
  // No index.json created — empty dir
  mkdirSync(stateDir, { recursive: true });
  const ctx = captureCtx(stateDir);
  const code = await runLs({ ...baseArgs, all: true }, ctx);
  expect(code).toBe(0);
  expect(ctx.out).toContain("No artifacts found");
});

test("ls --json respects --limit", async () => {
  const entries = Array.from({ length: 5 }, (_, i) =>
    makeIndexEntry({ id: `lim${i}`, title: `Entry ${i}` }),
  );
  writeGlobalIndex(stateDir, entries);

  const ctx = captureCtx(stateDir);
  const code = await runLs({ ...baseArgs, all: true, json: true, limit: 2 }, ctx);
  expect(code).toBe(0);
  const parsed = JSON.parse(ctx.out) as unknown[];
  expect(parsed).toHaveLength(2);
});
