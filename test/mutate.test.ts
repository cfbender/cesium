import { test, expect, beforeEach, afterEach, describe } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { submitAnswer, getState } from "../src/storage/mutate.ts";
import { atomicWrite } from "../src/storage/write.ts";
import { wrapDocument, type ArtifactMeta } from "../src/render/wrap.ts";
import { defaultTheme } from "../src/render/theme.ts";
import type { InteractiveData } from "../src/render/validate.ts";

// ─── Helpers ──────────────────────────────────────────────────────────────────

let tmpDir: string;
let artifactsDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "cesium-mutate-"));
  artifactsDir = join(tmpDir, "projects", "test-project", "artifacts");
  mkdirSync(artifactsDir, { recursive: true });
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
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
    projectSlug: "test-project",
    projectName: "Test",
    cwd: "/tmp/test",
    worktree: null,
    gitBranch: null,
    gitCommit: null,
    supersedes: null,
    supersededBy: null,
    contentSha256: "deadbeef",
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

async function writeArtifact(filename: string, interactive: InteractiveData): Promise<string> {
  const path = join(artifactsDir, filename);
  const html = wrapDocument({
    body: "<p>framing</p>",
    meta: makeMeta(),
    theme: defaultTheme(),
    interactive,
    themeCssHref: null,
  });
  await atomicWrite(path, html);
  return path;
}

// ─── submitAnswer — single question, complete on answer ───────────────────────

describe("submitAnswer — single question complete", () => {
  test("valid answer: ok: true, status: complete, file updated", async () => {
    const path = await writeArtifact("artifact.html", makeInteractive());

    const outcome = await submitAnswer({
      artifactPath: path,
      questionId: "q1",
      value: { type: "pick_one", selected: "a" },
    });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) throw new Error("expected ok");
    expect(outcome.status).toBe("complete");
    expect(outcome.remaining).toHaveLength(0);
    expect(outcome.replacementHtml).toContain("cs-answered");
    expect(outcome.replacementHtml).toContain("YOU ANSWERED");
  });

  test("disk file has cs-answered section after answer", async () => {
    const path = await writeArtifact("artifact.html", makeInteractive());
    await submitAnswer({
      artifactPath: path,
      questionId: "q1",
      value: { type: "pick_one", selected: "a" },
    });

    const diskHtml = await Bun.file(path).text();
    expect(diskHtml).toContain('class="cs-answered"');
    expect(diskHtml).not.toContain('class="cs-control-pick_one"');
  });

  test("cesium-meta on disk has interactive.status: complete", async () => {
    const path = await writeArtifact("artifact.html", makeInteractive());
    await submitAnswer({
      artifactPath: path,
      questionId: "q1",
      value: { type: "pick_one", selected: "a" },
    });

    const diskHtml = await Bun.file(path).text();
    const metaMatch =
      /<script\s[^>]*type="application\/json"[^>]*id="cesium-meta"[^>]*>([\s\S]*?)<\/script>/i.exec(
        diskHtml,
      );
    expect(metaMatch).not.toBeNull();
    const meta = JSON.parse(metaMatch![1]!) as Record<string, unknown>;
    const interactive = meta["interactive"] as Record<string, unknown>;
    expect(interactive["status"]).toBe("complete");
    expect(interactive["completedAt"]).toBeDefined();
  });

  test("client <script data-cesium-client> is removed when complete", async () => {
    const path = await writeArtifact("artifact.html", makeInteractive());

    const beforeHtml = await Bun.file(path).text();
    expect(beforeHtml).toContain("data-cesium-client");

    await submitAnswer({
      artifactPath: path,
      questionId: "q1",
      value: { type: "pick_one", selected: "b" },
    });

    const afterHtml = await Bun.file(path).text();
    expect(afterHtml).not.toContain("data-cesium-client");
  });
});

// ─── Helper factories for describe blocks ────────────────────────────────────

