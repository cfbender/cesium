// Tool handler for cesium_wait — polls an interactive artifact until complete or timeout.

import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { tool } from "@opencode-ai/plugin";
import type { PluginInput } from "@opencode-ai/plugin";
import { loadConfig, type CesiumConfig } from "../config.ts";
import { loadIndex } from "../storage/index-cache.ts";
import type {
  AnswerValue,
  Comment,
  Verdict,
  InteractiveAskData,
  InteractiveAnnotateData,
} from "../render/validate.ts";
import { coerceInteractiveData } from "../render/validate.ts";
import { readEmbeddedMetadata } from "../storage/write.ts";
import { readFile } from "node:fs/promises";

export interface WaitToolOverrides {
  loadConfig?: () => CesiumConfig;
}

export type WaitStatus = "complete" | "incomplete" | "expired" | "cancelled" | "not-found";

const TOOL_DESCRIPTION = `cesium_wait — Block until the user completes a cesium_ask or cesium_annotate interactive artifact, or until timeout.

Pass the id returned from cesium_ask or cesium_annotate. Default timeout is 10 minutes. Polls the artifact file every 500ms (no server-side coordination needed — disk is the source of truth).

For cesium_ask sessions, returns { status, answers, remaining } where answers is a map keyed by question id. For cesium_annotate sessions, additionally returns { status, comments, verdict, kind: "annotate" } where comments is an array of { id, anchor, selectedText, comment, createdAt } and verdict is { value: "approve" | "request_changes" | "comment", decidedAt } or null if the user hasn't decided yet.

Use this immediately after cesium_ask or cesium_annotate when you need the user's input to continue. If the user doesn't finish within the timeout, you'll get status: "incomplete" with whatever they've done so far — handle that case (re-prompt, give up, or publish a partial artifact).`;

export function createWaitTool(
  _ctx: PluginInput,
  overrides?: WaitToolOverrides,
): ReturnType<typeof tool> {
  const resolveConfig = overrides?.loadConfig ?? loadConfig;

  return tool({
    description: TOOL_DESCRIPTION,
    args: {
      id: tool.schema.string(),
      timeoutMs: tool.schema.number().optional(),
      pollIntervalMs: tool.schema.number().optional(),
    },
    async execute(args, _context) {
      const config = resolveConfig();
      const { id } = args;
      const timeoutMs = typeof args.timeoutMs === "number" ? args.timeoutMs : 600_000;
      const pollIntervalMs = Math.max(
        100,
        typeof args.pollIntervalMs === "number" ? args.pollIntervalMs : 500,
      );

      // Resolve id → artifactPath by scanning project index.json files
      const artifactPath = await resolveArtifactPath(config.stateDir, id);

      if (artifactPath === null) {
        const result = {
          status: "not-found" as WaitStatus,
          answers: {},
          remaining: [] as string[],
        };
        return JSON.stringify(result, null, 2);
      }

      // Poll until complete, expired, cancelled, or timeout
      const startTime = Date.now();

      const pollResult = await pollLoop(artifactPath, timeoutMs, pollIntervalMs, startTime);
      return JSON.stringify(pollResult, null, 2);
    },
  });
}

// ─── Artifact path resolution ──────────────────────────────────────────────────

async function resolveArtifactPath(stateDir: string, id: string): Promise<string | null> {
  const projectsDir = join(stateDir, "projects");

  let projectDirs: string[];
  try {
    projectDirs = await readdir(projectsDir);
  } catch {
    return null;
  }

  for (const projectSlug of projectDirs) {
    const indexPath = join(projectsDir, projectSlug, "index.json");
    let entries;
    try {
      // eslint-disable-next-line no-await-in-loop -- short-circuit on first project containing the id
      entries = await loadIndex(indexPath);
    } catch {
      continue;
    }
    const entry = entries.find((e) => e.id === id);
    if (entry !== undefined) {
      return join(projectsDir, projectSlug, "artifacts", entry.filename);
    }
  }

  return null;
}

