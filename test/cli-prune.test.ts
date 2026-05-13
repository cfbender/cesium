import { test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runPrune, parseDuration } from "../src/cli/commands/prune.ts";
import type { PruneArgs } from "../src/cli/commands/prune.ts";
import type { PruneContext } from "../src/cli/commands/prune.ts";
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
  nowDate: Date = new Date("2026-05-11T14:00:00.000Z"),
): PruneContext & { out: string; err: string } {
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
    now: () => nowDate,
    get out() {
      return out;
    },
    get err() {
      return err;
    },
  };
}

/** Create a minimal valid artifact HTML with embedded metadata. */
function makeArtifactHtml(id: string, createdAt: string): string {
  const meta = JSON.stringify(
    {
      id,
      title: "Test",
      kind: "plan",
      createdAt,
      tags: [],
      summary: null,
      supersedes: null,
      supersededBy: null,
      contentSha256: "abc",
    },
    null,
    2,
  );
  return `<!doctype html><html><head><script type="application/json" id="cesium-meta">${meta}</script></head><body><p>content</p></body></html>`;
}

function writeArtifact(stateDir: string, slug: string, filename: string, html: string): string {
  const dir = join(stateDir, "projects", slug, "artifacts");
  mkdirSync(dir, { recursive: true });
  const filePath = join(dir, filename);
  writeFileSync(filePath, html);
  return filePath;
}

function writeIndex(stateDir: string, slug: string | null, entries: unknown[]): void {
  const dir = slug ? join(stateDir, "projects", slug) : stateDir;
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "index.json"), JSON.stringify(entries, null, 2));
}

// ─── Test lifecycle ───────────────────────────────────────────────────────────

let stateDir: string;

beforeEach(() => {
  stateDir = mkdtempSync(join(tmpdir(), "cesium-prune-"));
});

afterEach(() => {
  rmSync(stateDir, { recursive: true, force: true });
});

// ─── parseDuration tests ──────────────────────────────────────────────────────

test("parseDuration parses days", () => {
  expect(parseDuration("90d")).toBe(90 * 24 * 60 * 60 * 1000);
});

test("parseDuration parses weeks", () => {
  expect(parseDuration("2w")).toBe(2 * 7 * 24 * 60 * 60 * 1000);
});

test("parseDuration parses hours", () => {
  expect(parseDuration("12h")).toBe(12 * 60 * 60 * 1000);
});

test("parseDuration parses minutes", () => {
  expect(parseDuration("30m")).toBe(30 * 60 * 1000);
});

test("parseDuration returns null for invalid input", () => {
  expect(parseDuration("invalid")).toBeNull();
  expect(parseDuration("90")).toBeNull();
  expect(parseDuration("d90")).toBeNull();
  expect(parseDuration("")).toBeNull();
});

// ─── prune command tests ──────────────────────────────────────────────────────

const baseArgs: PruneArgs = { olderThan: "", yes: false };

test("prune without --older-than returns 1", async () => {
  const ctx = captureCtx(stateDir);
  const code = await runPrune(baseArgs, ctx);
  expect(code).toBe(1);
  expect(ctx.err).toContain("--older-than");
});

test("prune with invalid duration returns 1", async () => {
  const ctx = captureCtx(stateDir);
  const code = await runPrune({ ...baseArgs, olderThan: "badformat" }, ctx);
  expect(code).toBe(1);
  expect(ctx.err).toContain("invalid duration");
});

test("prune dry-run lists artifacts to be deleted", async () => {
  const now = new Date("2026-05-11T14:00:00.000Z");
  // old artifact: 100 days ago
  const oldDate = new Date(now.getTime() - 100 * 24 * 60 * 60 * 1000).toISOString();
  writeArtifact(
    stateDir,
    "test-project",
    `2025-01-01T00-00-00Z__old__oldid1.html`,
    makeArtifactHtml("oldid1", oldDate),
  );

  const ctx = captureCtx(stateDir, now);
  const code = await runPrune({ ...baseArgs, olderThan: "90d" }, ctx);
  expect(code).toBe(0);
  expect(ctx.out).toContain("Would delete 1 artifact");
  expect(ctx.out).toContain("oldid1");
  expect(ctx.out).toContain("Re-run with --yes");
});

test("prune dry-run does not delete files", async () => {
  const now = new Date("2026-05-11T14:00:00.000Z");
  const oldDate = new Date(now.getTime() - 100 * 24 * 60 * 60 * 1000).toISOString();
  const filePath = writeArtifact(
    stateDir,
    "test-project",
    `2025-01-01T00-00-00Z__old__oldid1.html`,
    makeArtifactHtml("oldid1", oldDate),
  );

  const ctx = captureCtx(stateDir, now);
  await runPrune({ ...baseArgs, olderThan: "90d" }, ctx);
  expect(existsSync(filePath)).toBe(true);
});

test("prune --yes deletes old artifacts", async () => {
  const now = new Date("2026-05-11T14:00:00.000Z");
  const oldDate = new Date(now.getTime() - 100 * 24 * 60 * 60 * 1000).toISOString();
  const filePath = writeArtifact(
    stateDir,
    "test-project",
    `2025-01-01T00-00-00Z__old__oldid1.html`,
    makeArtifactHtml("oldid1", oldDate),
  );

  writeIndex(stateDir, "test-project", [
    {
      id: "oldid1",
      title: "Old",
      kind: "plan",
      createdAt: oldDate,
      filename: "2025-01-01T00-00-00Z__old__oldid1.html",
      summary: null,
      tags: [],
      supersedes: null,
      supersededBy: null,
      gitBranch: null,
      gitCommit: null,
      contentSha256: "abc",
      projectSlug: "test-project",
      projectName: "test",
      bodyText: "",
    },
  ]);
  writeIndex(stateDir, null, [
    {
      id: "oldid1",
      title: "Old",
      kind: "plan",
      createdAt: oldDate,
      filename: "2025-01-01T00-00-00Z__old__oldid1.html",
      summary: null,
      tags: [],
      supersedes: null,
      supersededBy: null,
      gitBranch: null,
      gitCommit: null,
      contentSha256: "abc",
      projectSlug: "test-project",
      projectName: "test",
      bodyText: "",
    },
  ]);

  const ctx = captureCtx(stateDir, now);
  const code = await runPrune({ ...baseArgs, olderThan: "90d", yes: true }, ctx);
  expect(code).toBe(0);
  expect(existsSync(filePath)).toBe(false);
  expect(ctx.out).toContain("Deleted 1 artifact");
  expect(ctx.out).toContain("Indexes regenerated");
});

test("prune --yes does not delete recent artifacts", async () => {
  const now = new Date("2026-05-11T14:00:00.000Z");
  // recent artifact: 1 day ago (less than 90d cutoff)
  const recentDate = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString();
  const filePath = writeArtifact(
    stateDir,
    "test-project",
    `2026-05-10T00-00-00Z__recent__recentid.html`,
    makeArtifactHtml("recentid", recentDate),
  );

  const ctx = captureCtx(stateDir, now);
  const code = await runPrune({ ...baseArgs, olderThan: "90d", yes: true }, ctx);
  expect(code).toBe(0);
  expect(existsSync(filePath)).toBe(true);
  expect(ctx.out).toContain("No artifacts older than 90d found");
});

test("prune reports 0 when no projects directory", async () => {
  const ctx = captureCtx(stateDir);
  const code = await runPrune({ ...baseArgs, olderThan: "90d" }, ctx);
  expect(code).toBe(0);
  expect(ctx.out).toContain("No artifacts older than 90d found");
});
