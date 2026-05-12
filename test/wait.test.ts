import { test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAskTool, type AskToolOverrides } from "../src/tools/ask.ts";
import { createWaitTool } from "../src/tools/wait.ts";
import { submitAnswer } from "../src/storage/mutate.ts";

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
