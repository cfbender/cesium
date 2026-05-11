// Assembles the full <!doctype html> document from a body fragment + metadata.

import { frameworkCss, type ThemeTokens } from "./theme.ts";

export interface ArtifactMeta {
  id: string;
  title: string;
  kind: string;
  summary: string | null;
  tags: string[];
  createdAt: string;
  model: string | null;
  sessionId: string | null;
  projectSlug: string;
  projectName: string;
  cwd: string;
  worktree: string | null;
  gitBranch: string | null;
  gitCommit: string | null;
  supersedes: string | null;
  supersededBy: string | null;
  contentSha256: string;
}

export interface WrapOptions {
  body: string;
  meta: ArtifactMeta;
  theme: ThemeTokens;
  warnings?: string[];
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function safeJsonForScript(obj: unknown): string {
  return JSON.stringify(obj, null, 2).replace(/<\/script>/gi, "<\\/script>");
}

function renderWarnings(warnings: string[]): string {
  if (warnings.length === 0) return "";
  return warnings.map((w) => `<div class="callout warn">${escapeHtml(w)}</div>`).join("\n") + "\n";
}

function renderFooter(meta: ArtifactMeta): string {
  const parts: string[] = [
    `<span>id: <code>${escapeHtml(meta.id)}</code></span>`,
    `<span>kind: ${escapeHtml(meta.kind)}</span>`,
    `<span>created: ${escapeHtml(meta.createdAt)}</span>`,
  ];
  if (meta.model) parts.push(`<span>model: ${escapeHtml(meta.model)}</span>`);
  if (meta.supersedes) {
    parts.push(
      `<span>revises: <a href="#supersedes-${escapeHtml(meta.supersedes)}">${escapeHtml(meta.supersedes)}</a></span>`,
    );
  }
  if (meta.supersededBy) {
    parts.push(
      `<span>superseded by: <a href="#supersedes-${escapeHtml(meta.supersededBy)}">${escapeHtml(meta.supersededBy)}</a></span>`,
    );
  }
  return `<footer class="byline">\n${parts.map((p) => `  ${p}`).join("\n")}\n</footer>`;
}

export function wrapDocument(opts: WrapOptions): string {
  const { body, meta, theme, warnings = [] } = opts;
  const css = frameworkCss(theme);
  const metaJson = safeJsonForScript(meta);
  const titleEsc = escapeHtml(meta.title);
  const warningHtml = renderWarnings(warnings);
  const footer = renderFooter(meta);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${titleEsc} · cesium</title>
  <style>${css}</style>
  <script type="application/json" id="cesium-meta">${metaJson}</script>
</head>
<body>
${warningHtml}${body}
${footer}
</body>
</html>`;
}