// ─── Poll loop (recursive to satisfy no-await-in-loop) ────────────────────────

interface PollResult {
  status: WaitStatus;
  // Ask-mode fields (empty for annotate)
  answers: Record<string, AnswerValue>;
  remaining: string[];
  // Annotate-mode fields (omitted/empty for ask)
  comments?: Comment[];
  verdict?: { value: Verdict; decidedAt: string } | null;
  kind?: "ask" | "annotate";
}

async function pollLoop(
  artifactPath: string,
  timeoutMs: number,
  pollIntervalMs: number,
  startTime: number,
): Promise<PollResult> {
  // Read the artifact HTML
  let html: string;
  try {
    html = await readFile(artifactPath, "utf8");
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === "ENOENT") {
      return { status: "not-found", answers: {}, remaining: [] };
    }
    throw err;
  }

  const meta = readEmbeddedMetadata(html);
  const interactive = coerceInteractiveData(meta === null ? null : meta["interactive"]);
  if (interactive === null) {
    return { status: "not-found", answers: {}, remaining: [] };
  }

  if (interactive.kind === "ask") {
    return pollAsk(interactive, artifactPath, timeoutMs, pollIntervalMs, startTime);
  }

  // kind === "annotate"
  return buildAnnotateResult(interactive, artifactPath, timeoutMs, pollIntervalMs, startTime);
}

async function pollAsk(
  interactive: InteractiveAskData,
  artifactPath: string,
  timeoutMs: number,
  pollIntervalMs: number,
  startTime: number,
): Promise<PollResult> {
  const answers = extractAnswers(interactive);
  const remaining = interactive.questions
    .map((q) => q.id)
    .filter((qid) => interactive.answers[qid] === undefined);

  switch (interactive.status) {
    case "complete":
      return { status: "complete", answers, remaining };
    case "expired":
      return { status: "expired", answers, remaining };
    case "cancelled":
      return { status: "cancelled", answers, remaining };
    case "open":
      break;
  }

  // Check timeout
  if (Date.now() - startTime >= timeoutMs) {
    return { status: "incomplete", answers, remaining };
  }

  // Sleep then recurse
  await sleep(pollIntervalMs);

  // Check timeout again after sleep (in case sleep took longer)
  if (Date.now() - startTime >= timeoutMs) {
    return { status: "incomplete", answers, remaining };
  }

  return pollLoop(artifactPath, timeoutMs, pollIntervalMs, startTime);
}

async function buildAnnotateResult(
  interactive: InteractiveAnnotateData,
  artifactPath: string,
  timeoutMs: number,
  pollIntervalMs: number,
  startTime: number,
): Promise<PollResult> {
  const { comments, verdict } = interactive;
  const base = {
    answers: {} as Record<string, AnswerValue>,
    remaining: [] as string[],
    comments,
    verdict,
    kind: "annotate" as const,
  };

  switch (interactive.status) {
    case "complete":
      return { status: "complete", ...base };
    case "expired":
      return { status: "expired", ...base };
    case "cancelled":
      return { status: "cancelled", ...base };
    case "open":
      break;
  }

  // Check timeout
  if (Date.now() - startTime >= timeoutMs) {
    return { status: "incomplete", ...base };
  }

  // Sleep then recurse
  await sleep(pollIntervalMs);

  // Check timeout again after sleep (in case sleep took longer)
  if (Date.now() - startTime >= timeoutMs) {
    return { status: "incomplete", ...base };
  }

  return pollLoop(artifactPath, timeoutMs, pollIntervalMs, startTime);
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function extractAnswers(interactive: InteractiveAskData): Record<string, AnswerValue> {
  const answers: Record<string, AnswerValue> = {};
  for (const [id, entry] of Object.entries(interactive.answers)) {
    answers[id] = entry.value;
  }
  return answers;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