function makeThreeQuestions(): InteractiveData {
  return {
    status: "open",
    requireAll: true,
    expiresAt: "2099-12-31T23:59:59Z",
    questions: [
      {
        type: "pick_one",
        id: "q1",
        question: "Q1?",
        options: [{ id: "a", label: "A" }],
      },
      { type: "confirm", id: "q2", question: "Q2?" },
      { type: "ask_text", id: "q3", question: "Q3?" },
    ],
    answers: {},
  };
}

function makePickMany(min?: number, max?: number): InteractiveData {
  return {
    status: "open",
    requireAll: true,
    expiresAt: "2099-12-31T23:59:59Z",
    questions: [
      {
        type: "pick_many",
        id: "pm",
        question: "Pick some",
        options: [
          { id: "x", label: "X" },
          { id: "y", label: "Y" },
          { id: "z", label: "Z" },
        ],
        ...(min !== undefined ? { min } : {}),
        ...(max !== undefined ? { max } : {}),
      },
    ],
    answers: {},
  };
}

function makeSlider(): InteractiveData {
  return {
    status: "open",
    requireAll: true,
    expiresAt: "2099-12-31T23:59:59Z",
    questions: [{ type: "slider", id: "sl", question: "Rate it", min: 0, max: 10, step: 1 }],
    answers: {},
  };
}

// ─── submitAnswer — multi-question, partial completion ────────────────────────

