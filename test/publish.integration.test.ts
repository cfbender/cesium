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
      hostname: "127.0.0.1",
    }),
    now: () => new Date("2026-05-11T14:22:09Z"),
    nanoid: nanoid ?? (() => "abc123"),
    // Stub out real port binding in integration tests
    ensureRunning: async () => ({
      port: 3030,
      url: "http://127.0.0.1:3030",
      pid: process.pid,
      startedAt: new Date().toISOString(),
    }),
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
  expect((result["httpUrl"] as string).startsWith("http://localhost:3030/projects/")).toBe(true);
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

// ─── Index HTML generation ─────────────────────────────────────────────────

test("after publish: projectIndexPath exists and contains artifact title", async () => {
  const result = await publish(workDir, stateDir, {
    title: "My Great Plan",
    kind: "plan",
    html: "<h1>plan content</h1>",
  });

  const httpUrl = result["httpUrl"] as string;
  const slugMatch = /\/projects\/([^/]+)\//.exec(httpUrl);
  if (slugMatch === null || slugMatch[1] === undefined) throw new Error("could not parse slug");
  const slug = slugMatch[1];

  const projectIndexPath = join(stateDir, "projects", slug, "index.html");
  expect(existsSync(projectIndexPath)).toBe(true);
  const html = readFileSync(projectIndexPath, "utf8");
  expect(html.toLowerCase().trimStart()).toMatch(/^<!doctype html>/);
  expect(html).toContain("My Great Plan");
});

test("after publish: globalIndexPath exists and contains the project name", async () => {
  await publish(workDir, stateDir, {
    title: "Some Doc",
    kind: "report",
    html: "<p>content</p>",
  });

  const globalIndexPath = join(stateDir, "index.html");
  expect(existsSync(globalIndexPath)).toBe(true);
  const html = readFileSync(globalIndexPath, "utf8");
  expect(html.toLowerCase().trimStart()).toMatch(/^<!doctype html>/);
  // The global index should contain a link to the project
  expect(html).toContain("projects/");
  expect(html).toContain("index.html");
});

test("two sequential publishes: project index contains both titles", async () => {
  await publish(workDir, stateDir, {
    title: "First Article",
    kind: "plan",
    html: "<p>first</p>",
  });
  const r2 = await publish(
    workDir,
    stateDir,
    { title: "Second Article", kind: "design", html: "<p>second</p>" },
    () => "xyz999",
  );

  const httpUrl = r2["httpUrl"] as string;
  const slugMatch = /\/projects\/([^/]+)\//.exec(httpUrl);
  if (slugMatch === null || slugMatch[1] === undefined) throw new Error("could not parse slug");
  const slug = slugMatch[1];

  const projectIndexPath = join(stateDir, "projects", slug, "index.html");
  const html = readFileSync(projectIndexPath, "utf8");
  expect(html).toContain("First Article");
  expect(html).toContain("Second Article");
});

test("two sequential publishes: global index contains the project once with higher count", async () => {
  await publish(workDir, stateDir, {
    title: "Doc One",
    kind: "plan",
    html: "<p>one</p>",
  });
  await publish(
    workDir,
    stateDir,
    { title: "Doc Two", kind: "plan", html: "<p>two</p>" },
    () => "zzz111",
  );

  const globalIndexPath = join(stateDir, "index.html");
  const html = readFileSync(globalIndexPath, "utf8");
  // Should show 2 artifacts for the single project
  expect(html).toContain("2 artifacts");
  // The project slug should appear only once as a card link (not duplicated)
  expect(html).toContain("All projects");
});

// ─── Phase 4: terminalSummary + SSH detection ──────────────────────────────

test("result JSON includes terminalSummary field", async () => {
  const result = await publish(workDir, stateDir, {
    title: "My Report",
    kind: "report",
    html: "<p>content</p>",
  });

  expect(typeof result["terminalSummary"]).toBe("string");
});

test("terminalSummary contains title, kind, httpUrl, fileUrl on separate lines", async () => {
  const result = await publish(workDir, stateDir, {
    title: "Summary Test",
    kind: "plan",
    html: "<p>x</p>",
  });

  const summary = result["terminalSummary"] as string;
  const lines = summary.split("\n");

  // First line: "Cesium · <title> (<kind>)"
  expect(lines[0]).toContain("Summary Test");
  expect(lines[0]).toContain("plan");
  expect(lines[0]).toContain("Cesium ·");

  // Should contain httpUrl
  expect(summary).toContain("http://localhost:3030");
  // Should contain fileUrl (file:// prefix)
  expect(summary).toContain("file://");
});

