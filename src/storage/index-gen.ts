// Generates index.html (per-project and global) from the index.json cache.

import type { IndexEntry } from "./index-cache.ts";
import type { ThemeTokens } from "../render/theme.ts";
import { faviconLinkTag, faviconEmblemSvg } from "../render/favicon.ts";
import { buildThemeCss } from "./theme-write.ts";

export interface RenderProjectIndexArgs {
  projectSlug: string;
  projectName: string;
  entries: IndexEntry[];
  theme: ThemeTokens;
  /** Relative href for the dynamic theme <link> tag.
   *  Default: "../../theme.css" (project index context).
   *  Pass null to suppress the <link> entirely. */
  themeCssHref?: string | null;
}

export interface ProjectSummary {
  slug: string;
  name: string;
  count: number;
  latestCreatedAt: string;
  latestEntries: IndexEntry[];
}

export interface RenderGlobalIndexArgs {
  projects: ProjectSummary[];
  theme: ThemeTokens;
  /** Relative href for the dynamic theme <link> tag.
   *  Default: "theme.css" (global index context).
   *  Pass null to suppress the <link> entirely. */
  themeCssHref?: string | null;
}

export function summarizeProject(args: {
  slug: string;
  name: string;
  entries: IndexEntry[];
  topN?: number;
}): ProjectSummary {
  const { slug, name, entries, topN = 5 } = args;
  const sorted = [...entries].toSorted(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const latestCreatedAt = sorted[0]?.createdAt ?? new Date(0).toISOString();
  return {
    slug,
    name,
    count: entries.length,
    latestCreatedAt,
    latestEntries: sorted.slice(0, topN),
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function esc(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Returns ISO date string for the Monday of the week containing `date` (UTC). */
function isoWeekMonday(date: Date): string {
  const d = new Date(date);
  const day = d.getUTCDay(); // 0=Sun,1=Mon,...,6=Sat
  const diff = day === 0 ? -6 : 1 - day; // shift to Monday
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

function weekLabel(mondayIso: string, nowMondayIso: string): string {
  const diff = (new Date(nowMondayIso).getTime() - new Date(mondayIso).getTime()) / (7 * 86400_000);
  if (diff === 0) return "This week";
  if (diff === 1) return "Last week";
  if (diff === 2) return "Two weeks ago";
  return `Week of ${mondayIso}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

// ─── Index-specific CSS ──────────────────────────────────────────────────────

function indexCss(): string {
  return `
/* index-page chrome */
.cesium-eyebrow {
  display: inline-flex; align-items: center; gap: 8px;
  /* the eyebrow text is uppercased + tracked; the emblem sits flush left */
}
.cesium-eyebrow svg { display: block; }
.filter-row { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 24px; align-items: center; }
.filter-chip {
  display: inline-block; font-family: var(--sans); font-size: 0.8em; font-weight: 500;
  background: var(--oat); border-radius: 20px; padding: 4px 14px; color: var(--ink-soft);
  white-space: nowrap; cursor: pointer; border: 1.5px solid transparent; transition: all 0.15s;
}
.filter-chip:hover { border-color: var(--rule); }
.filter-chip[data-active="1"] {
  background: var(--accent); color: #fff; border-color: var(--accent);
}
.search-wrap { margin-bottom: 20px; }
.search-input {
  width: 100%; padding: 8px 14px; font-family: var(--sans); font-size: 0.95rem;
  border: 1.5px solid var(--rule); border-radius: 12px; background: var(--surface);
  color: var(--ink); outline: none;
}
.search-input:focus { border-color: var(--accent); }
.week-section { margin-bottom: 40px; }
.week-label {
  font-family: var(--mono); font-size: 0.7rem; font-weight: 600;
  letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted);
  margin-bottom: 16px; padding-bottom: 8px; border-bottom: 1px solid var(--rule);
}
.entry-card {
  background: var(--surface); border: 1.5px solid var(--rule); border-radius: 12px;
  padding: 18px 22px; margin-bottom: 14px; transition: box-shadow 0.15s, border-color 0.15s;
}
.entry-card:hover { box-shadow: 0 2px 12px rgba(0,0,0,0.07); border-color: var(--oat); }
.entry-card a { text-decoration: none; color: inherit; }
.entry-card a:hover { opacity: 1; }
.card-top { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; flex-wrap: wrap; }
.card-date { margin-left: auto; font-family: var(--mono); font-size: 0.75rem; color: var(--muted); }
.card-title {
  font-family: var(--serif); font-size: 1.1rem; font-weight: 600;
  color: var(--ink); margin-bottom: 6px; line-height: 1.3;
}
.card-summary { font-size: 0.9rem; color: var(--inkSoft, var(--ink-soft)); margin-bottom: 10px; }
.card-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.card-footer { margin-top: 12px; text-align: right; }
.open-link {
  font-family: var(--mono); font-size: 0.8rem; color: var(--accent);
  text-decoration: none; font-weight: 600;
}
.open-link:hover { opacity: 0.8; }
.superseded-badge {
  display: inline-block; font-family: var(--mono); font-size: 0.7rem; font-weight: 600;
  background: var(--surface-2); border: 1px solid var(--rule); border-radius: 6px;
  padding: 2px 8px; color: var(--muted);
}
[data-superseded="1"] { opacity: 0.55; }
body:not([data-show-superseded]) [data-superseded="1"] { display: none; }
.show-superseded-wrap { margin-bottom: 16px; }
.show-superseded-btn {
  font-family: var(--mono); font-size: 0.75rem; color: var(--muted); background: none;
  border: 1px solid var(--rule); border-radius: 6px; padding: 4px 10px; cursor: pointer;
}
.empty-state {
  background: var(--surface); border: 1.5px solid var(--rule); border-radius: 12px;
  padding: 40px 22px; text-align: center; color: var(--muted);
  font-family: var(--sans); font-size: 0.95rem; margin-top: 24px;
}
/* grid for wider screens */
@media (min-width: 720px) {
  .cards-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .cards-grid .entry-card { margin-bottom: 0; }
}
/* project cards in global index */
.project-card {
  background: var(--surface); border: 1.5px solid var(--rule); border-radius: 12px;
  padding: 20px 24px; margin-bottom: 16px; text-decoration: none; display: block; color: inherit;
}
.project-card:hover { box-shadow: 0 2px 12px rgba(0,0,0,0.07); border-color: var(--oat); opacity: 1; }
.project-card-name { font-family: var(--serif); font-size: 1.25rem; font-weight: 600; color: var(--ink); margin-bottom: 4px; }
.project-card-meta { font-family: var(--mono); font-size: 0.75rem; color: var(--muted); margin-bottom: 12px; }
.project-recent-list { list-style: none; padding: 0; margin: 0; }
.project-recent-list li {
  display: flex; align-items: baseline; gap: 8px; padding: 4px 0;
  border-bottom: 1px solid var(--rule); font-size: 0.875rem;
}
.project-recent-list li:last-child { border-bottom: none; }
.project-recent-title { color: var(--ink-soft); flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.project-recent-date { font-family: var(--mono); font-size: 0.7rem; color: var(--muted); white-space: nowrap; }
`;
}

// ─── Inline JS ───────────────────────────────────────────────────────────────

function indexJs(): string {
  return `
(function() {
  var body = document.body;
  // Kind filter chips
  document.querySelectorAll('.filter-chip').forEach(function(chip) {
    chip.addEventListener('click', function() {
      document.querySelectorAll('.filter-chip').forEach(function(c) { c.setAttribute('data-active','0'); });
      chip.setAttribute('data-active','1');
      var kind = chip.getAttribute('data-kind') || '';
      if (kind) { body.setAttribute('data-active-kind', kind); }
      else { body.removeAttribute('data-active-kind'); }
      applyFilters();
    });
  });
  // Search
  var search = document.getElementById('cesium-search');
  if (search) {
    search.addEventListener('input', function() { applyFilters(); });
  }
  // Show superseded toggle
  var toggleBtn = document.getElementById('cesium-toggle-superseded');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', function() {
      if (body.hasAttribute('data-show-superseded')) {
        body.removeAttribute('data-show-superseded');
        toggleBtn.textContent = 'Show superseded versions';
      } else {
        body.setAttribute('data-show-superseded','1');
        toggleBtn.textContent = 'Hide superseded versions';
      }
    });
  }
  function applyFilters() {
    var activeKind = body.getAttribute('data-active-kind') || '';
    var query = (search ? search.value.toLowerCase() : '');
    document.querySelectorAll('[data-card]').forEach(function(card) {
      var kind = card.getAttribute('data-kind') || '';
      var titleLower = card.getAttribute('data-title-lower') || '';
      var bodyText = card.getAttribute('data-body-text') || '';
      var kindMatch = !activeKind || kind === activeKind;
      var haystack = titleLower + ' ' + bodyText;
      var searchMatch = !query || haystack.includes(query);
      card.style.display = (kindMatch && searchMatch) ? '' : 'none';
    });
  }
})();
`;
}

// ─── Card rendering ──────────────────────────────────────────────────────────

function renderEntryCard(entry: IndexEntry): string {
  const isSuperseded = entry.supersededBy !== null ? "1" : "0";
  const kindPill = `<span class="pill">${esc(entry.kind)}</span>`;
  const inputModeBadge =
    entry.inputMode !== undefined ? ` <span class="tag">${esc(entry.inputMode)}</span>` : "";
  const dateStr = `<span class="card-date">${esc(formatDate(entry.createdAt))}</span>`;
  const supersededBadge =
    entry.supersedes !== null
      ? ` <span class="superseded-badge">revises&nbsp;${esc(entry.supersedes.slice(0, 6))}</span>`
      : "";
  const supersededByBadge =
    entry.supersededBy !== null
      ? ` <span class="superseded-badge">superseded&nbsp;by&nbsp;${esc(entry.supersededBy.slice(0, 6))}</span>`
      : "";

  const summaryHtml =
    entry.summary !== null ? `<div class="card-summary">${esc(entry.summary)}</div>` : "";

  const tagsHtml =
    entry.tags.length > 0
      ? `<div class="card-tags">${entry.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join(" ")}</div>`
      : "";

  return `<div class="entry-card" data-card data-kind="${esc(entry.kind)}" data-title-lower="${esc(entry.title.toLowerCase())}" data-body-text="${esc(entry.bodyText.toLowerCase())}" data-superseded="${isSuperseded}">
  <div class="card-top">${kindPill}${inputModeBadge}${supersededBadge}${supersededByBadge}${dateStr}</div>
  <div class="card-title"><a href="artifacts/${esc(entry.filename)}">${esc(entry.title)}</a></div>
  ${summaryHtml}${tagsHtml}
  <div class="card-footer"><a class="open-link" href="artifacts/${esc(entry.filename)}">Open →</a></div>
</div>`;
}

// ─── renderProjectIndex ──────────────────────────────────────────────────────

export function renderProjectIndex(args: RenderProjectIndexArgs): string {
  const { projectSlug, projectName, entries, theme } = args;
  const href =
    args.themeCssHref === undefined
      ? "../../theme.css"
      : args.themeCssHref === ""
        ? "../../theme.css"
        : args.themeCssHref;
  const suppressLink = args.themeCssHref === null;

  // Bake the full theme CSS into the index so it's self-contained when opened
  // standalone; the <link> below still loads and overrides when served.
  const themeCss = buildThemeCss(theme);
  const iCss = indexCss();
  const iJs = indexJs();

  const linkTag = suppressLink ? "" : `\n  <link rel="stylesheet" href="${href}">`;
  // Favicon sits next to theme.css in the stateDir root, so swap the suffix.
  const faviconHref =
    href !== null && href.endsWith("theme.css")
      ? href.slice(0, -"theme.css".length) + "favicon.svg"
      : "../../favicon.svg";
  const faviconTag = suppressLink ? "" : `\n  ${faviconLinkTag(faviconHref)}`;

  // Sort entries newest-first
  const sorted = [...entries].toSorted(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  // Unique kinds
  const kinds = [...new Set(sorted.map((e) => e.kind))];

  // Filter chips
  const chipAll = `<button class="filter-chip" data-active="1" data-kind="">All</button>`;
  const kindChips = kinds
    .map(
      (k) => `<button class="filter-chip" data-active="0" data-kind="${esc(k)}">${esc(k)}</button>`,
    )
    .join("");
  const filterRow = `<div class="filter-row">${chipAll}${kindChips}</div>`;
  const searchBar = `<div class="search-wrap"><input id="cesium-search" class="search-input" type="search" placeholder="Filter by title or content…" autocomplete="off"></div>`;

  // Has superseded entries?
  const hasSuperseded = sorted.some((e) => e.supersededBy !== null);
  const supersededToggle = hasSuperseded
    ? `<div class="show-superseded-wrap"><button id="cesium-toggle-superseded" class="show-superseded-btn">Show superseded versions</button></div>`
    : "";

  // Group by ISO week (Monday)
  const nowMonday = isoWeekMonday(new Date());
  const weekMap = new Map<string, IndexEntry[]>();
  for (const entry of sorted) {
    const monday = isoWeekMonday(new Date(entry.createdAt));
    const group = weekMap.get(monday) ?? [];
    group.push(entry);
    weekMap.set(monday, group);
  }
  // Sort weeks newest-first
  const weeks = [...weekMap.entries()].toSorted(
    ([a], [b]) => new Date(b).getTime() - new Date(a).getTime(),
  );

  let bodyContent: string;
  if (sorted.length === 0) {
    bodyContent = `<div class="empty-state">No artifacts published yet.</div>`;
  } else {
    bodyContent = weeks
      .map(([monday, weekEntries]) => {
        const label = weekLabel(monday, nowMonday);
        const cardsHtml = weekEntries.map(renderEntryCard).join("\n");
        return `<div class="week-section">
  <div class="week-label">${esc(label)}</div>
  <div class="cards-grid">
${cardsHtml}
  </div>
</div>`;
      })
      .join("\n");
  }

  const subhead = `<p style="color:var(--muted);font-family:var(--mono);font-size:0.8rem;margin-top:-0.5em;margin-bottom:1.5em;">
  ${sorted.length} artifact${sorted.length !== 1 ? "s" : ""} &nbsp;·&nbsp; <span class="pill">${esc(projectSlug)}</span>
</p>`;

  const footer = `<footer class="byline">
  <span>${esc(projectSlug)}</span>
  <span><a href="../../index.html">← All projects</a></span>
</footer>`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(projectName)} · cesium</title>
  <style>${themeCss}${iCss}</style>${linkTag}${faviconTag}
</head>
<body>
<div class="page">
  <p class="eyebrow cesium-eyebrow">${faviconEmblemSvg(18)}<span>cesium · project</span></p>
  <h1 class="h-display">${esc(projectName)}</h1>
  ${subhead}
  ${filterRow}
  ${searchBar}
  ${supersededToggle}
  ${bodyContent}
  ${footer}
</div>
<script>${iJs}</script>
</body>
</html>`;
}

// ─── renderGlobalIndex ───────────────────────────────────────────────────────

export function renderGlobalIndex(args: RenderGlobalIndexArgs): string {
  const { projects, theme } = args;
  const href =
    args.themeCssHref === undefined
      ? "theme.css"
      : args.themeCssHref === ""
        ? "theme.css"
        : args.themeCssHref;
  const suppressLink = args.themeCssHref === null;

  // Bake the full theme CSS into the index so it's self-contained when opened
  // standalone; the <link> below still loads and overrides when served.
  const themeCss = buildThemeCss(theme);
  const iCss = indexCss();

  const linkTag = suppressLink ? "" : `\n  <link rel="stylesheet" href="${href}">`;
  // Favicon sits next to theme.css; default href is "theme.css" → "favicon.svg".
  const faviconHref =
    href !== null && href.endsWith("theme.css")
      ? href.slice(0, -"theme.css".length) + "favicon.svg"
      : "favicon.svg";
  const faviconTag = suppressLink ? "" : `\n  ${faviconLinkTag(faviconHref)}`;

  const sorted = [...projects].toSorted(
    (a, b) => new Date(b.latestCreatedAt).getTime() - new Date(a.latestCreatedAt).getTime(),
  );

  const total = projects.reduce((sum, p) => sum + p.count, 0);

  const projectCards = sorted.map((p) => {
    const recentItems = p.latestEntries
      .map(
        (e) =>
          `<li><span class="pill" style="font-size:0.7em">${esc(e.kind)}</span> <span class="project-recent-title">${esc(e.title)}</span> <span class="project-recent-date">${esc(formatDate(e.createdAt))}</span></li>`,
      )
      .join("\n");
    const recentList =
      p.latestEntries.length > 0
        ? `<ul class="project-recent-list">${recentItems}</ul>`
        : `<p style="color:var(--muted);font-size:0.85rem;margin:0">No artifacts yet.</p>`;

    return `<a class="project-card" href="projects/${esc(p.slug)}/index.html">
  <div class="project-card-name">${esc(p.name)}</div>
  <div class="project-card-meta">${esc(p.slug)} &nbsp;·&nbsp; ${p.count} artifact${p.count !== 1 ? "s" : ""} &nbsp;·&nbsp; latest ${esc(formatDate(p.latestCreatedAt))}</div>
  ${recentList}
</a>`;
  });

  let bodyContent: string;
  if (sorted.length === 0) {
    bodyContent = `<div class="empty-state">No projects published yet.</div>`;
  } else {
    bodyContent = projectCards.join("\n");
  }

  const subhead = `<p style="color:var(--muted);font-family:var(--mono);font-size:0.8rem;margin-top:-0.5em;margin-bottom:1.5em;">
  ${sorted.length} project${sorted.length !== 1 ? "s" : ""} &nbsp;·&nbsp; ${total} artifact${total !== 1 ? "s" : ""}
</p>`;

  const footer = `<footer class="byline">
  <span>cesium v0.0.0</span>
</footer>`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>All projects · cesium</title>
  <style>${themeCss}${iCss}</style>${linkTag}${faviconTag}
</head>
<body>
<div class="page">
  <p class="eyebrow cesium-eyebrow">${faviconEmblemSvg(18)}<span>cesium</span></p>
  <h1 class="h-display">All projects</h1>
  ${subhead}
  ${bodyContent}
  ${footer}
</div>
</body>
</html>`;
}
