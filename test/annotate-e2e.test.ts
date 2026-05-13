/**
 * annotate-e2e.test.ts
 *
 * Black-box end-to-end lifecycle test for cesium_annotate.
 * Drives: publish → HTTP fetch → GET state → POST comments → DELETE comment
 *         → GET state → POST verdict → re-fetch artifact → cesium_wait
 *         → on-disk verification → cross-mode isolation regression.
 *
 * Uses a real HTTP server (port 0 → OS-assigned), a temp stateDir, and the
 * actual tool stack — no mocks beyond stateDir + port injection.
 */

import { describe, it, beforeAll, afterAll, expect } from "bun:test";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAnnotateTool, type AnnotateToolOverrides } from "../src/tools/annotate.ts";
import { createAskTool, type AskToolOverrides } from "../src/tools/ask.ts";
import { createWaitTool } from "../src/tools/wait.ts";
import { readEmbeddedMetadata } from "../src/storage/write.ts";
import { startServer, type ServerHandle } from "../src/server/http.ts";
import { createApiApp } from "../src/server/api.ts";
import type { InteractiveAnnotateData, Comment } from "../src/render/validate.ts";
import type { PluginInput } from "@opencode-ai/plugin";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Derive the API base URL for a session artifact from the artifact's httpUrl.
 *
 * httpUrl shape: http://127.0.0.1:<port>/projects/<slug>/artifacts/<file.html>
 * API base:      http://127.0.0.1:<port>/api/sessions/<slug>/<file.html>
 */
function apiBaseFor(httpUrl: string): string {
  const url = new URL(httpUrl);
  const match = /^\/projects\/([^/]+)\/artifacts\/([^/]+)$/.exec(url.pathname);
  if (match === null || match[1] === undefined || match[2] === undefined) {
    throw new Error(`could not parse project slug + filename from httpUrl: ${httpUrl}`);
  }
  const [, slug, filename] = match;
  return `${url.origin}/api/sessions/${slug}/${filename}`;
}

/**
 * Extract the cesium-meta interactive block from an HTML string.
 */
function extractMetaInteractive(html: string): InteractiveAnnotateData {
  const meta = readEmbeddedMetadata(html);
  if (meta === null) throw new Error("cesium-meta not found in HTML");
  const interactive = meta["interactive"] as InteractiveAnnotateData;
  if (interactive === null || interactive === undefined) {
    throw new Error("interactive field missing from cesium-meta");
  }
  return interactive;
}

function mockCtx(workDir: string): PluginInput {
  return {
    directory: workDir,
    worktree: "",
    $: Bun.$,
  } as unknown as PluginInput;
}

// ─── Test state ────────────────────────────────────────────────────────────────

let workDir: string;
let stateDir: string;
let serverHandle: ServerHandle | null = null;
let serverPort: number;

// ─── Lifecycle ─────────────────────────────────────────────────────────────────

beforeAll(async () => {
  workDir = mkdtempSync(join(tmpdir(), "cesium-e2e-work-"));
  stateDir = mkdtempSync(join(tmpdir(), "cesium-e2e-state-"));

  // Start a real HTTP server on port 0 (OS-assigned) with the API app mounted.
  serverHandle = await startServer({ stateDir, port: 0 });
  serverHandle.app.route("/", createApiApp({ stateDir }));
  serverPort = serverHandle.port;
});

afterAll(async () => {
  if (serverHandle !== null) {
    try {
      await serverHandle.stop();
    } catch {
      // best-effort
    }
    serverHandle = null;
  }
  try {
    rmSync(workDir, { recursive: true, force: true });
    rmSync(stateDir, { recursive: true, force: true });
  } catch {
    // best-effort
  }
});

// ─── The full lifecycle test ────────────────────────────────────────────────────

