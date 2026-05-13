import { test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runOpen } from "../src/cli/commands/open.ts";
import type { OpenArgs, OpenContext } from "../src/cli/commands/open.ts";
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

function captureCtx(
  stateDir: string,
  extraCtx?: Partial<OpenContext>,
): OpenContext & { out: string; err: string; opened: string[] } {
  let out = "";
  let err = "";
  const opened: string[] = [];
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
    opener: async (url: string) => {
      opened.push(url);
    },
    ensureRunning: async () => null, // don't start real server
    ...extraCtx,
    get out() {
      return out;
    },
    get err() {
      return err;
    },
    get opened() {
      return opened;
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
  const filename = overrides.filename ?? `2026-05-11T14-22-09Z__test-plan__${id}.html`;
  return {
    id,
    title: overrides.title ?? "Test Plan",
    kind: overrides.kind ?? "plan",
    summary: null,
    tags: [],
    createdAt: "2026-05-11T14:22:09.000Z",
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

// ─── Test lifecycle ───────────────────────────────────────────────────────────

let stateDir: string;

beforeEach(() => {
  stateDir = mkdtempSync(join(tmpdir(), "cesium-open-"));
});

afterEach(() => {
  rmSync(stateDir, { recursive: true, force: true });
});

// ─── Tests ────────────────────────────────────────────────────────────────────

const baseArgs: OpenArgs = { idPrefix: "", print: false };

test("open with empty id-prefix returns 1 with error message", async () => {
  writeGlobalIndex(stateDir, []);
  const ctx = captureCtx(stateDir);
  const code = await runOpen({ ...baseArgs }, ctx);
  expect(code).toBe(1);
  expect(ctx.err).toContain("missing required argument");
});

test("open with non-matching prefix returns 1", async () => {
  writeGlobalIndex(stateDir, [makeIndexEntry({ id: "abc123" })]);
  const ctx = captureCtx(stateDir);
  const code = await runOpen({ ...baseArgs, idPrefix: "xyz" }, ctx);
  expect(code).toBe(1);
  expect(ctx.err).toContain("no artifact found");
});

test("open with ambiguous prefix returns 2 and lists matches", async () => {
  writeGlobalIndex(stateDir, [
    makeIndexEntry({ id: "abc123", title: "Plan A" }),
    makeIndexEntry({ id: "abc456", title: "Plan B" }),
  ]);
  const ctx = captureCtx(stateDir);
  const code = await runOpen({ ...baseArgs, idPrefix: "abc" }, ctx);
  expect(code).toBe(2);
  expect(ctx.err).toContain("ambiguous prefix");
  expect(ctx.err).toContain("abc123");
  expect(ctx.err).toContain("abc456");
});

test("open --print with exact match prints file:// URL and returns 0", async () => {
  writeGlobalIndex(stateDir, [makeIndexEntry({ id: "abc123" })]);
  const ctx = captureCtx(stateDir);
  const code = await runOpen({ ...baseArgs, idPrefix: "abc123", print: true }, ctx);
  expect(code).toBe(0);
  // Without server running (ensureRunning returns null), should use file://
  expect(ctx.out).toContain("file://");
  expect(ctx.out).toContain("abc123");
  expect(ctx.opened).toHaveLength(0);
});

test("open with exact match calls opener and returns 0", async () => {
  writeGlobalIndex(stateDir, [makeIndexEntry({ id: "abc123" })]);
  const ctx = captureCtx(stateDir);
  const code = await runOpen({ ...baseArgs, idPrefix: "abc123" }, ctx);
  expect(code).toBe(0);
  expect(ctx.opened).toHaveLength(1);
  // file:// URL since ensureRunning returns null
  expect(ctx.opened[0]).toContain("abc123");
});

test("open with case-insensitive prefix match succeeds", async () => {
  writeGlobalIndex(stateDir, [makeIndexEntry({ id: "AbCdEf" })]);
  const ctx = captureCtx(stateDir);
  const code = await runOpen({ ...baseArgs, idPrefix: "abcdef", print: true }, ctx);
  expect(code).toBe(0);
  expect(ctx.out).toContain("AbCdEf");
});

test("open --print with server running uses http:// URL", async () => {
  const entry = makeIndexEntry({ id: "abc123" });
  writeGlobalIndex(stateDir, [entry]);
  const ctx = captureCtx(stateDir, {
    ensureRunning: async () => ({ port: 3030, url: "http://localhost:3030" }),
  });
  const code = await runOpen({ ...baseArgs, idPrefix: "abc123", print: true }, ctx);
  expect(code).toBe(0);
  expect(ctx.out).toContain("http://");
  expect(ctx.out).toContain("3030");
});

test("open opener failure falls back gracefully and returns 1", async () => {
  writeGlobalIndex(stateDir, [makeIndexEntry({ id: "abc123" })]);
  const ctx = captureCtx(stateDir, {
    opener: async () => {
      throw new Error("opener failed");
    },
  });
  const code = await runOpen({ ...baseArgs, idPrefix: "abc123" }, ctx);
  expect(code).toBe(1);
  expect(ctx.err).toContain("opener failed");
  // URL should still be printed to stdout
  expect(ctx.out).toContain("URL:");
});