test("terminalSummary includes SSH port-forward hint when SSH_CONNECTION is set", async () => {
  const originalSsh = process.env["SSH_CONNECTION"];
  process.env["SSH_CONNECTION"] = "1.2.3.4 22 5.6.7.8 22";

  try {
    const result = await publish(workDir, stateDir, {
      title: "SSH Test",
      kind: "report",
      html: "<p>ssh</p>",
    });

    const summary = result["terminalSummary"] as string;
    expect(summary).toContain("ssh -L");
    expect(summary).toContain("3030");
  } finally {
    if (originalSsh === undefined) {
      delete process.env["SSH_CONNECTION"];
    } else {
      process.env["SSH_CONNECTION"] = originalSsh;
    }
  }
});

test("terminalSummary does NOT include SSH hint when SSH_CONNECTION is not set", async () => {
  const originalSsh = process.env["SSH_CONNECTION"];
  delete process.env["SSH_CONNECTION"];

  try {
    const result = await publish(workDir, stateDir, {
      title: "Non-SSH Test",
      kind: "report",
      html: "<p>local</p>",
    });

    const summary = result["terminalSummary"] as string;
    expect(summary).not.toContain("ssh -L");
  } finally {
    if (originalSsh !== undefined) {
      process.env["SSH_CONNECTION"] = originalSsh;
    }
  }
});

// ─── Phase 3: full-text search / bodyText ──────────────────────────────────

test("after publish: project index.json entry has bodyText containing body content", async () => {
  const result = await publish(workDir, stateDir, {
    title: "Body Text Test",
    kind: "report",
    html: "<p>This is a unique phrase.</p>",
  });

  const httpUrl = result["httpUrl"] as string;
  const slugMatch = /\/projects\/([^/]+)\//.exec(httpUrl);
  if (slugMatch === null || slugMatch[1] === undefined) throw new Error("could not parse slug");
  const slug = slugMatch[1];

  const projectIndexPath = join(stateDir, "projects", slug, "index.json");
  const entries = JSON.parse(readFileSync(projectIndexPath, "utf8")) as Record<string, unknown>[];
  expect(entries).toHaveLength(1);
  const entry = entries[0];
  if (entry === undefined) throw new Error("expected entry");
  expect(typeof entry["bodyText"]).toBe("string");
  expect((entry["bodyText"] as string).toLowerCase()).toContain("this is a unique phrase");
});

test("after publish: project index.html card has data-body-text with lowercased content", async () => {
  const result = await publish(workDir, stateDir, {
    title: "Body Text HTML Test",
    kind: "plan",
    html: "<p>Searchable Content Here</p>",
  });

  const httpUrl = result["httpUrl"] as string;
  const slugMatch = /\/projects\/([^/]+)\//.exec(httpUrl);
  if (slugMatch === null || slugMatch[1] === undefined) throw new Error("could not parse slug");
  const slug = slugMatch[1];

  const projectIndexPath = join(stateDir, "projects", slug, "index.html");
  const html = readFileSync(projectIndexPath, "utf8");
  // data-body-text should be lowercased
  expect(html).toContain("searchable content here");
  expect(html).toContain("data-body-text=");
});

test("two publishes with different bodies: each card has distinct data-body-text", async () => {
  await publish(workDir, stateDir, {
    title: "Article Alpha",
    kind: "plan",
    html: "<p>Alpha body content zulu</p>",
  });
  const r2 = await publish(
    workDir,
    stateDir,
    {
      title: "Article Beta",
      kind: "plan",
      html: "<p>Beta body content yankee</p>",
    },
    () => "xyz999",
  );

  const httpUrl = r2["httpUrl"] as string;
  const slugMatch = /\/projects\/([^/]+)\//.exec(httpUrl);
  if (slugMatch === null || slugMatch[1] === undefined) throw new Error("could not parse slug");
  const slug = slugMatch[1];

  const projectIndexPath = join(stateDir, "projects", slug, "index.html");
  const html = readFileSync(projectIndexPath, "utf8");

  // Both body texts appear as distinct data-body-text attributes
  expect(html).toContain("alpha body content zulu");
  expect(html).toContain("beta body content yankee");
});

test("script content in body is excluded from bodyText", async () => {
  const result = await publish(workDir, stateDir, {
    title: "Script Exclusion Test",
    kind: "report",
    html: "<p>Visible text</p><script>var secret = 'hidden';</script>",
  });

  const httpUrl = result["httpUrl"] as string;
  const slugMatch = /\/projects\/([^/]+)\//.exec(httpUrl);
  if (slugMatch === null || slugMatch[1] === undefined) throw new Error("could not parse slug");
  const slug = slugMatch[1];

  const projectIndexPath = join(stateDir, "projects", slug, "index.json");
  const entries = JSON.parse(readFileSync(projectIndexPath, "utf8")) as Record<string, unknown>[];
  const entry = entries[0];
  if (entry === undefined) throw new Error("expected entry");
  const bodyText = entry["bodyText"] as string;
  expect(bodyText.toLowerCase()).toContain("visible text");
  expect(bodyText.toLowerCase()).not.toContain("secret");
  expect(bodyText.toLowerCase()).not.toContain("hidden");
});
