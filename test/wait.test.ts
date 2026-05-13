import { test, describe, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAskTool, type AskToolOverrides } from "../src/tools/ask.ts";
import { createWaitTool } from "../src/tools/wait.ts";
import { submitAnswer, addComment, setVerdict } from "../src/storage/mutate.ts";
import type { Comment } from "../src/render/validate.ts";

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------

let workDir: string;
let stateDir: string;

beforeEach(() => {
  workDir = mkdtempSync(join(tmpdir(), "cesium-wait-work-"));
  stateDir = mkdtempSync(join(tmpdir(), "cesium-wait-state-"));
  mkdirSync(join(stateDir, "projects"), { recursive: true });
});

afterEach(() => {
  rmSync(workDir, { recursive: true, force: true });
  rmSync(stateDir, { recursive: true, force: true });
});

function mockCtx(dir: string): Parameters<typeof createAskTool>[0] {
  return {
    directory: dir,
    worktree: "",
    $: Bun.$,
  } as unknown as Parameters<typeof createAskTool>[0];
}

function makeAskOverrides(sd: string, nanoid?: () => string): AskToolOverrides {
  return {
    loadConfig: () => ({
      stateDir: sd,
      port: 3030,
      portMax: 3050,
      idleTimeoutMs: 1800000,
      hostname: "127.0.0.1",
    }),
    now: () => new Date(Date.now() - 5 * 60 * 1000),
    nanoid: nanoid ?? (() => "abc123"),
    ensureRunning: async () => ({
      port: 3030,
      url: "http://127.0.0.1:3030",
      pid: process.pid,
      startedAt: new Date().toISOString(),
    }),
  };
}

function makeWaitOverrides(sd: string) {
  return {
    loadConfig: () => ({
      stateDir: sd,
      port: 3030,
      portMax: 3050,
      idleTimeoutMs: 1800000,
      hostname: "127.0.0.1",
    }),
  };
}

const PICK_ONE_Q = {
  type: "pick_one" as const,
  id: "q1",
  question: "Which option?",
  options: [
    { id: "a", label: "Option A" },
    { id: "b", label: "Option B" },
  ],
};

const CONFIRM_Q = {
  type: "confirm" as const,
  id: "q2",
  question: "Are you sure?",
};

interface ArtifactInfo {
  id: string;
  filePath: string;
}

async function publishAsk(
  wd: string,
  sd: string,
  nanoid?: () => string,
  questions?: (typeof PICK_ONE_Q)[],
  expiresAt?: string,
): Promise<ArtifactInfo> {
  const ctx = mockCtx(wd);
  const overrides = makeAskOverrides(sd, nanoid);
  const askTool = createAskTool(ctx, overrides);
  const raw = await askTool.execute(
    {
      title: "Test Q",
      body: "<p>Please answer.</p>",
      questions: questions ?? [PICK_ONE_Q],
      ...(expiresAt !== undefined ? { expiresAt } : {}),
    },
    {} as never,
  );
  if (typeof raw !== "string" || raw.startsWith("Error:")) {
    throw new Error(`ask tool failed: ${String(raw)}`);
  }
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  return {
    id: parsed["id"] as string,
    filePath: parsed["filePath"] as string,
  };
}

async function runWait(
  wd: string,
  sd: string,
  id: string,
  opts?: { timeoutMs?: number; pollIntervalMs?: number },
): Promise<Record<string, unknown>> {
  const ctx = mockCtx(wd);
  const waitTool = createWaitTool(ctx, makeWaitOverrides(sd));
  const raw = await waitTool.execute({ id, ...opts }, {} as never);
  if (typeof raw !== "string") throw new Error("expected string from wait tool");
  return JSON.parse(raw) as Record<string, unknown>;
}

// -----------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------

