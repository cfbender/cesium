import { test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPublishTool } from "../src/tools/publish.ts";
import { readEmbeddedMetadata } from "../src/storage/write.ts";
import type { PublishToolOverrides } from "../src/tools/publish.ts";

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------

function mockCtx(workDir: string): Parameters<typeof createPublishTool>[0] {
  return {
    directory: workDir,
    worktree: "",
    $: Bun.$,
  } as unknown as Parameters<typeof createPublishTool>[0];
}

function makeOverrides(stateDir: string, nanoid?: () => string): PublishToolOverrides {
  return {
    loadConfig: () => ({
      stateDir,
      port: 3030,
      portMax: 3050,
      idleTimeoutMs: 1800000,
    }),
    now: () => new Date("2026-05-11T14:22:09Z"),
    nanoid: nanoid ?? (() => "abc123"),
  };
}

interface PublishArgs extends Record<string, unknown> {
  title: string;
  kind: string;
  html: string;
  summary?: string;
  tags?: string[];
  supersedes?: string;
}

async function publish(
  workDir: string,
  stateDir: string,
  args: PublishArgs,
  nanoid?: () => string,
): Promise<Record<string, unknown>> {
  const ctx = mockCtx(workDir);
  const overrides = makeOverrides(stateDir, nanoid);
  const t = createPublishTool(ctx, overrides);
  const raw = await t.execute(args, {} as never);
  if (typeof raw !== "string") throw new Error("expected string from publish tool");
  return JSON.parse(raw) as Record<string, unknown>;
}

// -----------------------------------------------------------------------
// Test lifecycle
// -----------------------------------------------------------------------

let workDir: string;
let stateDir: string;

beforeEach(() => {
  workDir = mkdtempSync(join(tmpdir(), "cesium-work-"));
  stateDir = mkdtempSync(join(tmpdir(), "cesium-state-"));
});

afterEach(() => {
  rmSync(workDir, { recursive: true, force: true });
  rmSync(stateDir, { recursive: true, force: true });
});

// -----------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------

test("basic publish: result has expected id and URL fields", async () => {
  const result = await publish(workDir, stateDir, {
    title: "Test plan",
    kind: "plan",
    html: "<h1 class='h-display'>hi</h1>",
  });

  expect(result["id"]).toBe("abc123");
  expect(typeof result["filePath"]).toBe("string");
  expect(existsSync(result["filePath"] as string)).toBe(true);
  expect((result["fileUrl"] as string).startsWith("file://")).toBe(true);
  expect((result["httpUrl"] as string).startsWith("http://127.0.0.1:3030/projects/")).toBe(true);
});

test("wrapped output is well-formed HTML with correct title and meta block", async () => {
  const result = await publish(workDir, stateDir, {
    title: "Test plan",
    kind: "plan",
    html: "<h1 class='h-display'>hi</h1>",
  });

  const filePath = result["filePath"] as string;
  const html = readFileSync(filePath, "utf8");

  expect(html.toLowerCase().trimStart()).toMatch(/^<!doctype html>/);
  expect(html).toContain("<title>Test plan · cesium</title>");
  expect(html).toContain('<script type="application/json" id="cesium-meta">');
  expect(html).toContain('<h1 class="h-display">hi</h1>');
});

test("embedded metadata round-trip returns expected fields", async () => {
  const result = await publish(workDir, stateDir, {
    title: "Test plan",
    kind: "plan",
    html: "<h1 class='h-display'>hi</h1>",
  });

  const filePath = result["filePath"] as string;
  const html = readFileSync(filePath, "utf8");
  const meta = readEmbeddedMetadata(html);

  if (meta === null) throw new Error("expected embedded metadata to be present");
  expect(meta["id"]).toBe("abc123");
  expect(meta["title"]).toBe("Test plan");
  expect(meta["kind"]).toBe("plan");
});

test("index json updated with new entry", async () => {
  const result = await publish(workDir, stateDir, {
    title: "Test plan",
    kind: "plan",
    html: "<h1 class='h-display'>hi</h1>",
  });

  // Find the project slug from the httpUrl
  const httpUrl = result["httpUrl"] as string;
  const slugMatch = /\/projects\/([^/]+)\//.exec(httpUrl);
  if (slugMatch === null || slugMatch[1] === undefined)
    throw new Error("could not parse slug from httpUrl");
  const slug = slugMatch[1];

  // Per-project index
  const projectIndexPath = join(stateDir, "projects", slug, "index.json");
  expect(existsSync(projectIndexPath)).toBe(true);
  const projectEntries = JSON.parse(readFileSync(projectIndexPath, "utf8")) as unknown[];
  expect(projectEntries).toHaveLength(1);
  expect((projectEntries[0] as Record<string, unknown>)["id"]).toBe("abc123");

  // Global index
  const globalIndexPath = join(stateDir, "index.json");
  expect(existsSync(globalIndexPath)).toBe(true);
  const globalEntries = JSON.parse(readFileSync(globalIndexPath, "utf8")) as unknown[];
  expect(globalEntries).toHaveLength(1);
  expect((globalEntries[0] as Record<string, unknown>)["id"]).toBe("abc123");
});

