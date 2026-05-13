import { test, expect, beforeEach, afterEach, describe } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startServer, type ServerHandle } from "../src/server/http.ts";
import { createApiApp } from "../src/server/api.ts";
import { atomicWrite } from "../src/storage/write.ts";
import { wrapDocument, type ArtifactMeta } from "../src/render/wrap.ts";
import { defaultTheme } from "../src/render/theme.ts";
import type { InteractiveData } from "../src/render/validate.ts";

// ─── Helpers ──────────────────────────────────────────────────────────────────

let stateDir: string;
let artifactsDir: string;
let handle: ServerHandle | null = null;
const PROJECT_SLUG = "test-proj";
const FILENAME = "2026-05-11T14-22-09Z__test-artifact__a7K9pQ.html";

beforeEach(async () => {
  stateDir = mkdtempSync(join(tmpdir(), "cesium-api-"));
  artifactsDir = join(stateDir, "projects", PROJECT_SLUG, "artifacts");
  mkdirSync(artifactsDir, { recursive: true });

  handle = await startServer({ stateDir, port: 0 });
  handle.app.route("/", createApiApp({ stateDir }));
});

afterEach(async () => {
  if (handle !== null) {
    await handle.stop();
    handle = null;
  }
  rmSync(stateDir, { recursive: true, force: true });
});

function makeMeta(overrides?: Partial<ArtifactMeta>): ArtifactMeta {
  return {
    id: "a7K9pQ",
    title: "Test Ask",
    kind: "ask",
    summary: null,
    tags: [],
    createdAt: "2026-05-11T14:22:09Z",
    model: null,
    sessionId: null,
    projectSlug: PROJECT_SLUG,
    projectName: "Test",
    cwd: "/tmp/test",
    worktree: null,
    gitBranch: null,
    gitCommit: null,
    supersedes: null,
    supersededBy: null,
    contentSha256: "deadbeef",
    inputMode: "html",
    ...overrides,
  };
}

function makeInteractive(overrides?: Partial<InteractiveData>): InteractiveData {
  return {
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

async function writeArtifact(filename: string, interactive?: InteractiveData): Promise<string> {
  const path = join(artifactsDir, filename);
  const opts = {
    body: "<p>framing</p>",
    meta: makeMeta(),
    theme: defaultTheme(),
    themeCssHref: null as null,
    ...(interactive !== undefined ? { interactive } : {}),
  };
  const html = wrapDocument(opts);
  await atomicWrite(path, html);
  return path;
}

function baseUrl(): string {
  if (handle === null) throw new Error("server handle not initialized");
  return handle.url;
}

function answerUrl(qid = "q1", filename = FILENAME): string {
  return `${baseUrl()}/api/sessions/${PROJECT_SLUG}/${filename}/answers/${qid}`;
}

function stateUrl(filename = FILENAME): string {
  return `${baseUrl()}/api/sessions/${PROJECT_SLUG}/${filename}/state`;
}

async function postAnswer(qid: string, value: unknown, filename = FILENAME): Promise<Response> {
  return fetch(answerUrl(qid, filename), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ value }),
  });
}

// ─── POST /api/sessions/:projectSlug/:filename/answers/:questionId ────────────

describe("POST /api answers — happy path", () => {
  test("200 with correct JSON shape", async () => {
    await writeArtifact(FILENAME, makeInteractive());
    const res = await postAnswer("q1", { type: "pick_one", selected: "a" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body["ok"]).toBe(true);
    expect(body["status"]).toBe("complete");
    expect(Array.isArray(body["remaining"])).toBe(true);
    expect(typeof body["replacementHtml"]).toBe("string");
  });

  test("Content-Type is application/json", async () => {
    await writeArtifact(FILENAME, makeInteractive());
    const res = await postAnswer("q1", { type: "pick_one", selected: "a" });
    expect(res.headers.get("content-type")).toContain("application/json");
  });

  test("Cache-Control: no-store", async () => {
    await writeArtifact(FILENAME, makeInteractive());
    const res = await postAnswer("q1", { type: "pick_one", selected: "a" });
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
});

describe("POST /api answers — error cases", () => {
  test("malformed JSON body → 400", async () => {
    await writeArtifact(FILENAME, makeInteractive());
    const res = await fetch(answerUrl("q1"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{ not valid json }",
    });
    expect(res.status).toBe(400);
  });

  test("missing 'value' field → 400", async () => {
    await writeArtifact(FILENAME, makeInteractive());
    const res = await fetch(answerUrl("q1"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notValue: "foo" }),
    });
    expect(res.status).toBe(400);
  });

  test("non-existent artifact → 404", async () => {
    // No artifact written
    const res = await postAnswer("q1", { type: "pick_one", selected: "a" });
    expect(res.status).toBe(404);
  });

  test("session already complete → 410", async () => {
    await writeArtifact(FILENAME, makeInteractive({ status: "complete" }));
    const res = await postAnswer("q1", { type: "pick_one", selected: "a" });
    expect(res.status).toBe(410);
  });

  test("410 body contains status field", async () => {
    await writeArtifact(FILENAME, makeInteractive({ status: "complete" }));
    const res = await postAnswer("q1", { type: "pick_one", selected: "a" });
    const body = (await res.json()) as Record<string, unknown>;
    expect(body["status"]).toBeDefined();
  });

  test("invalid value (bad option id) → 422", async () => {
    await writeArtifact(FILENAME, makeInteractive());
    const res = await postAnswer("q1", { type: "pick_one", selected: "bad-option" });
    expect(res.status).toBe(422);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body["ok"]).toBe(false);
    expect(typeof body["message"]).toBe("string");
  });
});