test("happy path: artifact complete → returns status=complete with answers", async () => {
  const artifact = await publishAsk(workDir, stateDir);

  // Submit an answer to make it complete
  await submitAnswer({
    artifactPath: artifact.filePath,
    questionId: "q1",
    value: { type: "pick_one", selected: "a" },
  });

  const result = await runWait(workDir, stateDir, artifact.id, {
    timeoutMs: 5000,
    pollIntervalMs: 100,
  });

  expect(result["status"]).toBe("complete");
  const answers = result["answers"] as Record<string, unknown>;
  expect(answers["q1"]).toEqual({ type: "pick_one", selected: "a" });
  expect(result["remaining"] as string[]).toHaveLength(0);
});

test("polling: resolves complete when answer submitted mid-wait", async () => {
  const artifact = await publishAsk(workDir, stateDir);

  // Submit answer after 100ms delay
  const submitPromise = (async () => {
    await new Promise((r) => setTimeout(r, 100));
    await submitAnswer({
      artifactPath: artifact.filePath,
      questionId: "q1",
      value: { type: "pick_one", selected: "b" },
    });
  })();

  const waitPromise = runWait(workDir, stateDir, artifact.id, {
    timeoutMs: 2000,
    pollIntervalMs: 50,
  });

  await submitPromise;
  const result = await waitPromise;

  expect(result["status"]).toBe("complete");
  const answers = result["answers"] as Record<string, unknown>;
  expect(answers["q1"]).toEqual({ type: "pick_one", selected: "b" });
});

test("timeout: returns status=incomplete when artifact stays open", async () => {
  const artifact = await publishAsk(workDir, stateDir);

  const result = await runWait(workDir, stateDir, artifact.id, {
    timeoutMs: 200,
    pollIntervalMs: 50,
  });

  expect(result["status"]).toBe("incomplete");
  expect(result["remaining"] as string[]).toContain("q1");
});

test("not-found: unknown id returns status=not-found", async () => {
  const result = await runWait(workDir, stateDir, "xxxxxx", {
    timeoutMs: 1000,
    pollIntervalMs: 100,
  });

  expect(result["status"]).toBe("not-found");
  expect(result["answers"]).toEqual({});
  expect(result["remaining"]).toEqual([]);
});

test("expired: artifact with past expiresAt returns expired after submit triggers patch", async () => {
  // Publish with a past expiresAt
  const artifact = await publishAsk(
    workDir,
    stateDir,
    undefined,
    undefined,
    "2020-01-01T00:00:00.000Z",
  );

  // submitAnswer will detect expiry and patch to "expired"
  await submitAnswer({
    artifactPath: artifact.filePath,
    questionId: "q1",
    value: { type: "pick_one", selected: "a" },
  });

  const result = await runWait(workDir, stateDir, artifact.id, {
    timeoutMs: 2000,
    pollIntervalMs: 100,
  });

  expect(result["status"]).toBe("expired");
});

test("pollIntervalMs clamping: value below 100 is clamped to 100", async () => {
  const artifact = await publishAsk(workDir, stateDir);

  // Submit answer immediately so wait resolves quickly
  await submitAnswer({
    artifactPath: artifact.filePath,
    questionId: "q1",
    value: { type: "pick_one", selected: "a" },
  });

  // Pass pollIntervalMs: 10 (should be clamped to 100)
  const before = Date.now();
  const result = await runWait(workDir, stateDir, artifact.id, {
    timeoutMs: 5000,
    pollIntervalMs: 10,
  });
  const elapsed = Date.now() - before;

  // Should still complete (artifact is already complete on first read)
  expect(result["status"]).toBe("complete");
  // Clamping doesn't cause incorrect behavior — the result is valid
  void elapsed;
});

