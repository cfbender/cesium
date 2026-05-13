import { test, expect, beforeEach, afterEach, describe } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startServer, type ServerHandle } from "../src/server/http.ts";
import { createApiApp } from "../src/server/api.ts";
import { addComment, removeComment, setVerdict, submitAnswer } from "../src/storage/mutate.ts";
import { atomicWrite } from "../src/storage/write.ts";
import { wrapDocument, type ArtifactMeta } from "../src/render/wrap.ts";
import { defaultTheme } from "../src/render/theme.ts";
import type {
  InteractiveAskData,
  InteractiveAnnotateData,
  InteractiveData,
} from "../src/render/validate.ts";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const META_RE =
  /<script\s[^>]*type="application\/json"[^>]*id="cesium-meta"[^>]*>([\s\S]*?)<\/script>/i;

function parseMeta(html: string): Record<string, unknown> {
  const m = META_RE.exec(html);
  if (!m || m[1] === undefined) throw new Error("cesium-meta not found");
  return JSON.parse(m[1]) as Record<string, unknown>;
}

function makeArtifactMeta(overrides?: Partial<ArtifactMeta>): ArtifactMeta {
  return {
    id: "a7K9pQ",
    title: "Test Annotate",
    kind: "annotate",
    summary: null,
    tags: [],
    createdAt: "2026-05-11T14:22:09Z",
    model: null,
    sessionId: null,
    projectSlug: "test-project",
    projectName: "Test",
    cwd: "/tmp/test",
    worktree: null,
    gitBranch: null,
    gitCommit: null,
    supersedes: null,
    supersededBy: null,
    contentSha256: "deadbeef",
    inputMode: "blocks",
    ...overrides,
  };
}

function makeAnnotateInteractive(
  overrides?: Partial<InteractiveAnnotateData>,
): InteractiveAnnotateData {
  return {
    kind: "annotate",
    status: "open",
    expiresAt: "2099-12-31T23:59:59Z",
    verdictMode: "full",
    requireVerdict: true,
    perLineFor: ["diff", "code"],
    comments: [],
    verdict: null,
    ...overrides,
  };
}

function makeAskInteractive(overrides?: Partial<InteractiveAskData>): InteractiveAskData {
  return {
    kind: "ask",
    status: "open",
    requireAll: true,
    expiresAt: "2099-12-31T23:59:59Z",
    questions: [
      {
        type: "pick_one",
        id: "q1",
        question: "Which option?",
        options: [
          { id: "a", label: "Option A" },
          { id: "b", label: "Option B" },
        ],
      },
    ],
    answers: {},
    ...overrides,
  };
}

// ─── Storage layer test state ─────────────────────────────────────────────────

let storeTmpDir: string;
let storeArtifactsDir: string;

// ─── API test state ───────────────────────────────────────────────────────────

let apiStateDir: string;
let apiArtifactsDir: string;
let handle: ServerHandle | null = null;
const PROJECT_SLUG = "test-proj";
const FILENAME = "2026-05-11T14-22-09Z__test-artifact__a7K9pQ.html";

beforeEach(async () => {
  // Storage-layer fixtures
  storeTmpDir = mkdtempSync(join(tmpdir(), "cesium-annotate-mutate-"));
  storeArtifactsDir = join(storeTmpDir, "projects", "test-project", "artifacts");
  mkdirSync(storeArtifactsDir, { recursive: true });

  // API fixtures
  apiStateDir = mkdtempSync(join(tmpdir(), "cesium-annotate-api-"));
  apiArtifactsDir = join(apiStateDir, "projects", PROJECT_SLUG, "artifacts");
  mkdirSync(apiArtifactsDir, { recursive: true });

  handle = await startServer({ stateDir: apiStateDir, port: 0 });
  handle.app.route("/", createApiApp({ stateDir: apiStateDir }));
});

afterEach(async () => {
  if (handle !== null) {
    await handle.stop();
    handle = null;
  }
  rmSync(storeTmpDir, { recursive: true, force: true });
  rmSync(apiStateDir, { recursive: true, force: true });
});

// ─── Fixture writers ──────────────────────────────────────────────────────────

