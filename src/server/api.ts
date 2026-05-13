// API route handler for interactive artifact submissions and state queries.
//
// Routes:
//   POST /api/sessions/:projectSlug/:filename/answers/:questionId
//   GET  /api/sessions/:projectSlug/:filename/state
//
// Wire into startServer via handle.addHandler() before the static file fallback.

import { join, resolve, relative } from "node:path";
import { submitAnswer, getState } from "../storage/mutate.ts";
import type { AnswerValue } from "../render/validate.ts";

export interface ApiHandlerOptions {
  stateDir: string;
}

// Artifact filename regex: <iso-utc>__<slug>__<6char>.html
// Permissive form: no path separators + ends with .html
const FILENAME_RE = /^[^/\\]+\.html$/;
const DANGEROUS_RE = /[/\\]|\.\./;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export function createApiHandler(
  options: ApiHandlerOptions,
): (req: Request) => Promise<Response | undefined> {
  const { stateDir } = options;

  return async (req: Request): Promise<Response | undefined> => {
    const url = new URL(req.url);
    const { pathname } = url;

    // Only handle /api/ routes
    if (!pathname.startsWith("/api/")) {
      return undefined;
    }

    // ─── Route matching ────────────────────────────────────────────────────
    // POST /api/sessions/:projectSlug/:filename/answers/:questionId
    const answerMatch = /^\/api\/sessions\/([^/]+)\/([^/]+)\/answers\/([^/]+)$/.exec(pathname);
    // GET  /api/sessions/:projectSlug/:filename/state
    const stateMatch = /^\/api\/sessions\/([^/]+)\/([^/]+)\/state$/.exec(pathname);

    const match = answerMatch ?? stateMatch;
    if (match === null) {
      // Unrecognized /api/ path
      return jsonResponse({ ok: false, error: "not found" }, 404);
    }

    // The regexes both have ([^/]+) for groups 1 and 2, so a successful match
    // always populates these capture groups.
    const projectSlug = match[1] ?? "";
    const filename = match[2] ?? "";

    // ─── Input validation ──────────────────────────────────────────────────
    if (DANGEROUS_RE.test(projectSlug) || DANGEROUS_RE.test(filename)) {
      return jsonResponse({ ok: false, error: "invalid path component" }, 400);
    }

    if (!FILENAME_RE.test(filename)) {
      return jsonResponse({ ok: false, error: "filename must end with .html" }, 400);
    }

    // ─── Path traversal defense ────────────────────────────────────────────
    const artifactsDir = join(stateDir, "projects", projectSlug, "artifacts");
    const artifactPath = join(artifactsDir, filename);

    const resolvedArtifactsDir = resolve(artifactsDir);
    const resolvedArtifact = resolve(artifactPath);
    const rel = relative(resolvedArtifactsDir, resolvedArtifact);
    if (rel.startsWith("..") || rel.includes("/")) {
      return jsonResponse({ ok: false, error: "invalid path" }, 400);
    }

    // ─── Route dispatch ────────────────────────────────────────────────────

    if (answerMatch !== null) {
      // POST /api/sessions/:projectSlug/:filename/answers/:questionId
      if (req.method !== "POST") {
        return jsonResponse({ ok: false, error: "method not allowed" }, 404);
      }

      const questionId = answerMatch[3] ?? "";

      // Parse body
      let body: unknown;
      try {
        body = await req.json();
      } catch {
        return jsonResponse({ ok: false, error: "invalid JSON body" }, 400);
      }

      if (
        body === null ||
        typeof body !== "object" ||
        Array.isArray(body) ||
        !("value" in (body as Record<string, unknown>))
      ) {
        return jsonResponse({ ok: false, error: 'body must contain a "value" field' }, 400);
      }

      const value = (body as Record<string, unknown>)["value"] as AnswerValue;

      const outcome = await submitAnswer({ artifactPath: resolvedArtifact, questionId, value });

      if (outcome.ok) {
        return jsonResponse(
          {
            ok: true,
            status: outcome.status,
            remaining: outcome.remaining,
            replacementHtml: outcome.replacementHtml,
          },
          200,
        );
      }

      switch (outcome.reason) {
        case "not-found":
        case "not-interactive":
        case "unknown-question":
          return jsonResponse({ ok: false, reason: outcome.reason }, 404);
        case "session-ended":
          return jsonResponse({ ok: false, status: outcome.status }, 410);
        case "expired":
          return jsonResponse({ ok: false, status: "expired" }, 410);
        case "invalid-value":
          return jsonResponse({ ok: false, message: outcome.message }, 422);
      }

      // Fallback (should not reach)
      return jsonResponse({ ok: false, error: "internal error" }, 500);
    }

    if (stateMatch !== null) {
      // GET /api/sessions/:projectSlug/:filename/state
      if (req.method !== "GET") {
        return jsonResponse({ ok: false, error: "method not allowed" }, 404);
      }

      const outcome = await getState(resolvedArtifact);

      if (!outcome.ok) {
        return jsonResponse({ ok: false, reason: outcome.reason }, 404);
      }

      return jsonResponse(
        {
          status: outcome.status,
          answers: outcome.answers,
          remaining: outcome.remaining,
        },
        200,
      );
    }

    // Should not reach here
    return jsonResponse({ ok: false, error: "not found" }, 404);
  };
}