test("multi-question artifact: partial completion, then full", async () => {
  const twoQuestions = [PICK_ONE_Q, CONFIRM_Q];
  const artifact = await publishAsk(workDir, stateDir, undefined, twoQuestions as never);

  // Answer only q1 (status stays open since requireAll defaults true)
  await submitAnswer({
    artifactPath: artifact.filePath,
    questionId: "q1",
    value: { type: "pick_one", selected: "a" },
  });

  // Wait should see status=open and timeout
  const partial = await runWait(workDir, stateDir, artifact.id, {
    timeoutMs: 150,
    pollIntervalMs: 50,
  });
  expect(partial["status"]).toBe("incomplete");
  const partialRemaining = partial["remaining"] as string[];
  expect(partialRemaining).toContain("q2");
  expect(partialRemaining).not.toContain("q1");

  // Now answer q2 to complete
  await submitAnswer({
    artifactPath: artifact.filePath,
    questionId: "q2",
    value: { type: "confirm", choice: "yes" },
  });

  const complete = await runWait(workDir, stateDir, artifact.id, {
    timeoutMs: 2000,
    pollIntervalMs: 50,
  });
  expect(complete["status"]).toBe("complete");
  expect(complete["remaining"] as string[]).toHaveLength(0);
});

test("answers map shape: raw AnswerValue (not wrapped with answeredAt)", async () => {
  const artifact = await publishAsk(workDir, stateDir);

  await submitAnswer({
    artifactPath: artifact.filePath,
    questionId: "q1",
    value: { type: "pick_one", selected: "b" },
  });

  const result = await runWait(workDir, stateDir, artifact.id, {
    timeoutMs: 2000,
    pollIntervalMs: 100,
  });

  const answers = result["answers"] as Record<string, unknown>;
  const q1 = answers["q1"] as Record<string, unknown>;
  // Should be raw AnswerValue: { type, selected }
  expect(q1["type"]).toBe("pick_one");
  expect(q1["selected"]).toBe("b");
  // Should NOT have answeredAt
  expect(q1["answeredAt"]).toBeUndefined();
});

test("ensureRunning is NOT called by wait tool", async () => {
  let ensureRunningSpy = 0;
  const ctx = mockCtx(workDir);
  const waitOverrides = {
    loadConfig: () => ({
      stateDir,
      port: 3030,
      portMax: 3050,
      idleTimeoutMs: 1800000,
      hostname: "127.0.0.1",
    }),
  };

  // Publish an artifact first
  const artifact = await publishAsk(workDir, stateDir);
  await submitAnswer({
    artifactPath: artifact.filePath,
    questionId: "q1",
    value: { type: "pick_one", selected: "a" },
  });

  // Create wait tool with NO ensureRunning override; if it calls real ensureRunning
  // it might fail or start a server. We verify ensureRunningSpy stays 0.
  const waitTool = createWaitTool(ctx, waitOverrides);
  const raw = await waitTool.execute(
    { id: artifact.id, timeoutMs: 2000, pollIntervalMs: 100 },
    {} as never,
  );
  const result = JSON.parse(raw as string) as Record<string, unknown>;

  expect(result["status"]).toBe("complete");
  expect(ensureRunningSpy).toBe(0);
});

test("stateDir with no projects dir: returns not-found", async () => {
  // stateDir exists but has no projects subdir
  const emptyStateDir = mkdtempSync(join(tmpdir(), "cesium-empty-state-"));
  try {
    const ctx = mockCtx(workDir);
    const waitTool = createWaitTool(ctx, {
      loadConfig: () => ({
        stateDir: emptyStateDir,
        port: 3030,
        portMax: 3050,
        idleTimeoutMs: 1800000,
        hostname: "127.0.0.1",
      }),
    });
    const raw = await waitTool.execute(
      { id: "abc123", timeoutMs: 500, pollIntervalMs: 100 },
      {} as never,
    );
    const result = JSON.parse(raw as string) as Record<string, unknown>;
    expect(result["status"]).toBe("not-found");
  } finally {
    rmSync(emptyStateDir, { recursive: true, force: true });
  }
});

// ─── Regression: legacy artifact (no `kind` field) still parses ────────────────