async function writeAnnotateArtifact(
  filename: string,
  interactive: InteractiveAnnotateData,
  dir: string = storeArtifactsDir,
): Promise<string> {
  const path = join(dir, filename);
  const html = wrapDocument({
    body: `<div data-cesium-anchor="block-0"><p>Review this</p></div>`,
    meta: makeArtifactMeta(),
    theme: defaultTheme(),
    interactive,
    themeCssHref: null,
  });
  await atomicWrite(path, html);
  return path;
}

async function writeAskArtifact(
  filename: string,
  interactive: InteractiveAskData,
  dir: string = storeArtifactsDir,
): Promise<string> {
  const path = join(dir, filename);
  const html = wrapDocument({
    body: "<p>framing</p>",
    meta: makeArtifactMeta({ kind: "ask", inputMode: "html" }),
    theme: defaultTheme(),
    interactive,
    themeCssHref: null,
  });
  await atomicWrite(path, html);
  return path;
}

// API helpers
function baseUrl(): string {
  if (handle === null) throw new Error("server handle not initialized");
  return handle.url;
}

function commentsUrl(filename = FILENAME): string {
  return `${baseUrl()}/api/sessions/${PROJECT_SLUG}/${filename}/comments`;
}

function commentIdUrl(commentId: string, filename = FILENAME): string {
  return `${baseUrl()}/api/sessions/${PROJECT_SLUG}/${filename}/comments/${commentId}`;
}

function verdictUrl(filename = FILENAME): string {
  return `${baseUrl()}/api/sessions/${PROJECT_SLUG}/${filename}/verdict`;
}

function answerUrl(qid = "q1", filename = FILENAME): string {
  return `${baseUrl()}/api/sessions/${PROJECT_SLUG}/${filename}/answers/${qid}`;
}

function stateUrl(filename = FILENAME): string {
  return `${baseUrl()}/api/sessions/${PROJECT_SLUG}/${filename}/state`;
}

async function writeApiAnnotateArtifact(interactive?: InteractiveData): Promise<string> {
  const path = join(apiArtifactsDir, FILENAME);
  const html = wrapDocument({
    body: `<div data-cesium-anchor="block-0"><p>Review this</p></div>`,
    meta: makeArtifactMeta({ projectSlug: PROJECT_SLUG }),
    theme: defaultTheme(),
    themeCssHref: null,
    ...(interactive !== undefined ? { interactive } : {}),
  });
  await atomicWrite(path, html);
  return path;
}

async function writeApiAskArtifact(interactive?: InteractiveData): Promise<string> {
  const path = join(apiArtifactsDir, FILENAME);
  const html = wrapDocument({
    body: "<p>framing</p>",
    meta: makeArtifactMeta({ kind: "ask", inputMode: "html", projectSlug: PROJECT_SLUG }),
    theme: defaultTheme(),
    themeCssHref: null,
    ...(interactive !== undefined ? { interactive } : {}),
  });
  await atomicWrite(path, html);
  return path;
}

// ─── Storage layer tests ──────────────────────────────────────────────────────

