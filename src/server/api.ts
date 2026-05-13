// API routes for interactive artifact submissions and state queries, exposed
// as a Hono sub-app. Mounted by lifecycle.ts via `handle.app.route("/", apiApp)`.
//
// Routes:
//   POST /api/sessions/:projectSlug/:filename/answers/:questionId
//   GET  /api/sessions/:projectSlug/:filename/state
//   POST /api/sessions/:projectSlug/:filename/comments
//   DELETE /api/sessions/:projectSlug/:filename/comments/:commentId
//   POST /api/sessions/:projectSlug/:filename/verdict
//
// Any other /api/* path returns a JSON 404 (rather than falling through to the
// static file handler, which would return the HTML 404 page).

import { join, resolve, relative } from "node:path";
import { Hono } from "hono";
import {
  submitAnswer,
  getState,
  addComment,
  removeComment,
  setVerdict,
} from "../storage/mutate.ts";
import type { AnswerValue } from "../render/validate.ts";

export interface ApiHandlerOptions {
  stateDir: string;
}

// Artifact filename regex: <iso-utc>__<slug>__<6char>.html
// Permissive form: no path separators + ends with .html
const FILENAME_RE = /^[^/\\]+\.html$/;
const DANGEROUS_RE = /[/\\]|\.\./;

interface ResolvedArtifact {
  /** Absolute path to the artifact file. */
  artifactPath: string;
}

/**
 * Validate the slug/filename pair and resolve the artifact's absolute path,
 * enforcing containment under <stateDir>/projects/<slug>/artifacts/. Returns
 * a Hono `Response` on validation failure, or the resolved path on success.
 */
function resolveArtifact(
  stateDir: string,
  projectSlug: string,
  filename: string,
): ResolvedArtifact | Response {
  if (DANGEROUS_RE.test(projectSlug) || DANGEROUS_RE.test(filename)) {
    return Response.json({ ok: false, error: "invalid path component" }, { status: 400 });
  }
  if (!FILENAME_RE.test(filename)) {
    return Response.json({ ok: false, error: "filename must end with .html" }, { status: 400 });
  }

  const artifactsDir = join(stateDir, "projects", projectSlug, "artifacts");
  const artifactPath = join(artifactsDir, filename);
  const resolvedArtifactsDir = resolve(artifactsDir);
  const resolvedArtifact = resolve(artifactPath);
  const rel = relative(resolvedArtifactsDir, resolvedArtifact);
  if (rel.startsWith("..") || rel.includes("/")) {
    return Response.json({ ok: false, error: "invalid path" }, { status: 400 });
  }
  return { artifactPath: resolvedArtifact };
}

