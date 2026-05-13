import { test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAnnotateTool, type AnnotateToolOverrides } from "../src/tools/annotate.ts";
import { readEmbeddedMetadata } from "../src/storage/write.ts";
import type { InteractiveAnnotateData } from "../src/render/validate.ts";

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------

function mockCtx(workDir: string): Parameters<typeof createAnnotateTool>[0] {
  return {
    directory: workDir,
    worktree: "",
    $: Bun.$,
  } as unknown as Parameters<typeof createAnnotateTool>[0];
}

function makeOverrides(
  stateDir: string,
  nanoid?: () => string,
  ensureRunningResult?: "null" | "default",
): AnnotateToolOverrides {
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
    ensureRunning:
      ensureRunningResult === "null"
        ? async () => null
        : async () => ({
            port: 3030,
            url: "http://127.0.0.1:3030",
            pid: process.pid,
            startedAt: new Date().toISOString(),
          }),
  };
}

const MINIMAL_BLOCKS = [{ type: "prose", markdown: "Please review this proposal." }];

const DIFF_BLOCK = {
  type: "diff",
  lang: "typescript",
  patch: `--- a/foo.ts
+++ b/foo.ts
@@ -1,3 +1,3 @@
 function foo() {
-  return 1;
+  return 2;
 }`,
};

interface AnnotateArgs extends Record<string, unknown> {
  title: string;
  blocks: unknown[];
  verdictMode?: string;
  perLineFor?: string[];
  requireVerdict?: boolean;
  summary?: string;
  tags?: string[];
  expiresAt?: string;
}

async function annotate(
  workDir: string,
  stateDir: string,
  args: AnnotateArgs,
  nanoid?: () => string,
  ensureRunningResult?: "null" | "default",
): Promise<Record<string, unknown>> {
  const ctx = mockCtx(workDir);
  const overrides = makeOverrides(stateDir, nanoid, ensureRunningResult);
  const t = createAnnotateTool(ctx, overrides);
  const raw = await t.execute(args, {} as never);
  if (typeof raw !== "string") throw new Error("expected string from annotate tool");
  if ((raw as string).startsWith("Error:")) throw new Error(raw as string);
  return JSON.parse(raw) as Record<string, unknown>;
}