// ─── GET /api/sessions/:projectSlug/:filename/state ───────────────────────────

describe("GET /api state", () => {
  test("200 with correct shape", async () => {
    await writeArtifact(FILENAME, makeInteractive());
    const res = await fetch(stateUrl());
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body["status"]).toBe("open");
    expect(typeof body["answers"]).toBe("object");
    expect(Array.isArray(body["remaining"])).toBe(true);
    expect((body["remaining"] as string[]).length).toBe(1);
  });

  test("missing artifact → 404", async () => {
    const res = await fetch(stateUrl());
    expect(res.status).toBe(404);
  });

  test("non-interactive artifact → 404", async () => {
    await writeArtifact(FILENAME); // no interactive
    const res = await fetch(stateUrl());
    expect(res.status).toBe(404);
  });
});

// ─── Security / path traversal ────────────────────────────────────────────────

describe("path traversal protection", () => {
  test("projectSlug containing .. (URL-encoded %2F) → 400", async () => {
    // Use %2F-encoded slash so Bun doesn't normalize the path before our handler.
    // This ends up with projectSlug = "..%2F..%2Fetc" (or similar) which our DANGEROUS_RE
    // catches. Alternatively Bun decodes this and splits segments differently — either
    // way the request should be rejected.
    const url = `${baseUrl()}/api/sessions/..%2F..%2Fetc/${FILENAME}/answers/q1`;
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: { type: "pick_one", selected: "a" } }),
    });
    // 400 if our guard catches it, 404 if URL normalization moves it out of /api/ pattern
    expect([400, 404]).toContain(r.status);
  });

  test("projectSlug with literal '..' segment → 400", async () => {
    // Construct URL where the projectSlug captured value contains ..
    // We'll do this by using a custom URL that our regex captures as ".."
    const url = `${baseUrl()}/api/sessions/../${FILENAME}/answers/q1`;
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: { type: "pick_one", selected: "a" } }),
    });
    // Bun normalizes /../ so the path resolves to /api/<filename>/answers/q1
    // which doesn't match our route → 404. Either 400 or 404 is fine.
    expect([400, 404]).toContain(r.status);
  });

  test("filename without .html → 400", async () => {
    const url = `${baseUrl()}/api/sessions/${PROJECT_SLUG}/passwd/answers/q1`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: { type: "pick_one", selected: "a" } }),
    });
    expect(res.status).toBe(400);
  });

  test("filename with path separator → 400", async () => {
    const url = `${baseUrl()}/api/sessions/${PROJECT_SLUG}/foo%2Fbar.html/answers/q1`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: { type: "pick_one", selected: "a" } }),
    });
    // URL decoded: foo/bar.html — the segment would split before it reaches the handler
    // depending on Bun URL parsing; either 400 or 404 is acceptable
    expect([400, 404]).toContain(res.status);
  });
});

// ─── Unrecognized /api/ path ──────────────────────────────────────────────────

describe("unrecognized /api/ path", () => {
  test("unknown route under /api/ → 404", async () => {
    const res = await fetch(`${baseUrl()}/api/unknown/path`);
    expect(res.status).toBe(404);
  });

  test("DELETE on an answer route → 404", async () => {
    const res = await fetch(answerUrl("q1"), { method: "DELETE" });
    expect(res.status).toBe(404);
  });
});
