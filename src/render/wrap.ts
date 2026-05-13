// Assembles the full <!doctype html> document from a body fragment + metadata.

import { type ThemeTokens } from "./theme.ts";
import { buildThemeCss } from "../storage/theme-write.ts";
import { renderControl, renderAnswered } from "./controls.ts";
import { getClientJs } from "./client-js.ts";
import { faviconLinkTag } from "./favicon.ts";
import type {
  InteractiveData,
  InteractiveAskData,
  InteractiveAnnotateData,
  Question,
  VerdictMode,
} from "./validate.ts";

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
  /** Interactive artifact data. When present, renders question controls below the body. */
  interactive?: InteractiveData;
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

/** Derives the favicon href from the theme.css href.
 *
 *  Both files live in the stateDir root, so the relative depth is identical:
 *  swap the trailing "theme.css" segment for "favicon.svg". For atypical
 *  themeCssHref values (absolute URLs, paths without "theme.css" suffix), fall
 *  back to the artifact-context default.
 */
function deriveFaviconHref(themeCssHref: string): string {
  if (themeCssHref.endsWith("theme.css")) {
    return themeCssHref.slice(0, -"theme.css".length) + "favicon.svg";
  }
  return "../../../favicon.svg";
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

// ─── Interactive rendering ─────────────────────────────────────────────────────

function renderQuestionSection(q: Question, interactive: InteractiveAskData): string {
  const answered = interactive.answers[q.id];

  if (answered !== undefined) {
    return renderAnswered(q, answered.value);
  }

  return renderControl(q);
}

function renderVerdictButtons(verdictMode: VerdictMode, isOpen: boolean): string {
  // When open, render buttons WITHOUT disabled — client JS gates them based on
  // comment count and session status. When not open, mark all disabled.
  const disabled = isOpen ? "" : ' disabled aria-disabled="true"';
  const buttons: string[] = [];

  buttons.push(
    `<button type="button" class="cs-verdict-btn cs-verdict-approve" data-verdict="approve"${disabled}>Approve</button>`,
  );

  if (verdictMode === "approve-or-reject" || verdictMode === "full") {
    buttons.push(
      `<button type="button" class="cs-verdict-btn cs-verdict-request_changes" data-verdict="request_changes"${disabled}>Request changes</button>`,
    );
  }

  if (verdictMode === "full") {
    buttons.push(
      `<button type="button" class="cs-verdict-btn cs-verdict-comment" data-verdict="comment"${disabled}>Comment</button>`,
    );
  }

  return buttons.join("\n      ");
}

function renderAnnotateScaffold(interactive: InteractiveAnnotateData): string {
  const isOpen = interactive.status === "open";
  const verdictButtons = renderVerdictButtons(interactive.verdictMode, isOpen);

  return `<section class="cs-annotate-scaffold" data-cesium-annotate-scaffold data-cesium-verdict-mode="${interactive.verdictMode}" data-cesium-status="${interactive.status}">
  <template id="cs-annotate-comment-popup">
    <div class="cs-comment-popup" role="dialog" aria-label="Add a comment">
      <textarea class="cs-comment-input" placeholder="Add a comment\u2026"></textarea>
      <div class="cs-comment-actions">
        <button type="button" class="cs-comment-save" disabled>Save</button>
        <button type="button" class="cs-comment-cancel">Cancel</button>
      </div>
    </div>
  </template>
  <aside class="cs-comment-rail" data-cesium-comment-rail aria-label="Review comments"></aside>
  <footer class="cs-verdict-footer">
    <span class="cs-comment-count" data-cesium-comment-count>0 comments</span>
    ${verdictButtons}
  </footer>
</section>`;
}

function renderInteractive(interactive: InteractiveData): string {
  if (interactive.kind === "ask") {
    const sections = interactive.questions
      .map((q) => renderQuestionSection(q, interactive))
      .join("\n");
    return `\n<section class="cs-questions">\n${sections}\n</section>`;
  }
  // interactive.kind === "annotate"
  return `\n${renderAnnotateScaffold(interactive)}`;
}

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
  const { body, meta, theme, warnings = [], interactive } = opts;
  // Default href: artifact context (three levels deep from stateDir)
  const href =
    opts.themeCssHref === undefined
      ? "../../../theme.css"
      : opts.themeCssHref === ""
        ? "../../../theme.css"
        : opts.themeCssHref;
  // Suppress <link> when null is explicitly passed
  const suppressLink = opts.themeCssHref === null;

  // Bake the full theme CSS into every artifact so it's genuinely
  // self-contained when opened standalone. When served by the cesium HTTP
  // server, the <link> below still loads and overrides the inline rules in
  // cascade order — so theme upgrades retroactively apply to served artifacts
  // while standalone copies retain their generation-time look.
  const themeCss = buildThemeCss(theme);
  // Embed interactive into the cesium-meta JSON block when present.
  // inputMode is frozen at "blocks" on-disk for stability; the field is kept
  // on emitted metadata so older readers/tools that look for it still see a value.
  const metaPayload: Record<string, unknown> = { ...meta, inputMode: "blocks" };
  if (interactive !== undefined) {
    metaPayload["interactive"] = interactive;
  }
  const metaJson = safeJsonForScript(metaPayload);
  const titleEsc = escapeHtml(meta.title);
  const backNav = renderBackNav(meta);
  const warningHtml = renderWarnings(warnings);
  const footer = renderFooter(meta);
  const interactiveHtml = interactive !== undefined ? renderInteractive(interactive) : "";
  // Inject client JS only when the session is open (status === "open")
  const clientScriptTag =
    interactive !== undefined && interactive.status === "open"
      ? `\n<script data-cesium-client>${getClientJs()}</script>`
      : "";

  const linkTag = suppressLink ? "" : `\n  <link rel="stylesheet" href="${href}">`;
  // Favicon path mirrors the theme.css path: artifacts live three levels deep
  // in <stateDir>/projects/<slug>/artifacts/, so favicon.svg is "../../../".
  // When suppressed (standalone/test mode), we suppress favicon too.
  const faviconTag = suppressLink ? "" : `\n  ${faviconLinkTag(deriveFaviconHref(href ?? ""))}`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${titleEsc} · cesium</title>
  <style>${themeCss}</style>${linkTag}${faviconTag}
  <script type="application/json" id="cesium-meta">${metaJson}</script>
</head>
<body>
${backNav}${warningHtml}${body}${interactiveHtml}${clientScriptTag}
${footer}
</body>
</html>`;
}