export function createApiApp(options: ApiHandlerOptions): Hono {
  const { stateDir } = options;
  const app = new Hono();

  // All API responses are dynamic — never let intermediaries cache them.
  app.use("/api/*", async (c, next) => {
    await next();
    c.header("Cache-Control", "no-store");
  });

  // POST /api/sessions/:projectSlug/:filename/answers/:questionId
  app.post("/api/sessions/:projectSlug/:filename/answers/:questionId", async (c) => {
    const { projectSlug, filename, questionId } = c.req.param();

    const resolved = resolveArtifact(stateDir, projectSlug, filename);
    if (resolved instanceof Response) return resolved;

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ ok: false, error: "invalid JSON body" }, 400);
    }

    if (
      body === null ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      !("value" in (body as Record<string, unknown>))
    ) {
      return c.json({ ok: false, error: 'body must contain a "value" field' }, 400);
    }

    const value = (body as Record<string, unknown>)["value"] as AnswerValue;

    const outcome = await submitAnswer({
      artifactPath: resolved.artifactPath,
      questionId,
      value,
    });

    if (outcome.ok) {
      return c.json(
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
        return c.json({ ok: false, reason: outcome.reason }, 404);
      case "session-ended":
        return c.json({ ok: false, status: outcome.status }, 410);
      case "expired":
        return c.json({ ok: false, status: "expired" }, 410);
      case "invalid-value":
        return c.json({ ok: false, message: outcome.message }, 422);
    }

    return c.json({ ok: false, error: "internal error" }, 500);
  });

  // GET /api/sessions/:projectSlug/:filename/state
  app.get("/api/sessions/:projectSlug/:filename/state", async (c) => {
    const { projectSlug, filename } = c.req.param();

    const resolved = resolveArtifact(stateDir, projectSlug, filename);
    if (resolved instanceof Response) return resolved;

    const outcome = await getState(resolved.artifactPath);
    if (!outcome.ok) {
      return c.json({ ok: false, reason: outcome.reason }, 404);
    }

    if (outcome.kind === "ask") {
      return c.json(
        {
          kind: "ask",
          status: outcome.status,
          answers: outcome.answers,
          remaining: outcome.remaining,
        },
        200,
      );
    }

    // kind === "annotate"
    return c.json(
      {
        kind: "annotate",
        status: outcome.status,
        comments: outcome.comments,
        verdict: outcome.verdict,
        verdictMode: outcome.verdictMode,
      },
      200,
    );
  });

  // POST /api/sessions/:projectSlug/:filename/comments
  app.post("/api/sessions/:projectSlug/:filename/comments", async (c) => {
    const { projectSlug, filename } = c.req.param();

    const resolved = resolveArtifact(stateDir, projectSlug, filename);
    if (resolved instanceof Response) return resolved;

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ ok: false, error: "invalid JSON body" }, 400);
    }

    if (body === null || typeof body !== "object" || Array.isArray(body)) {
      return c.json({ ok: false, error: "body must be an object" }, 400);
    }

    const raw = body as Record<string, unknown>;
    if (
      typeof raw["anchor"] !== "string" ||
      typeof raw["selectedText"] !== "string" ||
      typeof raw["comment"] !== "string"
    ) {
      return c.json(
        { ok: false, error: 'body must contain "anchor", "selectedText", and "comment" fields' },
        400,
      );
    }

    const outcome = await addComment({
      artifactPath: resolved.artifactPath,
      anchor: raw["anchor"],
      selectedText: raw["selectedText"],
      comment: raw["comment"],
    });

    if (outcome.ok) {
      return c.json({ ok: true, comment: outcome.comment }, 200);
    }

    switch (outcome.reason) {
      case "not-found":
      case "not-interactive":
        return c.json({ ok: false, reason: outcome.reason }, 404);
      case "session-ended":
        return c.json({ ok: false, status: outcome.status }, 410);
      case "expired":
        return c.json({ ok: false, status: "expired" }, 410);
      case "invalid-value":
        return c.json({ ok: false, message: outcome.message }, 422);
    }

    return c.json({ ok: false, error: "internal error" }, 500);
  });

  // DELETE /api/sessions/:projectSlug/:filename/comments/:commentId
  app.delete("/api/sessions/:projectSlug/:filename/comments/:commentId", async (c) => {
    const { projectSlug, filename, commentId } = c.req.param();

    const resolved = resolveArtifact(stateDir, projectSlug, filename);
    if (resolved instanceof Response) return resolved;

    const outcome = await removeComment({
      artifactPath: resolved.artifactPath,
      commentId,
    });

    if (outcome.ok) {
      return c.json({ ok: true }, 200);
    }

    switch (outcome.reason) {
      case "not-found":
      case "not-interactive":
        return c.json({ ok: false, reason: outcome.reason }, 404);
      case "comment-not-found":
        return c.json({ ok: false, reason: "comment-not-found" }, 404);
      case "session-ended":
        return c.json({ ok: false, status: outcome.status }, 410);
      case "expired":
        return c.json({ ok: false, status: "expired" }, 410);
    }

    return c.json({ ok: false, error: "internal error" }, 500);
  });

  // POST /api/sessions/:projectSlug/:filename/verdict
  app.post("/api/sessions/:projectSlug/:filename/verdict", async (c) => {
    const { projectSlug, filename } = c.req.param();

    const resolved = resolveArtifact(stateDir, projectSlug, filename);
    if (resolved instanceof Response) return resolved;

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ ok: false, error: "invalid JSON body" }, 400);
    }

    if (body === null || typeof body !== "object" || Array.isArray(body)) {
      return c.json({ ok: false, error: "body must be an object" }, 400);
    }

    const raw = body as Record<string, unknown>;
    if (typeof raw["verdict"] !== "string") {
      return c.json({ ok: false, error: 'body must contain a string "verdict" field' }, 400);
    }

    // Pass verdict as-is to setVerdict; mode-checking happens internally
    const outcome = await setVerdict({
      artifactPath: resolved.artifactPath,
      verdict: raw["verdict"] as import("../render/validate.ts").Verdict,
    });

    if (outcome.ok) {
      return c.json({ ok: true, status: outcome.status, verdict: outcome.verdict }, 200);
    }

    switch (outcome.reason) {
      case "not-found":
      case "not-interactive":
        return c.json({ ok: false, reason: outcome.reason }, 404);
      case "session-ended":
        return c.json({ ok: false, status: outcome.status }, 410);
      case "expired":
        return c.json({ ok: false, status: "expired" }, 410);
      case "invalid-value":
        return c.json({ ok: false, message: outcome.message }, 422);
    }

    return c.json({ ok: false, error: "internal error" }, 500);
  });

  // Catch-all under /api/* — keeps unmatched API paths as JSON 404 instead of
  // falling through to the static file handler.
  app.all("/api/*", (c) => c.json({ ok: false, error: "not found" }, 404));

  return app;
}