describe("addComment — storage layer", () => {
  // Case 1: addComment on fresh artifact → returns ok, meta updated
  test("happy path: returns ok:true with comment; meta has one comment", async () => {
    const path = await writeAnnotateArtifact("artifact.html", makeAnnotateInteractive());

    const outcome = await addComment({
      artifactPath: path,
      anchor: "block-0",
      selectedText: "Review this",
      comment: "Looks good to me",
    });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) throw new Error();
    expect(typeof outcome.comment.id).toBe("string");
    expect(outcome.comment.id.length).toBe(6);
    expect(outcome.comment.anchor).toBe("block-0");
    expect(outcome.comment.selectedText).toBe("Review this");
    expect(outcome.comment.comment).toBe("Looks good to me");
    expect(typeof outcome.comment.createdAt).toBe("string");

    // Verify disk state
    const html = await Bun.file(path).text();
    const meta = parseMeta(html);
    const interactive = meta["interactive"] as InteractiveAnnotateData;
    expect(interactive.comments).toHaveLength(1);
    expect(interactive.comments[0]?.anchor).toBe("block-0");
  });

  // Case 2: addComment with invalid anchor → invalid-value
  test("invalid anchor → invalid-value", async () => {
    const path = await writeAnnotateArtifact("artifact.html", makeAnnotateInteractive());

    const outcome = await addComment({
      artifactPath: path,
      anchor: "not-a-valid-anchor",
      selectedText: "",
      comment: "some comment",
    });

    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error();
    expect(outcome.reason).toBe("invalid-value");
  });

  // Case 3: addComment with empty/whitespace comment → invalid-value
  test("empty comment → invalid-value", async () => {
    const path = await writeAnnotateArtifact("artifact.html", makeAnnotateInteractive());

    const outcome = await addComment({
      artifactPath: path,
      anchor: "block-0",
      selectedText: "",
      comment: "   ",
    });

    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error();
    expect(outcome.reason).toBe("invalid-value");
  });

  // Case 4: addComment on ask artifact → not-interactive
  test("ask artifact → not-interactive", async () => {
    const path = await writeAskArtifact("ask.html", makeAskInteractive());

    const outcome = await addComment({
      artifactPath: path,
      anchor: "block-0",
      selectedText: "",
      comment: "a comment",
    });

    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error();
    expect(outcome.reason).toBe("not-interactive");
  });

  // Case 5: addComment on missing file → not-found
  test("missing artifact → not-found", async () => {
    const outcome = await addComment({
      artifactPath: join(storeArtifactsDir, "does-not-exist.html"),
      anchor: "block-0",
      selectedText: "",
      comment: "a comment",
    });

    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error();
    expect(outcome.reason).toBe("not-found");
  });

  // Case 6: addComment on complete session → session-ended
  test("complete session → session-ended", async () => {
    const path = await writeAnnotateArtifact(
      "artifact.html",
      makeAnnotateInteractive({ status: "complete" }),
    );

    const outcome = await addComment({
      artifactPath: path,
      anchor: "block-0",
      selectedText: "",
      comment: "a comment",
    });

    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error();
    expect(outcome.reason).toBe("session-ended");
    if (outcome.reason !== "session-ended") throw new Error();
    expect(outcome.status).toBe("complete");
  });

  // Case 7: addComment on expired session → session-ended
  test("expired session → session-ended", async () => {
    const path = await writeAnnotateArtifact(
      "artifact.html",
      makeAnnotateInteractive({ status: "expired" }),
    );

    const outcome = await addComment({
      artifactPath: path,
      anchor: "block-0",
      selectedText: "",
      comment: "a comment",
    });

    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error();
    expect(outcome.reason).toBe("session-ended");
  });

  // Case 8: past expiresAt → flips status to expired, returns expired, file updated
  test("past expiresAt → expired, disk updated", async () => {
    const path = await writeAnnotateArtifact(
      "artifact.html",
      makeAnnotateInteractive({ expiresAt: "2000-01-01T00:00:00Z" }),
    );

    const outcome = await addComment({
      artifactPath: path,
      anchor: "block-0",
      selectedText: "",
      comment: "a comment",
    });

    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error();
    expect(outcome.reason).toBe("expired");

    const html = await Bun.file(path).text();
    const meta = parseMeta(html);
    const interactive = meta["interactive"] as InteractiveAnnotateData;
    expect(interactive.status).toBe("expired");
  });

  // Case 9: two sequential addComment calls → both succeed, distinct ids, order preserved
  test("two sequential adds → both succeed, distinct ids, order preserved", async () => {
    const path = await writeAnnotateArtifact("artifact.html", makeAnnotateInteractive());

    const r1 = await addComment({
      artifactPath: path,
      anchor: "block-0",
      selectedText: "first",
      comment: "first comment",
    });
    const r2 = await addComment({
      artifactPath: path,
      anchor: "block-0",
      selectedText: "second",
      comment: "second comment",
    });

    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
    if (!r1.ok || !r2.ok) throw new Error();

    // Distinct ids
    expect(r1.comment.id).not.toBe(r2.comment.id);

    // Disk has both in submission order
    const html = await Bun.file(path).text();
    const meta = parseMeta(html);
    const interactive = meta["interactive"] as InteractiveAnnotateData;
    expect(interactive.comments).toHaveLength(2);
    expect(interactive.comments[0]?.comment).toBe("first comment");
    expect(interactive.comments[1]?.comment).toBe("second comment");
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("removeComment — storage layer", () => {
  // Case 10: happy path → ok:true, one fewer comment
  test("happy path: comment removed from meta", async () => {
    const path = await writeAnnotateArtifact("artifact.html", makeAnnotateInteractive());

    const added = await addComment({
      artifactPath: path,
      anchor: "block-0",
      selectedText: "",
      comment: "to be removed",
    });
    if (!added.ok) throw new Error("addComment failed");
    const commentId = added.comment.id;

    const outcome = await removeComment({ artifactPath: path, commentId });
    expect(outcome.ok).toBe(true);

    const html = await Bun.file(path).text();
    const meta = parseMeta(html);
    const interactive = meta["interactive"] as InteractiveAnnotateData;
    expect(interactive.comments).toHaveLength(0);
  });

  // Case 11: unknown commentId → comment-not-found
  test("unknown commentId → comment-not-found", async () => {
    const path = await writeAnnotateArtifact("artifact.html", makeAnnotateInteractive());

    const outcome = await removeComment({ artifactPath: path, commentId: "unknown" });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error();
    expect(outcome.reason).toBe("comment-not-found");
  });

  // Case 12: closed session → session-ended
  test("closed session → session-ended", async () => {
    const path = await writeAnnotateArtifact(
      "artifact.html",
      makeAnnotateInteractive({ status: "complete" }),
    );

    const outcome = await removeComment({ artifactPath: path, commentId: "doesnt-matter" });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error();
    expect(outcome.reason).toBe("session-ended");
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("setVerdict — storage layer", () => {
  // Case 13: valid approve → ok:true, status complete, meta correct, client script removed
  test("valid approve → ok:true, status:complete, completedAt set", async () => {
    const path = await writeAnnotateArtifact("artifact.html", makeAnnotateInteractive());

    const outcome = await setVerdict({ artifactPath: path, verdict: "approve" });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) throw new Error();
    expect(outcome.status).toBe("complete");
    expect(outcome.verdict.value).toBe("approve");
    expect(typeof outcome.verdict.decidedAt).toBe("string");

    const html = await Bun.file(path).text();
    const meta = parseMeta(html);
    const interactive = meta["interactive"] as InteractiveAnnotateData;
    expect(interactive.status).toBe("complete");
    expect(interactive.verdict?.value).toBe("approve");
    expect(typeof interactive.completedAt).toBe("string");
  });

  // Case 14: request_changes in approve mode → invalid-value
  test("request_changes in approve mode → invalid-value", async () => {
    const path = await writeAnnotateArtifact(
      "artifact.html",
      makeAnnotateInteractive({ verdictMode: "approve" }),
    );

    const outcome = await setVerdict({ artifactPath: path, verdict: "request_changes" });

    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error();
    expect(outcome.reason).toBe("invalid-value");
  });

  // Case 15: comment in approve-or-reject mode → invalid-value
  test("comment in approve-or-reject mode → invalid-value", async () => {
    const path = await writeAnnotateArtifact(
      "artifact.html",
      makeAnnotateInteractive({ verdictMode: "approve-or-reject" }),
    );

    const outcome = await setVerdict({ artifactPath: path, verdict: "comment" });

    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error();
    expect(outcome.reason).toBe("invalid-value");
  });

  // Case 16: request_changes in full mode → ok
  test("request_changes in full mode → ok", async () => {
    const path = await writeAnnotateArtifact(
      "artifact.html",
      makeAnnotateInteractive({ verdictMode: "full" }),
    );

    const outcome = await setVerdict({ artifactPath: path, verdict: "request_changes" });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) throw new Error();
    expect(outcome.verdict.value).toBe("request_changes");
  });

  // Case 17: closed session → session-ended
  test("closed session → session-ended", async () => {
    const path = await writeAnnotateArtifact(
      "artifact.html",
      makeAnnotateInteractive({ status: "complete" }),
    );

    const outcome = await setVerdict({ artifactPath: path, verdict: "approve" });

    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error();
    expect(outcome.reason).toBe("session-ended");
  });

  // Case 18: client script RETAINED after setVerdict (Phase 6: positioning still needs it)
  test("client script is retained after setVerdict", async () => {
    const path = await writeAnnotateArtifact("artifact.html", makeAnnotateInteractive());

    const before = await Bun.file(path).text();
    expect(before).toContain("data-cesium-client");

    await setVerdict({ artifactPath: path, verdict: "approve" });

    const after = await Bun.file(path).text();
    expect(after).toContain("data-cesium-client");
  });

  // Case 19: scaffold data-cesium-status="complete" after setVerdict
  test("scaffold gets data-cesium-status=complete after setVerdict", async () => {
    const path = await writeAnnotateArtifact("artifact.html", makeAnnotateInteractive());

    await setVerdict({ artifactPath: path, verdict: "approve" });

    const html = await Bun.file(path).text();
    expect(html).toContain('data-cesium-status="complete"');
  });

  // Case 20a: after setVerdict, rail contains one bubble per comment
  test("after setVerdict, rail contains one bubble per comment", async () => {
    const interactive = makeAnnotateInteractive({
      comments: [
        {
          id: "cmt-001",
          anchor: "block-0",
          selectedText: "some text",
          comment: "This looks good",
          createdAt: "2026-05-13T12:00:00Z",
        },
        {
          id: "cmt-002",
          anchor: "block-0.line-3",
          selectedText: "",
          comment: "Minor nit",
          createdAt: "2026-05-13T12:01:00Z",
        },
      ],
    });
    const path = await writeAnnotateArtifact("artifact.html", interactive);

    await setVerdict({ artifactPath: path, verdict: "approve" });

    const html = await Bun.file(path).text();
    const bubbleMatches = html.match(/class="cs-comment-bubble"/g);
    expect(bubbleMatches).not.toBeNull();
    expect(bubbleMatches?.length).toBe(2);
    // Rail should be present and non-empty
    expect(html).toContain("data-cesium-comment-rail");
    expect(html).toContain('data-comment-id="cmt-001"');
    expect(html).toContain('data-comment-id="cmt-002"');
  });

  // Case 20b: after setVerdict, verdict pill is inserted after back-nav
  test("after setVerdict, verdict pill inserted after cesium-back nav", async () => {
    const path = await writeAnnotateArtifact("artifact.html", makeAnnotateInteractive());

    await setVerdict({ artifactPath: path, verdict: "approve" });

    const html = await Bun.file(path).text();
    expect(html).toContain('class="cs-verdict-pill cs-verdict-pill-approve"');
    expect(html).toContain('data-cesium-verdict="approve"');
    // Pill should appear after the back-nav element
    const navIdx = html.indexOf('class="cesium-back"');
    const pillIdx = html.indexOf('class="cs-verdict-pill');
    expect(navIdx).toBeGreaterThan(-1);
    expect(pillIdx).toBeGreaterThan(navIdx);
  });

  // Case 20c: after setVerdict with zero comments, rail is empty but pill is present
  test("after setVerdict with zero comments, rail empty but pill present", async () => {
    const path = await writeAnnotateArtifact("artifact.html", makeAnnotateInteractive());

    await setVerdict({ artifactPath: path, verdict: "request_changes" });

    const html = await Bun.file(path).text();
    // Rail present but no bubbles
    expect(html).toContain("data-cesium-comment-rail");
    expect(html).not.toContain('class="cs-comment-bubble"');
    // Pill present with request_changes variant
    expect(html).toContain("cs-verdict-pill-request_changes");
  });

  // Case 20d: after setVerdict, HTML-unsafe comment text is escaped in the rail
  test("after setVerdict, comments with unsafe HTML are escaped in the rail", async () => {
    const interactive = makeAnnotateInteractive({
      comments: [
        {
          id: "cmt-xss",
          anchor: "block-0",
          selectedText: "<script>alert('xss')</script>",
          comment: "Looks like <b>bold</b> & more",
          createdAt: "2026-05-13T12:00:00Z",
        },
      ],
    });
    const path = await writeAnnotateArtifact("artifact.html", interactive);

    await setVerdict({ artifactPath: path, verdict: "approve" });

    const html = await Bun.file(path).text();

    // Extract only the rail portion to check escaping (meta JSON has raw strings)
    const railStart = html.indexOf("data-cesium-comment-rail");
    const railEnd = html.indexOf("</aside>", railStart);
    expect(railStart).toBeGreaterThan(-1);
    const railHtml = html.slice(railStart, railEnd + "</aside>".length);

    // Unsafe sequences must not appear literally in the rendered rail
    expect(railHtml).not.toContain("<script>");
    expect(railHtml).not.toContain("<b>bold</b>");
    // Escaped forms should appear in the rail
    expect(railHtml).toContain("&lt;script&gt;");
    expect(railHtml).toContain("&lt;b&gt;bold&lt;/b&gt;");
    expect(railHtml).toContain("&amp;");
  });

  // Case 20: submitAnswer on annotate artifact → not-interactive
  test("submitAnswer on annotate artifact → not-interactive", async () => {
    const path = await writeAnnotateArtifact("artifact.html", makeAnnotateInteractive());

    const outcome = await submitAnswer({
      artifactPath: path,
      questionId: "q1",
      value: { type: "pick_one", selected: "a" },
    });

    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error();
    expect(outcome.reason).toBe("not-interactive");
  });
});

// ─── API layer tests ──────────────────────────────────────────────────────────

describe("POST /api/.../comments — happy path", () => {
  // Case 21: POST /comments happy path → 200 + correct JSON; disk updated
  test("200 with comment in JSON; disk has the comment", async () => {
    await writeApiAnnotateArtifact(makeAnnotateInteractive());

    const res = await fetch(commentsUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        anchor: "block-0",
        selectedText: "some text",
        comment: "API comment",
      }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body["ok"]).toBe(true);
    const comment = body["comment"] as Record<string, unknown>;
    expect(typeof comment["id"]).toBe("string");
    expect(comment["anchor"]).toBe("block-0");
    expect(comment["comment"]).toBe("API comment");
    expect(res.headers.get("cache-control")).toBe("no-store");

    // Disk updated
    const html = await Bun.file(join(apiArtifactsDir, FILENAME)).text();
    const meta = parseMeta(html);
    const interactive = meta["interactive"] as InteractiveAnnotateData;
    expect(interactive.comments).toHaveLength(1);
  });
});

describe("POST /api/.../comments — error cases", () => {
  // Case 22: missing comment field → 400
  test("missing comment field → 400", async () => {
    await writeApiAnnotateArtifact(makeAnnotateInteractive());

    const res = await fetch(commentsUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anchor: "block-0", selectedText: "text" }),
    });

    expect(res.status).toBe(400);
  });

  // Case 23: invalid anchor → 422
  test("invalid anchor → 422", async () => {
    await writeApiAnnotateArtifact(makeAnnotateInteractive());

    const res = await fetch(commentsUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        anchor: "invalid-anchor-format",
        selectedText: "",
        comment: "test",
      }),
    });

    expect(res.status).toBe(422);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body["ok"]).toBe(false);
    expect(typeof body["message"]).toBe("string");
  });
});