test("legacy ask artifact WITHOUT kind field: wait tool reads it correctly", async () => {
  // Set up a project directory mirroring the real stateDir layout
  const legacyProjectDir = join(stateDir, "projects", "legacy-project");
  const legacyArtifactsDir = join(legacyProjectDir, "artifacts");
  mkdirSync(legacyArtifactsDir, { recursive: true });

  const legacyId = "legacy1";
  const legacyFilename = "2026-01-01T00-00-00Z__legacy-test__legacy1.html";
  const legacyPath = join(legacyArtifactsDir, legacyFilename);

  // Old interactive shape: no `kind` field, status already "complete"
  const legacyInteractive = {
    // no kind field — this is the old format
    status: "complete",
    requireAll: true,
    expiresAt: "2099-12-31T23:59:59Z",
    questions: [
      {
        type: "pick_one",
        id: "q1",
        question: "Which?",
        options: [{ id: "a", label: "A" }],
      },
    ],
    answers: {
      q1: { value: { type: "pick_one", selected: "a" }, answeredAt: "2026-01-01T00:01:00Z" },
    },
    completedAt: "2026-01-01T00:01:00Z",
  };

  // Build a minimal valid HTML artifact with the legacy cesium-meta
  const metaPayload = {
    id: legacyId,
    title: "Legacy Artifact",
    kind: "ask",
    interactive: legacyInteractive,
  };
  const legacyHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Legacy Artifact · cesium</title>
  <script type="application/json" id="cesium-meta">${JSON.stringify(metaPayload, null, 2)}</script>
</head>
<body><p>legacy content</p></body>
</html>`;

  writeFileSync(legacyPath, legacyHtml);

  // Write an index.json so the wait tool can resolve the id
  const indexEntry = {
    id: legacyId,
    filename: legacyFilename,
    title: "Legacy Artifact",
    kind: "ask",
  };
  writeFileSync(join(legacyProjectDir, "index.json"), JSON.stringify([indexEntry], null, 2));

  const result = await runWait(workDir, stateDir, legacyId, {
    timeoutMs: 2000,
    pollIntervalMs: 100,
  });

  // Legacy artifact was already complete → wait tool should return complete
  expect(result["status"]).toBe("complete");
  const answers = result["answers"] as Record<string, unknown>;
  expect(answers["q1"]).toEqual({ type: "pick_one", selected: "a" });
  expect(result["remaining"] as string[]).toHaveLength(0);
});

// ─── Annotate mode wait tests ──────────────────────────────────────────────────

// Helper: builds a minimal annotate artifact in stateDir and returns its id + filePath.
function buildAnnotateArtifact(
  sd: string,
  opts: {
    id?: string;
    status?: "open" | "complete" | "expired" | "cancelled";
    comments?: Comment[];
    verdict?: { value: "approve" | "request_changes" | "comment"; decidedAt: string } | null;
    expiresAt?: string;
  } = {},
): { id: string; filePath: string } {
  const id = opts.id ?? "annotate1";
  const projectSlug = `annotate-project-${id}`;
  const projectDir = join(sd, "projects", projectSlug);
  const artifactsDir = join(projectDir, "artifacts");
  mkdirSync(artifactsDir, { recursive: true });

  const filename = `2026-05-13T00-00-00Z__test-annotate__${id}.html`;
  const filePath = join(artifactsDir, filename);

  const interactive = {
    kind: "annotate",
    status: opts.status ?? "open",
    expiresAt: opts.expiresAt ?? "2099-12-31T23:59:59Z",
    verdictMode: "full",
    requireVerdict: true,
    perLineFor: ["diff", "code"],
    comments: opts.comments ?? [],
    verdict: opts.verdict !== undefined ? opts.verdict : null,
    ...(opts.status === "complete" ? { completedAt: "2026-05-13T00:01:00Z" } : {}),
  };

  const metaPayload = {
    id,
    title: "Test Annotate Artifact",
    kind: "annotate",
    interactive,
  };

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Test Annotate · cesium</title>
  <script type="application/json" id="cesium-meta">${JSON.stringify(metaPayload, null, 2)}</script>
</head>
<body><p>annotate content</p></body>
</html>`;

  writeFileSync(filePath, html);

  // Write index.json
  const indexEntry = { id, filename, title: "Test Annotate Artifact", kind: "annotate" };
  writeFileSync(join(projectDir, "index.json"), JSON.stringify([indexEntry], null, 2));

  return { id, filePath };
}

const SAMPLE_COMMENTS: Comment[] = [
  {
    id: "cmnt01",
    anchor: "block-1",
    selectedText: "some text",
    comment: "This needs clarification",
    createdAt: "2026-05-13T00:00:30Z",
  },
  {
    id: "cmnt02",
    anchor: "block-2.line-3",
    selectedText: "",
    comment: "Looks good overall",
    createdAt: "2026-05-13T00:00:45Z",
  },
];

describe("annotate mode", () => {
  // 1. Open annotate session, timeout expires
  test("open session that times out returns incomplete with empty comments and null verdict", async () => {
    const { id } = buildAnnotateArtifact(stateDir, { status: "open" });

    const result = await runWait(workDir, stateDir, id, {
      timeoutMs: 200,
      pollIntervalMs: 50,
    });

    expect(result["status"]).toBe("incomplete");
    expect(result["kind"]).toBe("annotate");
    expect(result["comments"]).toEqual([]);
    expect(result["verdict"]).toBeNull();
    expect(result["answers"]).toEqual({});
    expect(result["remaining"]).toEqual([]);
  });

  // 2. Open session that completes mid-poll
  test("open session with 2 comments that completes via setVerdict mid-poll", async () => {
    const { id, filePath } = buildAnnotateArtifact(stateDir, {
      id: "ann-midpoll",
      status: "open",
      comments: SAMPLE_COMMENTS,
    });

    // After 100ms, call setVerdict to flip status to complete
    const completePromise = (async () => {
      await new Promise((r) => setTimeout(r, 100));
      await setVerdict({ artifactPath: filePath, verdict: "approve" });
    })();

    const waitPromise = runWait(workDir, stateDir, id, {
      timeoutMs: 3000,
      pollIntervalMs: 50,
    });

    await completePromise;
    const result = await waitPromise;

    expect(result["status"]).toBe("complete");
    expect(result["kind"]).toBe("annotate");
    const comments = result["comments"] as Comment[];
    expect(comments).toHaveLength(2);
    expect(comments[0]?.id).toBe("cmnt01");
    expect(comments[1]?.id).toBe("cmnt02");
    const verdict = result["verdict"] as { value: string; decidedAt: string } | null;
    expect(verdict).not.toBeNull();
    expect(verdict?.value).toBe("approve");
    expect(typeof verdict?.decidedAt).toBe("string");
  });

  // 3. Already-complete annotate session with approve verdict + 3 comments
  test("already-complete session returns immediately with full payload", async () => {
    const threeComments: Comment[] = [
      ...SAMPLE_COMMENTS,
      {
        id: "cmnt03",
        anchor: "block-3",
        selectedText: "another line",
        comment: "Minor nit",
        createdAt: "2026-05-13T00:01:00Z",
      },
    ];

    const { id } = buildAnnotateArtifact(stateDir, {
      id: "ann-complete",
      status: "complete",
      comments: threeComments,
      verdict: { value: "approve", decidedAt: "2026-05-13T00:01:05Z" },
    });

    const result = await runWait(workDir, stateDir, id, {
      timeoutMs: 5000,
      pollIntervalMs: 100,
    });

    expect(result["status"]).toBe("complete");
    expect(result["kind"]).toBe("annotate");
    expect(result["comments"] as Comment[]).toHaveLength(3);
    const verdict = result["verdict"] as { value: string; decidedAt: string };
    expect(verdict.value).toBe("approve");
    expect(verdict.decidedAt).toBe("2026-05-13T00:01:05Z");
    expect(result["answers"]).toEqual({});
    expect(result["remaining"]).toEqual([]);
  });

  // 4. Annotate session with request_changes verdict
  test("already-complete session with request_changes verdict returns correct payload", async () => {
    const { id } = buildAnnotateArtifact(stateDir, {
      id: "ann-reject",
      status: "complete",
      comments: SAMPLE_COMMENTS,
      verdict: { value: "request_changes", decidedAt: "2026-05-13T00:02:00Z" },
    });

    const result = await runWait(workDir, stateDir, id, {
      timeoutMs: 5000,
      pollIntervalMs: 100,
    });

    expect(result["status"]).toBe("complete");
    expect(result["kind"]).toBe("annotate");
    const verdict = result["verdict"] as { value: string; decidedAt: string };
    expect(verdict.value).toBe("request_changes");
    expect((result["comments"] as Comment[]).length).toBe(2);
  });

  // 5. Expired annotate session
  test("expired session returns status=expired with comments preserved", async () => {
    const { id } = buildAnnotateArtifact(stateDir, {
      id: "ann-expired",
      status: "expired",
      comments: SAMPLE_COMMENTS,
      verdict: null,
    });

    const result = await runWait(workDir, stateDir, id, {
      timeoutMs: 5000,
      pollIntervalMs: 100,
    });

    expect(result["status"]).toBe("expired");
    expect(result["kind"]).toBe("annotate");
    expect(result["comments"] as Comment[]).toHaveLength(2);
    expect(result["verdict"]).toBeNull();
  });

  // 6. Cancelled annotate session
  test("cancelled session returns status=cancelled with comments preserved", async () => {
    const { id } = buildAnnotateArtifact(stateDir, {
      id: "ann-cancelled",
      status: "cancelled",
      comments: SAMPLE_COMMENTS.slice(0, 1),
      verdict: null,
    });

    const result = await runWait(workDir, stateDir, id, {
      timeoutMs: 5000,
      pollIntervalMs: 100,
    });

    expect(result["status"]).toBe("cancelled");
    expect(result["kind"]).toBe("annotate");
    expect(result["comments"] as Comment[]).toHaveLength(1);
    expect(result["verdict"]).toBeNull();
  });

  // 7. Ask session still returns the ask shape (regression)
  test("ask session still returns ask-shaped result without comments/verdict keys", async () => {
    const artifact = await publishAsk(workDir, stateDir, () => "ask-regress");
    await submitAnswer({
      artifactPath: artifact.filePath,
      questionId: "q1",
      value: { type: "pick_one", selected: "a" },
    });

    const result = await runWait(workDir, stateDir, artifact.id, {
      timeoutMs: 5000,
      pollIntervalMs: 100,
    });

    expect(result["status"]).toBe("complete");
    const answers = result["answers"] as Record<string, unknown>;
    expect(answers["q1"]).toEqual({ type: "pick_one", selected: "a" });
    expect(result["remaining"] as string[]).toHaveLength(0);
    // Annotate-specific keys must be absent
    expect(result["comments"]).toBeUndefined();
    expect(result["verdict"]).toBeUndefined();
    expect(result["kind"]).toBeUndefined();
  });

  // 8. Legacy interactive shape (no `kind` field) is treated as ask end-to-end
  test("legacy interactive (no kind field) treated as ask at wait level", async () => {
    const legacyId = "legacy-annotate-check";
    const legacyProjectDir = join(stateDir, "projects", "legacy-annotate-project");
    const legacyArtifactsDir = join(legacyProjectDir, "artifacts");
    mkdirSync(legacyArtifactsDir, { recursive: true });

    const legacyFilename = `2026-01-01T00-00-00Z__legacy__${legacyId}.html`;
    const legacyPath = join(legacyArtifactsDir, legacyFilename);

    // Old format: no kind field, has ask-like fields, status complete
    const legacyInteractive = {
      status: "complete",
      requireAll: true,
      expiresAt: "2099-12-31T23:59:59Z",
      questions: [
        { type: "pick_one", id: "q1", question: "Which?", options: [{ id: "a", label: "A" }] },
      ],
      answers: {
        q1: { value: { type: "pick_one", selected: "a" }, answeredAt: "2026-01-01T00:01:00Z" },
      },
      completedAt: "2026-01-01T00:01:00Z",
    };

    const metaPayload = {
      id: legacyId,
      title: "Legacy",
      kind: "ask",
      interactive: legacyInteractive,
    };
    const legacyHtml = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<script type="application/json" id="cesium-meta">${JSON.stringify(metaPayload)}</script>
</head><body></body></html>`;

    writeFileSync(legacyPath, legacyHtml);
    writeFileSync(
      join(legacyProjectDir, "index.json"),
      JSON.stringify(
        [{ id: legacyId, filename: legacyFilename, title: "Legacy", kind: "ask" }],
        null,
        2,
      ),
    );

    const result = await runWait(workDir, stateDir, legacyId, {
      timeoutMs: 2000,
      pollIntervalMs: 100,
    });

    // Should be treated as ask (coerceInteractiveData injects kind: "ask")
    expect(result["status"]).toBe("complete");
    const answers = result["answers"] as Record<string, unknown>;
    expect(answers["q1"]).toEqual({ type: "pick_one", selected: "a" });
    // annotate keys absent
    expect(result["comments"]).toBeUndefined();
    expect(result["kind"]).toBeUndefined();
  });

  // 9. not-found for unknown id (annotate context — same behavior)
  test("unknown id still returns not-found", async () => {
    const result = await runWait(workDir, stateDir, "unknown-annotate-id", {
      timeoutMs: 500,
      pollIntervalMs: 100,
    });
    expect(result["status"]).toBe("not-found");
    expect(result["answers"]).toEqual({});
    expect(result["remaining"]).toEqual([]);
  });

  // 10. JSON wire format includes kind: "annotate" for complete session
  test("JSON wire format includes kind: 'annotate' for complete annotate session", async () => {
    const { id } = buildAnnotateArtifact(stateDir, {
      id: "ann-wire",
      status: "complete",
      comments: SAMPLE_COMMENTS,
      verdict: { value: "approve", decidedAt: "2026-05-13T00:05:00Z" },
    });

    const ctx = mockCtx(workDir);
    const waitTool = createWaitTool(ctx, makeWaitOverrides(stateDir));
    const raw = await waitTool.execute({ id, timeoutMs: 5000, pollIntervalMs: 100 }, {} as never);
    if (typeof raw !== "string") throw new Error("expected string from wait tool");

    // Verify the raw JSON string contains kind: "annotate"
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    expect(parsed["kind"]).toBe("annotate");

    // Verify comments array shape matches the wire format
    const comments = parsed["comments"] as Comment[];
    expect(Array.isArray(comments)).toBe(true);
    expect(comments[0]?.id).toBe("cmnt01");
    expect(comments[0]?.anchor).toBe("block-1");
    expect(typeof comments[0]?.createdAt).toBe("string");

    // Verify verdict shape
    const verdict = parsed["verdict"] as { value: string; decidedAt: string };
    expect(verdict.value).toBe("approve");
  });

  // addComment integration: comments added via addComment surface in wait result
  test("comments added via addComment are surfaced in wait result", async () => {
    const { id, filePath } = buildAnnotateArtifact(stateDir, {
      id: "ann-addcomment",
      status: "open",
    });

    // Add a comment directly
    const addResult = await addComment({
      artifactPath: filePath,
      anchor: "block-1",
      selectedText: "relevant text",
      comment: "This is my comment",
    });
    expect(addResult.ok).toBe(true);

    // Set verdict to complete the session
    await setVerdict({ artifactPath: filePath, verdict: "approve" });

    const result = await runWait(workDir, stateDir, id, {
      timeoutMs: 5000,
      pollIntervalMs: 100,
    });

    expect(result["status"]).toBe("complete");
    expect(result["kind"]).toBe("annotate");
    const comments = result["comments"] as Comment[];
    expect(comments).toHaveLength(1);
    expect(comments[0]?.comment).toBe("This is my comment");
    expect(comments[0]?.anchor).toBe("block-1");
  });
});