describe("submitAnswer — multi-question partial", () => {
  test("answer one of three: status open, remaining has 2", async () => {
    const path = await writeArtifact("artifact.html", makeThreeQuestions());
    const outcome = await submitAnswer({
      artifactPath: path,
      questionId: "q1",
      value: { type: "pick_one", selected: "a" },
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) throw new Error();
    expect(outcome.status).toBe("open");
    expect(outcome.remaining).toHaveLength(2);
    expect(outcome.remaining).toContain("q2");
    expect(outcome.remaining).toContain("q3");
  });

  test("client script still present when not complete", async () => {
    const path = await writeArtifact("artifact.html", makeThreeQuestions());
    await submitAnswer({
      artifactPath: path,
      questionId: "q1",
      value: { type: "pick_one", selected: "a" },
    });
    const diskHtml = await Bun.file(path).text();
    expect(diskHtml).toContain("data-cesium-client");
  });
});

// ─── submitAnswer — validation failures ──────────────────────────────────────

describe("submitAnswer — invalid value", () => {
  test("pick_one: selected not in options → invalid-value", async () => {
    const path = await writeArtifact("artifact.html", makeInteractive());
    const outcome = await submitAnswer({
      artifactPath: path,
      questionId: "q1",
      value: { type: "pick_one", selected: "nonexistent" },
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error();
    expect(outcome.reason).toBe("invalid-value");
  });

  test("unknown question id → unknown-question", async () => {
    const path = await writeArtifact("artifact.html", makeInteractive());
    const outcome = await submitAnswer({
      artifactPath: path,
      questionId: "does-not-exist",
      value: { type: "pick_one", selected: "a" },
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error();
    expect(outcome.reason).toBe("unknown-question");
    if (outcome.reason !== "unknown-question") throw new Error();
    expect(outcome.questionId).toBe("does-not-exist");
  });
});

// ─── submitAnswer — error outcomes ────────────────────────────────────────────

describe("submitAnswer — error outcomes", () => {
  test("artifact missing → not-found", async () => {
    const outcome = await submitAnswer({
      artifactPath: join(artifactsDir, "does-not-exist.html"),
      questionId: "q1",
      value: { type: "pick_one", selected: "a" },
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error();
    expect(outcome.reason).toBe("not-found");
  });

  test("artifact without interactive → not-interactive", async () => {
    const path = join(artifactsDir, "no-interactive.html");
    const html = wrapDocument({
      body: "<p>no interactive</p>",
      meta: makeMeta(),
      theme: defaultTheme(),
      themeCssHref: null,
    });
    await atomicWrite(path, html);

    const outcome = await submitAnswer({
      artifactPath: path,
      questionId: "q1",
      value: { type: "pick_one", selected: "a" },
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error();
    expect(outcome.reason).toBe("not-interactive");
  });

  test("session already complete → session-ended", async () => {
    const interactive = makeInteractive({ status: "complete" });
    const path = await writeArtifact("artifact.html", interactive);

    const outcome = await submitAnswer({
      artifactPath: path,
      questionId: "q1",
      value: { type: "pick_one", selected: "a" },
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error();
    expect(outcome.reason).toBe("session-ended");
  });

  test("session expired → session-ended with expired status", async () => {
    const interactive = makeInteractive({ status: "expired" });
    const path = await writeArtifact("artifact.html", interactive);

    const outcome = await submitAnswer({
      artifactPath: path,
      questionId: "q1",
      value: { type: "pick_one", selected: "a" },
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error();
    expect(outcome.reason).toBe("session-ended");
  });

  test("expiresAt in the past: returns expired, patches disk", async () => {
    const interactive = makeInteractive({ expiresAt: "2000-01-01T00:00:00Z" });
    const path = await writeArtifact("artifact.html", interactive);

    const outcome = await submitAnswer({
      artifactPath: path,
      questionId: "q1",
      value: { type: "pick_one", selected: "a" },
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error();
    expect(outcome.reason).toBe("expired");

    // Disk status should be patched to expired
    const diskHtml = await Bun.file(path).text();
    const metaMatch =
      /<script\s[^>]*type="application\/json"[^>]*id="cesium-meta"[^>]*>([\s\S]*?)<\/script>/i.exec(
        diskHtml,
      );
    const meta = JSON.parse(metaMatch![1]!) as Record<string, unknown>;
    const embeddedInteractive = meta["interactive"] as Record<string, unknown>;
    expect(embeddedInteractive["status"]).toBe("expired");
  });
});

// ─── submitAnswer — pick_many min/max enforcement ─────────────────────────────

describe("submitAnswer — pick_many", () => {
  test("valid pick_many selection: ok", async () => {
    const path = await writeArtifact("artifact.html", makePickMany(1, 2));
    const outcome = await submitAnswer({
      artifactPath: path,
      questionId: "pm",
      value: { type: "pick_many", selected: ["x", "y"] },
    });
    expect(outcome.ok).toBe(true);
  });

  test("selected below min → invalid-value", async () => {
    const path = await writeArtifact("artifact.html", makePickMany(2, 3));
    const outcome = await submitAnswer({
      artifactPath: path,
      questionId: "pm",
      value: { type: "pick_many", selected: ["x"] },
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error();
    expect(outcome.reason).toBe("invalid-value");
  });

  test("selected above max → invalid-value", async () => {
    const path = await writeArtifact("artifact.html", makePickMany(1, 2));
    const outcome = await submitAnswer({
      artifactPath: path,
      questionId: "pm",
      value: { type: "pick_many", selected: ["x", "y", "z"] },
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error();
    expect(outcome.reason).toBe("invalid-value");
  });

  test("invalid option id in selected → invalid-value", async () => {
    const path = await writeArtifact("artifact.html", makePickMany());
    const outcome = await submitAnswer({
      artifactPath: path,
      questionId: "pm",
      value: { type: "pick_many", selected: ["badid"] },
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error();
    expect(outcome.reason).toBe("invalid-value");
  });
});

// ─── submitAnswer — slider ────────────────────────────────────────────────────

describe("submitAnswer — slider", () => {
  test("valid slider value: ok", async () => {
    const path = await writeArtifact("artifact.html", makeSlider());
    const outcome = await submitAnswer({
      artifactPath: path,
      questionId: "sl",
      value: { type: "slider", value: 5 },
    });
    expect(outcome.ok).toBe(true);
  });

  test("value below min → invalid-value", async () => {
    const path = await writeArtifact("artifact.html", makeSlider());
    const outcome = await submitAnswer({
      artifactPath: path,
      questionId: "sl",
      value: { type: "slider", value: -1 },
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error();
    expect(outcome.reason).toBe("invalid-value");
  });

  test("value above max → invalid-value", async () => {
    const path = await writeArtifact("artifact.html", makeSlider());
    const outcome = await submitAnswer({
      artifactPath: path,
      questionId: "sl",
      value: { type: "slider", value: 11 },
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error();
    expect(outcome.reason).toBe("invalid-value");
  });
});

// ─── submitAnswer — requireAll: false ─────────────────────────────────────────

describe("submitAnswer — requireAll: false", () => {
  test("first answer flips status to complete (MVP rule)", async () => {
    const interactive = makeInteractive({ requireAll: false });
    const path = await writeArtifact("artifact.html", interactive);

    const outcome = await submitAnswer({
      artifactPath: path,
      questionId: "q1",
      value: { type: "pick_one", selected: "a" },
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) throw new Error();
    expect(outcome.status).toBe("complete");
  });
});

// ─── submitAnswer — concurrency (same artifact, parallel calls) ──────────────

describe("submitAnswer — concurrency", () => {
  test("two parallel submitAnswers on different questions both succeed without data loss", async () => {
    const interactive: InteractiveData = {
      status: "open",
      requireAll: true,
      expiresAt: "2099-12-31T23:59:59Z",
      questions: [
        {
          type: "pick_one",
          id: "q1",
          question: "Q1?",
          options: [{ id: "a", label: "A" }],
        },
        { type: "confirm", id: "q2", question: "Q2?" },
      ],
      answers: {},
    };
    const path = await writeArtifact("artifact.html", interactive);

    // Both should succeed (one will acquire lock first, then the other)
    const [r1, r2] = await Promise.all([
      submitAnswer({
        artifactPath: path,
        questionId: "q1",
        value: { type: "pick_one", selected: "a" },
      }),
      submitAnswer({
        artifactPath: path,
        questionId: "q2",
        value: { type: "confirm", choice: "yes" },
      }),
    ]);

    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);

    // Final disk state should have both answers
    const diskHtml = await Bun.file(path).text();
    const metaMatch =
      /<script\s[^>]*type="application\/json"[^>]*id="cesium-meta"[^>]*>([\s\S]*?)<\/script>/i.exec(
        diskHtml,
      );
    const meta = JSON.parse(metaMatch![1]!) as Record<string, unknown>;
    const embeddedInteractive = meta["interactive"] as Record<string, unknown>;
    const answers = embeddedInteractive["answers"] as Record<string, unknown>;
    expect(Object.keys(answers)).toHaveLength(2);
    expect("q1" in answers).toBe(true);
    expect("q2" in answers).toBe(true);
  });
});

// ─── getState ─────────────────────────────────────────────────────────────────

describe("getState", () => {
  test("interactive artifact: returns status, answers, remaining", async () => {
    const path = await writeArtifact("artifact.html", makeInteractive());
    const outcome = await getState(path);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) throw new Error();
    expect(outcome.status).toBe("open");
    expect(outcome.answers).toEqual({});
    expect(outcome.remaining).toEqual(["q1"]);
  });

  test("after submitting an answer, getState reflects it", async () => {
    const path = await writeArtifact("artifact.html", makeInteractive());
    await submitAnswer({
      artifactPath: path,
      questionId: "q1",
      value: { type: "pick_one", selected: "a" },
    });

    const outcome = await getState(path);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) throw new Error();
    expect(outcome.status).toBe("complete");
    expect(outcome.answers["q1"]).toBeDefined();
    expect(outcome.remaining).toHaveLength(0);
  });

  test("missing artifact → not-found", async () => {
    const outcome = await getState(join(artifactsDir, "missing.html"));
    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error();
    expect(outcome.reason).toBe("not-found");
  });

  test("non-interactive artifact → not-interactive", async () => {
    const path = join(artifactsDir, "plain.html");
    const html = wrapDocument({
      body: "<p>hi</p>",
      meta: makeMeta(),
      theme: defaultTheme(),
      themeCssHref: null,
    });
    await atomicWrite(path, html);

    const outcome = await getState(path);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error();
    expect(outcome.reason).toBe("not-interactive");
  });
});