describe("DELETE /api/.../comments/:id", () => {
  // Case 24: DELETE happy path → 200
  test("happy path → 200", async () => {
    await writeApiAnnotateArtifact(makeAnnotateInteractive());

    // Add a comment first
    const addRes = await fetch(commentsUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anchor: "block-0", selectedText: "", comment: "to delete" }),
    });
    const addBody = (await addRes.json()) as Record<string, unknown>;
    const commentId = (addBody["comment"] as Record<string, unknown>)["id"] as string;

    const res = await fetch(commentIdUrl(commentId), { method: "DELETE" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body["ok"]).toBe(true);
  });

  // Case 25: DELETE unknown id → 404
  test("unknown comment id → 404", async () => {
    await writeApiAnnotateArtifact(makeAnnotateInteractive());

    const res = await fetch(commentIdUrl("nonexistent"), { method: "DELETE" });
    expect(res.status).toBe(404);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body["ok"]).toBe(false);
    expect(body["reason"]).toBe("comment-not-found");
  });
});

describe("POST /api/.../verdict", () => {
  // Case 26: POST /verdict happy path → 200
  test("happy path → 200 with correct shape", async () => {
    await writeApiAnnotateArtifact(makeAnnotateInteractive());

    const res = await fetch(verdictUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ verdict: "approve" }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body["ok"]).toBe(true);
    expect(body["status"]).toBe("complete");
    const verdict = body["verdict"] as Record<string, unknown>;
    expect(verdict["value"]).toBe("approve");
    expect(typeof verdict["decidedAt"]).toBe("string");
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  // Case 27: POST /verdict with reject (invalid for any mode) → 422
  test('verdict "reject" is invalid for any mode → 422', async () => {
    await writeApiAnnotateArtifact(makeAnnotateInteractive({ verdictMode: "full" }));

    const res = await fetch(verdictUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ verdict: "reject" }),
    });

    expect(res.status).toBe(422);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body["ok"]).toBe(false);
    expect(typeof body["message"]).toBe("string");
  });

  // Case 28: POST /verdict on closed session → 410
  test("closed session → 410", async () => {
    await writeApiAnnotateArtifact(makeAnnotateInteractive({ status: "complete" }));

    const res = await fetch(verdictUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ verdict: "approve" }),
    });

    expect(res.status).toBe(410);
  });
});