test("supersedes chain: patches previous file and index entry", async () => {
  // First publish
  const r1 = await publish(workDir, stateDir, {
    title: "Auth design v1",
    kind: "design",
    html: "<h1>v1</h1>",
  });
  const id1 = r1["id"] as string;
  const file1 = r1["filePath"] as string;

  // Second publish superseding the first
  const r2 = await publish(
    workDir,
    stateDir,
    {
      title: "Auth design v2",
      kind: "design",
      html: "<h1>v2</h1>",
      supersedes: id1,
    },
    () => "def456",
  );
  const id2 = r2["id"] as string;
  expect(id2).toBe("def456");

  // Second file was written
  expect(existsSync(r2["filePath"] as string)).toBe(true);

  // First file's embedded metadata now has supersededBy
  const html1 = readFileSync(file1, "utf8");
  const meta1 = readEmbeddedMetadata(html1);
  if (meta1 === null) throw new Error("expected embedded metadata in first file");
  expect(meta1["supersededBy"]).toBe("def456");

  // Project index has first entry patched
  const httpUrl = r1["httpUrl"] as string;
  const slugMatch = /\/projects\/([^/]+)\//.exec(httpUrl);
  if (slugMatch === null || slugMatch[1] === undefined) throw new Error("could not parse slug");
  const slug = slugMatch[1];
  const projectIndexPath = join(stateDir, "projects", slug, "index.json");
  const entries = JSON.parse(readFileSync(projectIndexPath, "utf8")) as Record<string, unknown>[];
  const entry1 = entries.find((e) => e["id"] === id1);
  expect(entry1).toBeDefined();
  if (entry1 === undefined) throw new Error("expected entry1 in project index");
  expect(entry1["supersededBy"]).toBe("def456");
});

test("supersedes nonexistent id: both files exist, no corruption", async () => {
  // First publish
  const r1 = await publish(workDir, stateDir, {
    title: "Plan A",
    kind: "plan",
    html: "<h1>Plan A</h1>",
  });

  // Second publish references a nonexistent id — should not throw
  const r2 = await publish(
    workDir,
    stateDir,
    {
      title: "Plan B",
      kind: "plan",
      html: "<h1>Plan B</h1>",
      supersedes: "doesnotexist",
    },
    () => "def456",
  );

  expect(existsSync(r1["filePath"] as string)).toBe(true);
  expect(existsSync(r2["filePath"] as string)).toBe(true);
});

test("validation failure: empty title returns Error: string", async () => {
  const ctx = mockCtx(workDir);
  const overrides = makeOverrides(stateDir);
  const t = createPublishTool(ctx, overrides);
  const result = await t.execute({ title: "", kind: "plan", html: "x" }, {} as never);
  expect(typeof result).toBe("string");
  expect((result as string).startsWith("Error:")).toBe(true);
});

test("validation failure: invalid kind returns Error: string", async () => {
  const ctx = mockCtx(workDir);
  const overrides = makeOverrides(stateDir);
  const t = createPublishTool(ctx, overrides);
  const result = await t.execute({ title: "x", kind: "wrong", html: "y" }, {} as never);
  expect(typeof result).toBe("string");
  expect((result as string).startsWith("Error:")).toBe(true);
});

test("scrub integration: removes external scripts, keeps safe content", async () => {
  const result = await publish(workDir, stateDir, {
    title: "Scrub test",
    kind: "report",
    html: "<script src='https://evil.com/x.js'></script><p class='tldr'>safe</p>",
  });

  const html = readFileSync(result["filePath"] as string, "utf8");
  // Scrub replaces external <script src> elements with HTML comments.
  // The live script tag is gone — only a comment placeholder remains.
  // Verify the original closing </script> for the evil script is absent as a live element:
  // (parse5 never emits a closing tag for script-src elements when scrubbed to a comment)
  expect(html).not.toContain("<script src='https://evil.com");
  // The comment placeholder is present (confirming the scrub comment strategy)
  expect(html).toContain("<!-- cesium: removed external");
  // Safe body content is preserved (parse5 normalizes single quotes to double)
  expect(html).toContain('<p class="tldr">safe</p>');
});