describe("cesium_annotate end-to-end", () => {
  it("full lifecycle: publish → comments → delete → verdict → wait → disk verification → cross-mode isolation", async () => {
    // ── Step 1: Build overrides so the tool uses our temp stateDir + real server ──

    const annotateOverrides: AnnotateToolOverrides = {
      loadConfig: () => ({
        stateDir,
        port: serverPort,
        portMax: serverPort,
        idleTimeoutMs: 0,
        hostname: "127.0.0.1",
      }),
      // Return the already-running server info; no real ensureRunning spawn.
      ensureRunning: async () => ({
        port: serverPort,
        url: `http://127.0.0.1:${serverPort}`,
        pid: process.pid,
        startedAt: new Date().toISOString(),
      }),
    };

    const ctx = mockCtx(workDir);
    const annotateTool = createAnnotateTool(ctx, annotateOverrides);

    // ── Step 2: Publish the annotate artifact ────────────────────────────────────

    const annotateArgs = {
      title: "E2E review",
      blocks: [
        {
          type: "prose",
          markdown: "This is the intro block for review. Please add your thoughts here.",
        },
        {
          type: "diff",
          lang: "typescript",
          patch: `--- a/src/foo.ts
+++ b/src/foo.ts
@@ -1,5 +1,5 @@
 function foo() {
-  const x = 1;
-  return x;
+  const x = 2;
+  return x * 2;
 }`,
        },
        {
          type: "prose",
          markdown: "Closing remarks: this change looks reasonable overall.",
        },
      ],
      verdictMode: "full",
      perLineFor: ["diff", "code"],
      requireVerdict: true,
    };

    const rawResult = await annotateTool.execute(annotateArgs, {} as never);
    if (typeof rawResult !== "string" || rawResult.startsWith("Error:")) {
      throw new Error(`annotate tool failed: ${String(rawResult)}`);
    }
    const publishResult = JSON.parse(rawResult) as {
      id: string;
      filePath: string;
      fileUrl: string;
      httpUrl: string;
      terminalSummary: string;
    };

    const { id: artifactId, filePath, httpUrl } = publishResult;

    expect(typeof artifactId).toBe("string");
    expect(artifactId.length).toBeGreaterThan(0);
    expect(typeof filePath).toBe("string");
    expect(typeof httpUrl).toBe("string");
    expect(httpUrl).toMatch(
      /^http:\/\/(?:127\.0\.0\.1|localhost):\d+\/projects\/[^/]+\/artifacts\/[^/]+\.html$/,
    );

    // ── Step 3: Fetch HTML over HTTP ─────────────────────────────────────────────

    const htmlRes = await fetch(httpUrl);
    expect(htmlRes.status).toBe(200);

    const html = await htmlRes.text();

    // Block-level anchors
    expect(html).toContain('data-cesium-anchor="block-0"');
    expect(html).toContain('data-cesium-anchor="block-1"'); // diff block itself
    expect(html).toContain('data-cesium-anchor="block-1.line-1"'); // per-line on diff
    expect(html).toContain('data-cesium-anchor="block-2"'); // closing prose

    // Annotate scaffold markers
    expect(html).toContain("data-cesium-annotate-scaffold");
    expect(html).toContain("data-cesium-comment-rail");

    // All three verdict buttons present (full mode)
    expect(html).toContain('data-verdict="approve"');
    expect(html).toContain('data-verdict="request_changes"');
    expect(html).toContain('data-verdict="comment"');

    // Client script present (interactive artifact, not yet frozen)
    expect(html).toContain("<script data-cesium-client>");

    // ── Step 4: GET /state — initial ─────────────────────────────────────────────

    const apiBase = apiBaseFor(httpUrl);
    const stateRes1 = await fetch(`${apiBase}/state`);
    expect(stateRes1.status).toBe(200);

    const state1 = (await stateRes1.json()) as Record<string, unknown>;
    expect(state1["kind"]).toBe("annotate");
    expect(state1["status"]).toBe("open");
    expect(state1["verdict"]).toBeNull();
    expect(state1["verdictMode"]).toBe("full");
    expect(Array.isArray(state1["comments"])).toBe(true);
    expect((state1["comments"] as unknown[]).length).toBe(0);

    // ── Step 5: POST two comments ────────────────────────────────────────────────

    // Comment 1 on the intro prose block
    const addComment1Res = await fetch(`${apiBase}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        anchor: "block-0",
        selectedText: "intro block for review",
        comment: "First comment",
      }),
    });
    expect(addComment1Res.status).toBe(200);

    const addComment1Body = (await addComment1Res.json()) as Record<string, unknown>;
    expect(addComment1Body["ok"]).toBe(true);

    const comment1 = addComment1Body["comment"] as Record<string, unknown>;
    expect(typeof comment1["id"]).toBe("string");
    expect(comment1["anchor"]).toBe("block-0");
    expect(comment1["selectedText"]).toBe("intro block for review");
    expect(comment1["comment"]).toBe("First comment");
    expect(typeof comment1["createdAt"]).toBe("string");

    const id1 = comment1["id"] as string;

    // Comment 2 on a diff line
    const addComment2Res = await fetch(`${apiBase}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        anchor: "block-1.line-2",
        selectedText: "diff line excerpt",
        comment: "Second comment, on a line",
      }),
    });
    expect(addComment2Res.status).toBe(200);

    const addComment2Body = (await addComment2Res.json()) as Record<string, unknown>;
    expect(addComment2Body["ok"]).toBe(true);

    const comment2 = addComment2Body["comment"] as Record<string, unknown>;
    const id2 = comment2["id"] as string;
    expect(typeof id2).toBe("string");
    expect(comment2["anchor"]).toBe("block-1.line-2");
    expect(comment2["comment"]).toBe("Second comment, on a line");

    // IDs are distinct
    expect(id1).not.toBe(id2);

    // ── Step 6: GET /state — after adding two comments ───────────────────────────

    const stateRes2 = await fetch(`${apiBase}/state`);
    expect(stateRes2.status).toBe(200);

    const state2 = (await stateRes2.json()) as Record<string, unknown>;
    expect(state2["status"]).toBe("open");
    const comments2 = state2["comments"] as Record<string, unknown>[];
    expect(comments2.length).toBe(2);
    // Submission order preserved
    expect(comments2[0]?.["id"]).toBe(id1);
    expect(comments2[1]?.["id"]).toBe(id2);

    // ── Step 7: DELETE the first comment ─────────────────────────────────────────

    const deleteRes = await fetch(`${apiBase}/comments/${id1}`, { method: "DELETE" });
    expect(deleteRes.status).toBe(200);

    const deleteBody = (await deleteRes.json()) as Record<string, unknown>;
    expect(deleteBody["ok"]).toBe(true);

    // ── Step 8: GET /state — after delete ────────────────────────────────────────

    const stateRes3 = await fetch(`${apiBase}/state`);
    expect(stateRes3.status).toBe(200);

    const state3 = (await stateRes3.json()) as Record<string, unknown>;
    expect(state3["status"]).toBe("open");
    const comments3 = state3["comments"] as Record<string, unknown>[];
    expect(comments3.length).toBe(1);
    expect(comments3[0]?.["id"]).toBe(id2);

    // id1 is gone
    expect(comments3.some((c) => c["id"] === id1)).toBe(false);

    // ── Step 9: POST verdict ──────────────────────────────────────────────────────

    const verdictRes = await fetch(`${apiBase}/verdict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ verdict: "request_changes" }),
    });
    expect(verdictRes.status).toBe(200);

    const verdictBody = (await verdictRes.json()) as Record<string, unknown>;
    expect(verdictBody["ok"]).toBe(true);
    expect(verdictBody["status"]).toBe("complete");

    const verdictField = verdictBody["verdict"] as Record<string, unknown>;
    expect(verdictField["value"]).toBe("request_changes");
    expect(typeof verdictField["decidedAt"]).toBe("string");

    // ── Step 10: Re-fetch artifact over HTTP — frozen rendering ───────────────────

    const frozenRes = await fetch(httpUrl);
    expect(frozenRes.status).toBe(200);

    const frozenHtml = await frozenRes.text();

    // Phase 6 invariant: client script retained post-verdict (for comment-bubble positioning).
    // parse5 serializes boolean attributes as attr="" so we match either form.
    expect(frozenHtml).toMatch(/<script data-cesium-client(="")?>/);

    // Scaffold marks the artifact as complete
    expect(frozenHtml).toContain('data-cesium-status="complete"');

    // One comment bubble for the surviving comment (id2)
    expect(frozenHtml).toContain('class="cs-comment-bubble"');
    expect(frozenHtml).toContain(`data-comment-id="${id2}"`);

    // Verdict pill with request_changes variant
    expect(frozenHtml).toContain('class="cs-verdict-pill cs-verdict-pill-request_changes"');

    // id1 bubble must not appear (it was deleted before verdict)
    expect(frozenHtml).not.toContain(`data-comment-id="${id1}"`);

    // ── Step 11: cesium_wait ──────────────────────────────────────────────────────

    const waitOverrides = {
      loadConfig: () => ({
        stateDir,
        port: serverPort,
        portMax: serverPort,
        idleTimeoutMs: 0,
        hostname: "127.0.0.1",
      }),
    };
    const waitTool = createWaitTool(ctx, waitOverrides);
    const waitRaw = await waitTool.execute(
      { id: artifactId, timeoutMs: 5000, pollIntervalMs: 100 },
      {} as never,
    );

    if (typeof waitRaw !== "string") throw new Error("expected string from wait tool");
    const waitResult = JSON.parse(waitRaw) as Record<string, unknown>;

    expect(waitResult["status"]).toBe("complete");
    expect(waitResult["kind"]).toBe("annotate");

    // Comments array: only id2 survives
    const waitComments = waitResult["comments"] as Comment[];
    expect(waitComments.length).toBe(1);
    expect(waitComments[0]?.anchor).toBe("block-1.line-2");
    expect(waitComments[0]?.comment).toBe("Second comment, on a line");

    // Verdict
    const waitVerdict = waitResult["verdict"] as { value: string; decidedAt: string } | null;
    expect(waitVerdict).not.toBeNull();
    expect(waitVerdict?.value).toBe("request_changes");
    expect(typeof waitVerdict?.decidedAt).toBe("string");

    // Ask fields are present but empty (annotate mode)
    expect(waitResult["answers"]).toEqual({});
    expect(waitResult["remaining"]).toEqual([]);

    // ── Step 12: On-disk verification (source of truth) ───────────────────────────

    const diskHtml = readFileSync(filePath, "utf8");
    const diskInteractive = extractMetaInteractive(diskHtml);

    expect(diskInteractive.kind).toBe("annotate");
    expect(diskInteractive.status).toBe("complete");
    expect(diskInteractive.comments.length).toBe(1);
    expect(diskInteractive.comments[0]?.anchor).toBe("block-1.line-2");
    expect(diskInteractive.comments[0]?.comment).toBe("Second comment, on a line");
    expect(diskInteractive.verdict).not.toBeNull();
    expect(diskInteractive.verdict?.value).toBe("request_changes");
    expect(typeof diskInteractive.verdict?.decidedAt).toBe("string");

    // Belt-and-suspenders: disk verdict matches what the wait tool returned
    expect(diskInteractive.verdict?.decidedAt).toBe(waitVerdict?.decidedAt);

    // ── Step 13: Cross-mode isolation regression ─────────────────────────────────

    // 13a: POST /answers/:qid on the annotate artifact → 404 not-interactive
    const answersOnAnnotateRes = await fetch(`${apiBase}/answers/q1`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: { type: "pick_one", selected: "a" } }),
    });
    expect(answersOnAnnotateRes.status).toBe(404);
    const answersOnAnnotateBody = (await answersOnAnnotateRes.json()) as Record<string, unknown>;
    expect(answersOnAnnotateBody["reason"]).toBe("not-interactive");

    // 13b: Publish a parallel cesium_ask artifact in the same project, then POST /comments → 404
    const askOverrides: AskToolOverrides = {
      loadConfig: () => ({
        stateDir,
        port: serverPort,
        portMax: serverPort,
        idleTimeoutMs: 0,
        hostname: "127.0.0.1",
      }),
      ensureRunning: async () => ({
        port: serverPort,
        url: `http://127.0.0.1:${serverPort}`,
        pid: process.pid,
        startedAt: new Date().toISOString(),
      }),
    };
    const askTool = createAskTool(ctx, askOverrides);
    const askRaw = await askTool.execute(
      {
        title: "Isolation test Q",
        body: "<p>Framing for the isolation test.</p>",
        questions: [
          {
            type: "pick_one",
            id: "q1",
            question: "Which?",
            options: [
              { id: "a", label: "Option A" },
              { id: "b", label: "Option B" },
            ],
          },
        ],
      },
      {} as never,
    );

    if (typeof askRaw !== "string" || (askRaw as string).startsWith("Error:")) {
      throw new Error(`ask tool failed: ${String(askRaw)}`);
    }

    const askResult = JSON.parse(askRaw) as { id: string; httpUrl: string };
    const askApiBase = apiBaseFor(askResult.httpUrl);

    const commentsOnAskRes = await fetch(`${askApiBase}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        anchor: "block-0",
        selectedText: "",
        comment: "should be rejected",
      }),
    });
    expect(commentsOnAskRes.status).toBe(404);
    const commentsOnAskBody = (await commentsOnAskRes.json()) as Record<string, unknown>;
    expect(commentsOnAskBody["reason"]).toBe("not-interactive");
  });
});