describe("cross-route isolation", () => {
  // Case 29: POST /answers/:qid on annotate artifact → 404 not-interactive
  test("POST /answers on annotate artifact → 404 not-interactive", async () => {
    await writeApiAnnotateArtifact(makeAnnotateInteractive());

    const res = await fetch(answerUrl("q1"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: { type: "pick_one", selected: "a" } }),
    });

    expect(res.status).toBe(404);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body["reason"]).toBe("not-interactive");
  });

  // Case 30: POST /comments on ask artifact → 404 not-interactive
  test("POST /comments on ask artifact → 404 not-interactive", async () => {
    await writeApiAskArtifact(makeAskInteractive());

    const res = await fetch(commentsUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anchor: "block-0", selectedText: "", comment: "test" }),
    });

    expect(res.status).toBe(404);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body["reason"]).toBe("not-interactive");
  });
});

describe("GET /api/.../state", () => {
  // Case 31: GET /state on annotate artifact returns annotate shape
  test("annotate artifact returns annotate shape with comments, verdict, verdictMode", async () => {
    await writeApiAnnotateArtifact(makeAnnotateInteractive());

    const res = await fetch(stateUrl());
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body["kind"]).toBe("annotate");
    expect(body["status"]).toBe("open");
    expect(Array.isArray(body["comments"])).toBe(true);
    expect(body["verdict"]).toBeNull();
    expect(body["verdictMode"]).toBe("full");
    // Must NOT have ask-specific fields
    expect("answers" in body).toBe(false);
    expect("remaining" in body).toBe(false);
  });

  // Case 32: GET /state on ask artifact returns ask shape
  test("ask artifact returns ask shape with answers, remaining", async () => {
    await writeApiAskArtifact(makeAskInteractive());

    const res = await fetch(stateUrl());
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body["kind"]).toBe("ask");
    expect(body["status"]).toBe("open");
    expect(typeof body["answers"]).toBe("object");
    expect(Array.isArray(body["remaining"])).toBe(true);
    // Must NOT have annotate-specific fields
    expect("comments" in body).toBe(false);
    expect("verdict" in body).toBe(false);
  });
});

describe("path traversal protection — annotate routes", () => {
  // Case 33: path traversal on new routes rejected
  test("path traversal on POST /comments → 400 or 404", async () => {
    const url = `${baseUrl()}/api/sessions/..%2F..%2Fetc/${FILENAME}/comments`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anchor: "block-0", selectedText: "", comment: "hack" }),
    });
    expect([400, 404]).toContain(res.status);
  });

  test("path traversal on DELETE /comments/:id → 400 or 404", async () => {
    const url = `${baseUrl()}/api/sessions/..%2F..%2Fetc/${FILENAME}/comments/abc`;
    const res = await fetch(url, { method: "DELETE" });
    expect([400, 404]).toContain(res.status);
  });

  test("path traversal on POST /verdict → 400 or 404", async () => {
    const url = `${baseUrl()}/api/sessions/..%2F..%2Fetc/${FILENAME}/verdict`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ verdict: "approve" }),
    });
    expect([400, 404]).toContain(res.status);
  });
});
