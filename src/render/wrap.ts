// Assembles the full <!doctype html> document from a body fragment + metadata.

import { frameworkRulesCss, themeTokensCss, type ThemeTokens } from "./theme.ts";

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
  /** Relative href for the dynamic theme <link> tag.
   *  Default: "../../../theme.css" (artifact context).
   *  Pass "" or omit to use the default.
   *  Pass null to suppress the <link> entirely (standalone/test mode). */
  themeCssHref?: string | null;
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

const BACK_NAV_STYLE =
  "font-family: var(--mono); font-size: 12px; letter-spacing: 0.04em; " +
  "margin-bottom: 24px; color: var(--muted);";
const BACK_LINK_STYLE = "color: var(--muted); text-decoration: none;";

function renderBackNav(meta: ArtifactMeta): string {
  // Two relative links: project index lives one directory up from the artifact;
  // global index is three levels up (../../../index.html). Both work whether
  // the file is opened over http (cesium server) or via file://.
  const projectLabel = escapeHtml(meta.projectName);
  return `<nav class="cesium-back" aria-label="cesium navigation" style="${BACK_NAV_STYLE}">
  <a href="../index.html" style="${BACK_LINK_STYLE}">← ${projectLabel}</a>
  <span style="margin: 0 8px; opacity: 0.5;">·</span>
  <a href="../../../index.html" style="${BACK_LINK_STYLE}">all projects</a>
</nav>
`;
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
  // Default href: artifact context (three levels deep from stateDir)
  const href =
    opts.themeCssHref === undefined
      ? "../../../theme.css"
      : opts.themeCssHref === ""
        ? "../../../theme.css"
        : opts.themeCssHref;
  // Suppress <link> when null is explicitly passed
  const suppressLink = opts.themeCssHref === null;

  const rules = frameworkRulesCss();
  const tokens = themeTokensCss(theme);
  const metaJson = safeJsonForScript(meta);
  const titleEsc = escapeHtml(meta.title);
  const backNav = renderBackNav(meta);
  const warningHtml = renderWarnings(warnings);
  const footer = renderFooter(meta);

  const linkTag = suppressLink ? "" : `\n  <link rel="stylesheet" href="${href}">`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${titleEsc} · cesium</title>
  <style>${rules}
/* fallback theme tokens — used when theme.css is missing or unreachable */
${tokens}</style>${linkTag}
  <script type="application/json" id="cesium-meta">${metaJson}</script>
</head>
<body>
${backNav}${warningHtml}${body}
${footer}
</body>
</html>`;
}