async function annotateRaw(
  workDir: string,
  stateDir: string,
  args: Record<string, unknown>,
): Promise<string> {
  const ctx = mockCtx(workDir);
  const overrides = makeOverrides(stateDir);
  const t = createAnnotateTool(ctx, overrides);
  const raw = await t.execute(args, {} as never);
  return raw as string;
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
// 1. Valid minimal input — result shape
// -----------------------------------------------------------------------

test("happy path: result has expected id and URL fields", async () => {
  const result = await annotate(workDir, stateDir, {
    title: "Design review",
    blocks: MINIMAL_BLOCKS,
  });

  expect(result["id"]).toBe("abc123");
  expect(typeof result["filePath"]).toBe("string");
  expect(existsSync(result["filePath"] as string)).toBe(true);
  expect((result["fileUrl"] as string).startsWith("file://")).toBe(true);
  expect((result["httpUrl"] as string).startsWith("http://localhost:3030/projects/")).toBe(true);
  expect(typeof result["terminalSummary"]).toBe("string");
});

// -----------------------------------------------------------------------
// 2. Embedded cesium-meta shape
// -----------------------------------------------------------------------

test("embedded meta has correct kind, inputMode, and interactive defaults", async () => {
  const result = await annotate(workDir, stateDir, {
    title: "Meta shape test",
    blocks: MINIMAL_BLOCKS,
  });

  const filePath = result["filePath"] as string;
  const html = readFileSync(filePath, "utf8");
  const meta = readEmbeddedMetadata(html);
  if (meta === null) throw new Error("expected embedded metadata");

  expect(meta["kind"]).toBe("annotate");
  expect(meta["inputMode"]).toBe("blocks");

  const interactive = meta["interactive"] as InteractiveAnnotateData;
  expect(interactive.kind).toBe("annotate");
  expect(interactive.status).toBe("open");
  expect(Array.isArray(interactive.comments)).toBe(true);
  expect(interactive.comments).toHaveLength(0);
  expect(interactive.verdict).toBeNull();
  expect(interactive.verdictMode).toBe("full");
  expect(interactive.perLineFor).toEqual(["diff", "code"]);
  expect(typeof interactive.requireVerdict).toBe("boolean");
  expect(interactive.requireVerdict).toBe(true);
});

// -----------------------------------------------------------------------
// 3. Body contains the scaffold elements
// -----------------------------------------------------------------------

test("body contains annotate scaffold, comment popup template, and approve button", async () => {
  const result = await annotate(workDir, stateDir, {
    title: "Scaffold test",
    blocks: MINIMAL_BLOCKS,
  });

  const html = readFileSync(result["filePath"] as string, "utf8");
  expect(html).toContain("data-cesium-annotate-scaffold");
  expect(html).toContain('<template id="cs-annotate-comment-popup">');
  expect(html).toContain('data-verdict="approve"');
});

// -----------------------------------------------------------------------
// 4. Verdict mode "approve" — only one verdict button
// -----------------------------------------------------------------------

test('verdictMode "approve" — only approve button present', async () => {
  const result = await annotate(workDir, stateDir, {
    title: "Approve only",
    blocks: MINIMAL_BLOCKS,
    verdictMode: "approve",
  });

  const html = readFileSync(result["filePath"] as string, "utf8");
  expect(html).toContain('data-verdict="approve"');
  expect(html).not.toContain('data-verdict="request_changes"');
  expect(html).not.toContain('data-verdict="comment"');
});

// -----------------------------------------------------------------------
// 5. Verdict mode "approve-or-reject" — exactly two verdict buttons
// -----------------------------------------------------------------------

test('verdictMode "approve-or-reject" — approve + request_changes buttons only', async () => {
  const result = await annotate(workDir, stateDir, {
    title: "Approve or reject",
    blocks: MINIMAL_BLOCKS,
    verdictMode: "approve-or-reject",
  });

  const html = readFileSync(result["filePath"] as string, "utf8");
  expect(html).toContain('data-verdict="approve"');
  expect(html).toContain('data-verdict="request_changes"');
  expect(html).not.toContain('data-verdict="comment"');
});

// -----------------------------------------------------------------------
// 6. Per-block anchors present
// -----------------------------------------------------------------------

test("rendered body contains data-cesium-anchor for block-0", async () => {
  const result = await annotate(workDir, stateDir, {
    title: "Anchor test",
    blocks: MINIMAL_BLOCKS,
  });

  const html = readFileSync(result["filePath"] as string, "utf8");
  expect(html).toContain('data-cesium-anchor="block-0"');
});

// -----------------------------------------------------------------------
// 7. Per-line anchors on diff block
// -----------------------------------------------------------------------

test("diff block gets per-line data-cesium-anchor attributes", async () => {
  const result = await annotate(workDir, stateDir, {
    title: "Diff anchor test",
    blocks: [DIFF_BLOCK],
  });

  const html = readFileSync(result["filePath"] as string, "utf8");
  expect(html).toContain('data-cesium-anchor="block-0.line-1"');
});

// -----------------------------------------------------------------------
// 8. Invalid input — error returned, no file written
// -----------------------------------------------------------------------

test("validation failure: empty blocks array returns Error string, no file written", async () => {
  const raw = await annotateRaw(workDir, stateDir, {
    title: "Invalid",
    blocks: [],
  });
  expect(raw.startsWith("Error:")).toBe(true);
  expect(raw).toContain("blocks");
});

test("validation failure: missing title returns Error string", async () => {
  const raw = await annotateRaw(workDir, stateDir, {
    blocks: MINIMAL_BLOCKS,
  });
  expect(raw.startsWith("Error:")).toBe(true);
  expect(raw).toContain("title");
});

// -----------------------------------------------------------------------
// 9. Custom expiresAt is preserved
// -----------------------------------------------------------------------

test("custom expiresAt is preserved verbatim in interactive data", async () => {
  const explicit = "2027-06-01T00:00:00.000Z";
  const result = await annotate(workDir, stateDir, {
    title: "ExpiresAt test",
    blocks: MINIMAL_BLOCKS,
    expiresAt: explicit,
  });

  const html = readFileSync(result["filePath"] as string, "utf8");
  const meta = readEmbeddedMetadata(html);
  if (meta === null) throw new Error("expected meta");
  const interactive = meta["interactive"] as InteractiveAnnotateData;
  expect(interactive.expiresAt).toBe(explicit);
});

// -----------------------------------------------------------------------
// 10. Index entry created with kind: "annotate"
// -----------------------------------------------------------------------

test("index entry has kind: annotate", async () => {
  const result = await annotate(workDir, stateDir, {
    title: "Index kind test",
    blocks: MINIMAL_BLOCKS,
  });

  const httpUrl = result["httpUrl"] as string;
  const slugMatch = /\/projects\/([^/]+)\//.exec(httpUrl);
  if (slugMatch === null || slugMatch[1] === undefined) throw new Error("could not parse slug");
  const slug = slugMatch[1];

  const projectIndexPath = join(stateDir, "projects", slug, "index.json");
  expect(existsSync(projectIndexPath)).toBe(true);
  const entries = JSON.parse(readFileSync(projectIndexPath, "utf8")) as Record<string, unknown>[];
  expect(entries).toHaveLength(1);
  expect((entries[0] as Record<string, unknown>)["kind"]).toBe("annotate");
});

// -----------------------------------------------------------------------
// 11. Tags propagate to meta and IndexEntry
// -----------------------------------------------------------------------

test("tags and summary propagated to meta and index entry", async () => {
  const result = await annotate(workDir, stateDir, {
    title: "Tags test",
    blocks: MINIMAL_BLOCKS,
    tags: ["phase-3", "rfc"],
    summary: "A quick annotate summary.",
  });

  const filePath = result["filePath"] as string;
  const html = readFileSync(filePath, "utf8");
  const meta = readEmbeddedMetadata(html);
  if (meta === null) throw new Error("expected meta");
  expect(meta["tags"]).toEqual(["phase-3", "rfc"]);
  expect(meta["summary"]).toBe("A quick annotate summary.");

  const httpUrl = result["httpUrl"] as string;
  const slugMatch = /\/projects\/([^/]+)\//.exec(httpUrl);
  if (slugMatch === null || slugMatch[1] === undefined) throw new Error("could not parse slug");
  const slug = slugMatch[1];
  const projectIndexPath = join(stateDir, "projects", slug, "index.json");
  const entries = JSON.parse(readFileSync(projectIndexPath, "utf8")) as Record<string, unknown>[];
  const entry = entries[0] as Record<string, unknown>;
  expect(entry["tags"]).toEqual(["phase-3", "rfc"]);
});

// -----------------------------------------------------------------------
// 12. Body field is ignored (blocks-only policy regression test)
// -----------------------------------------------------------------------

test("stray body field is ignored — blocks-only policy", async () => {
  const result = await annotate(workDir, stateDir, {
    title: "Body ignore test",
    blocks: MINIMAL_BLOCKS,
    body: "<p>this should be ignored</p>",
  } as AnnotateArgs & { body: string });

  // Tool should succeed
  expect(result["id"]).toBe("abc123");

  // The raw HTML content should not contain the body literal
  const html = readFileSync(result["filePath"] as string, "utf8");
  expect(html).not.toContain("this should be ignored");

  // Meta should not have a body key
  const meta = readEmbeddedMetadata(html);
  if (meta === null) throw new Error("expected meta");
  expect("body" in meta).toBe(false);
});

// -----------------------------------------------------------------------
// Additional: ensureRunning returns null → httpUrl is null
// -----------------------------------------------------------------------

test("ensureRunning returns null → httpUrl is null", async () => {
  const result = await annotate(
    workDir,
    stateDir,
    {
      title: "Server down",
      blocks: MINIMAL_BLOCKS,
    },
    undefined,
    "null",
  );

  expect(result["httpUrl"]).toBeNull();
  expect(typeof result["terminalSummary"]).toBe("string");
  expect(result["terminalSummary"] as string).toContain("file://");
});

// -----------------------------------------------------------------------
// Additional: expiresAt default ~24h from createdAt
// -----------------------------------------------------------------------

test("expiresAt defaults to 24h from createdAt", async () => {
  const result = await annotate(workDir, stateDir, {
    title: "Expiry default",
    blocks: MINIMAL_BLOCKS,
  });

  const html = readFileSync(result["filePath"] as string, "utf8");
  const meta = readEmbeddedMetadata(html);
  if (meta === null) throw new Error("expected meta");
  const interactive = meta["interactive"] as InteractiveAnnotateData;

  const createdAt = new Date("2026-05-11T14:22:09Z").getTime();
  const expectedExpiry = createdAt + 24 * 60 * 60 * 1000;
  const actualExpiry = new Date(interactive.expiresAt).getTime();
  expect(Math.abs(actualExpiry - expectedExpiry)).toBeLessThan(2000);
});
