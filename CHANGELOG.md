# Changelog

## v0.5.1 — 2026-05-12

Server-side syntax highlighting for `code` blocks via shiki. The model emits
plain source code; the render pipeline tokenizes it at publish time and emits
`<span style="color:...">` tokens. Two custom shiki themes — `claret-dark` and
`claret-light` — are authored directly from the cesium palette tokens so code
highlighting feels native to the claret themes. Other presets fall back to
vitesse-dark (all non-claret presets have dark code panels).

- **feat:** `claret-dark` shiki theme (`src/render/blocks/themes/claret-dark.ts`)
  — keywords in `#C75B7A` (claret rose accent), strings in `#8FA86E` (olive),
  comments in `#9E9288` (muted gray/italic), functions in `#D4A85A` (gold),
  types in `#7AAEB5` (teal), numbers in `#C99A6E` (warm amber).
- **feat:** `claret-light` shiki theme (`src/render/blocks/themes/claret-light.ts`)
  — same dark code panel (`#180810`) as claret-light CSS uses; keywords in
  `#8B2252` (deep claret rose), strings in `#5A6B40` (dark olive), comments
  in `#7D7068` (muted taupe/italic), functions in `#D4A85A` (gold), types in
  `#6A9FA8` (teal), numbers in `#C08048` (warm amber).
- **feat:** `resolveHighlightTheme(cesiumThemeName)` — maps cesium theme preset
  names to the right shiki theme. `claret`/`claret-dark` → custom claret-dark,
  `claret-light` → custom claret-light, all others → `vitesse-dark` (detected
  via codeBg luminance; all current non-claret presets have dark code panels).
- **feat:** `highlightCode(code, lang, theme?)` — extended with optional theme
  parameter defaulting to `"vitesse-dark"`. Highlighter singleton loads all
  four themes (`claret-dark`, `claret-light`, `vitesse-dark`, `vitesse-light`)
  upfront.
- **feat:** `RenderCtx.highlightTheme` — threaded from `renderBlocks` opts
  through the context tree into the code renderer. `publish.ts` derives the
  theme via `resolveHighlightTheme(config.themePreset)`.
- **dep:** Added `shiki@^4.0.0` as a runtime dependency.

## v0.5.0 — 2026-05-12

Block-mode refactor — `cesium_publish` now accepts a structured `blocks` array
alongside the legacy `html` field. The server templates 15 block types from
JSON; raw HTML stays available as a per-block escape hatch (`raw_html`,
`diagram`). Framework CSS moves out of every artifact and into a single served
`/theme.css`. Styleguide is generated from a catalog at request time.
Critique is mode-aware. Expected savings on a balanced doc: roughly 2× output
tokens, more on heavily structured artifacts.

- **feat:** `cesium_publish({ blocks: Block[] })` — closed discriminated union
  of 15 block types: `hero`, `tldr`, `section`, `prose`, `list`, `callout`,
  `code`, `timeline`, `compare_table`, `risk_table`, `kv`, `pill_row`,
  `divider`, `diagram`, `raw_html`. Mutually exclusive with `html`.
- **feat:** Owned markdown subset (~80 lines, no dependency) for `prose`,
  `tldr`, `callout`, list items, and table cells. Supports paragraphs, lists,
  blockquotes, hr, hard breaks, `**bold**`, `*italic*`, `` `code` ``, local
  links, and the safelisted inline tags `<kbd>`, `<span class="pill">`,
  `<span class="tag">`.
- **feat:** Sections recurse to depth 3; non-section children get auto-wrapped
  in `<div class="card">` for visual consistency.
- **feat:** `theme.css` served from `<state-dir>/theme.css` with a small
  inline fallback (~8 lines) so standalone-opened `.html` files remain
  readable. Existing artifacts (with full CSS inlined) are never rewritten and
  stay self-contained.
- **feat:** `cesium_styleguide` returns a markdown reference generated from
  the block catalog at request time — schema, examples, and renderer can no
  longer drift.
- **feat:** `cesium_critique` is mode-aware. `html` mode adds a soft
  `prefer-blocks` nag; `blocks` mode focuses on quality (raw-html overuse,
  prose walls, missing tldr on long docs, table-shape, redundant raw_html,
  nesting depth). Findings carry path tags like `blocks[2].children[1]`.
- **feat:** Deep block validation walks the catalog schema per type. Returns
  path-tagged errors with "did you mean" suggestions for common drift
  (`label`→`k`, `value`→`v`, `description`→`text`, `med`→`medium`, etc.).
- **feat:** System prompt fragment generated from the block catalog at plugin
  load time — drift between schema and prompt is now physically impossible.
- **feat:** `inputMode: "html" | "blocks"` recorded in artifact metadata and
  surfaced as a small badge on index cards.
- **feat:** Framework CSS extended with rules for every block-renderer
  pattern: `dl.kv` (2-column grid), `.pill-row`, `.check-list`, `<hr
  data-label>`, `figure.code`, timeline-item internals, `.lede`, plus
  `.diagram svg text { fill: currentColor }` so SVGs inherit theme color.
- **feat:** `escapeHtml` and `escapeAttr` throw a clear error on non-string
  input instead of crashing inside `.replace()`.
- **fix:** `ensureThemeCss` respects the configured `themePreset` (regression
  introduced when the framework CSS was first extracted to a served file).
- **fix:** `wait` test fixtures use relative timestamps so they don't go
  stale.
- **docs:** `AGENTS.md` updated with the new project layout, two-input-modes
  architecture, catalog-as-source-of-truth, and softened CSS portability
  invariant ("no external network resources; local `/theme.css` is allowed").

## v0.3.6 — 2026-05-11

Adds a periodic-table-themed favicon for the cesium HTTP server.

- **feat:** Element-55 ("Cs") periodic-table tile favicon in the claret-dark
  palette. Source SVG at `assets/favicon.svg`.
- **feat:** `writeFaviconSvg` drops `<stateDir>/favicon.svg` next to
  `theme.css` on every publish/ask (and on `cesium theme apply`). The static
  HTTP server then serves it at `/favicon.svg`.
- **feat:** `<link rel="icon" type="image/svg+xml">` is now emitted in
  artifact pages, project index pages, and the global index page (paths
  derived from the existing theme.css href so suppression behavior matches).
- **feat:** Inline favicon emblem rendered next to the "cesium" / "cesium ·
  project" eyebrow on both index pages.
- **feat:** `/favicon.ico` shim — server pre-handler serves the SVG bytes
  with `image/svg+xml` content type so browsers that auto-request the legacy
  `.ico` path don't see a 404.

## v0.3.5 — 2026-05-11

Fixes the `Publish to npm` GitHub Action.

- **fix:** Workflow now uses Node 24 (which ships with npm 11+, required for
  the OIDC trusted-publisher flow). The previous attempt used Node 22 plus an
  explicit `npm install -g npm@latest` step, which hit a `MODULE_NOT_FOUND`
  on `promise-retry` in the runner's pre-cached npm. Bundled npm 11 from
  Node 24 sidesteps the upgrade step entirely.

## v0.3.4 — 2026-05-11

Smoke test for the npm publish GitHub Action (OIDC trusted-publisher flow).
First release published from CI.

- **fix:** Removed `publishConfig.provenance: true` from `package.json`. The
  field forces `--provenance` even on local publishes, where it fails with
  `Automatic provenance generation not supported for provider: null`. The
  GitHub Action passes `--provenance` explicitly, so CI publishes still
  ship with an npm provenance attestation.
- **docs:** Bootstrap step in README "Releasing" no longer passes
  `--provenance` (it can't work locally).

## v0.3.3 — 2026-05-11

First release published to npm as **`@cfbender/cesium`**. No runtime behavior
changes; only packaging and release infrastructure.

- **packaging:** Renamed package from `cesium` to `@cfbender/cesium` (scoped,
  public). Install with `bun install -g @cfbender/cesium`. Old git-URL installs
  still work but will fall behind.
- **packaging:** Added explicit `files` allowlist to package.json — the
  published tarball ships `src/`, `assets/styleguide.html`, `agents/`, and
  `ARCHITECTURE.md` only. Tests, examples, scripts, design specs, and the
  README demo video are excluded.
- **packaging:** `engines.bun >= 1.0.0` declared (cesium runs TS directly via
  Bun; the CLI's `#!/usr/bin/env bun` shebang requires Bun on `PATH`).
- **packaging:** `prepublishOnly` runs `typecheck` + `test` before publish.
- **packaging:** `publishConfig.access = "public"` and
  `publishConfig.provenance = true` so scoped publishes work and ship with
  npm provenance attestations.
- **ci:** New `.github/workflows/publish.yml`. Triggers on `v*` tag push,
  runs typecheck + tests, verifies tag-vs-package-version match, then
  `npm publish --access public --provenance` via npm's **Trusted Publisher
  OIDC flow** — no `NPM_TOKEN` secret required. The first release is
  published manually so the package exists on the registry; subsequent
  releases are tag-triggered. See README "Releasing" for the bootstrap.
- **docs:** README install section rewritten around the npm package; mise /
  `bun update -g` upgrade flows documented; trusted-publisher bootstrap +
  release-via-tag flow documented.

## v0.3.2 — 2026-05-11

Quality-of-life patch focused on `cesium serve` reliability and README polish.

- **fix:** `cesium serve` no longer auto-shuts-down on idle. The configured
  `idleTimeoutMs` exists for the plugin's lazy-started server and was being
  unintentionally applied to foreground `cesium serve`, killing the process
  unexpectedly. Foreground serve now runs until SIGINT/SIGTERM by default.
- **new:** `cesium serve --idle-timeout DUR` opts back into auto-shutdown.
  Accepts plain milliseconds or a suffixed duration (`90s`, `30m`, `2h`).
  Use `0`, `never`, or `off` to disable explicitly.
- **internal:** `lifecycle.startIdleTimer` now treats `idleTimeoutMs <= 0` as
  "never time out" and skips creating the interval.
- **docs:** README demo asset (`assets/cesium.mp4`, ~600 KB, 720px wide)
  embedded near the top via a `<video>` tag.
- **docs:** New "Common workflows" section in the README covering forced
  publish, finding/opening artifacts, sharing, pruning, theme changes,
  server restart, and Q&A loops.
- **docs:** Acknowledgements section added.
- **tests:** 889 → 906 (+9 serve-arg parser tests, +2 lifecycle tests for
  the `idleTimeoutMs <= 0` path; the previously-skipped flaky idle-timer
  test was preserved).

## v0.3.1 — 2026-05-11

Small quality-of-life patch. The only user-visible change is the Skip button on
optional `ask_text` questions; all other v0.3.0 behavior is unchanged.

- **new:** `optional?: boolean` field on `ask_text` questions (default `false`).
  When `true`, the server accepts an empty-string answer (skipped), and the
  answered section renders a muted "(skipped)" placeholder instead of a blockquote.
- **new:** Skip button rendered alongside Submit for optional ask_text controls
  (`class="cs-skip"`), wrapped in a `class="cs-button-row"` flex container.
- **new:** Client JS `cs-skip` click handler — POSTs `{ type: "ask_text", text: "" }`
  via the same `submitAnswer` path as Submit.
- **examples:** `ask.html` "constraints" question is now `optional: true` — showcases
  the Skip button.
- **tests:** 870 → 889 (+19 new tests across validate, mutate, controls, client-js,
  theme, system-fragment).

## v0.3.0 — 2026-05-11

### Added

- **`cesium_ask`** — publish an interactive Q&A artifact and return its URL. The
  agent calls this when it needs structured input before producing a final artifact:
  design tradeoffs, plan choices, confirmation gates. Returns `{ id, filePath, fileUrl, httpUrl }`.

- **`cesium_wait`** — block until the user finishes answering all required questions.
  Polls disk every 500 ms reading the artifact's embedded `interactive.status`. Returns
  the full `answers` map once complete, expired, or cancelled.

- **New artifact kind: `"ask"`** — interactive Q&A artifacts. A single self-contained
  `.html` file that embeds the question form, client JS, and answers. Server-mutated
  atomically on each answer; crystallizes into a permanent static record once complete.
  The same file is the form, the live session, and the archive.

- **Six question types:** `pick_one` (radio group + recommended), `pick_many`
  (checkbox group + min/max), `confirm` (yes/no with custom labels), `ask_text`
  (free-text, optional multiline), `slider` (numeric range), `react` (thumbs reaction
  with optional comment).

- **Server: new `/api/*` routes** — `POST /api/sessions/<slug>/<file>/answers/<qid>`
  submits an individual answer; `GET /api/sessions/<slug>/<file>/state` returns current
  status and remaining question ids. Per-artifact file lock (`<artifactPath>.lock`).

- **`examples/ask.html`** — baked demo artifact demonstrating all six question types
  in `status: "open"` state. Open in browser to see the controls.

### Changed

- **Storage:** new `src/storage/mutate.ts` — atomic read-mutate-write for interactive
  artifacts. New `src/storage/project-summaries.ts` — `buildProjectSummaries` extracted
  from `publish.ts` and `ask.ts` into a shared module (no behavior change).

- **Render:** new `src/render/controls.ts` (question control + answered renderers) and
  `src/render/client-js.ts` (~309-line inline JS bundle for answer POSTing and UI state).
  ~210 new `.cs-*` CSS rules in `frameworkRulesCss()`.

- **Tests:** 863 → 870 (commit 1 refactor: +7 project-summaries tests). Full suite: 870
  pass (+281 new tests since v0.2.4).

## v0.2.4 — 2026-05-11

### Added

- `cesium --version` / `cesium -v` / `cesium version` — print the installed
  version. Useful for confirming what's actually running after an upgrade.

### Changed

- `claret-dark` code panels now render at `surface2` (`#2B1F22`) instead of
  recessed `#0F0509`. The recessed value gave only ~9 luminance points of
  contrast against the page bg; the elevated value reads cleanly.

## v0.2.3 — 2026-05-11

### Added

- `cesium_stop` tool. The agent can now stop the running cesium HTTP server
  from inside an opencode session via a tool call. Useful for cycling the
  server after a config change, or cleaning up at session end. Idempotent.
- `claret-dark` theme preset — dark wine background with bright rose and sage
  accents, sourced from `claret.nvim`'s dark palette.
- `claret-light` theme preset — the previous `claret` palette, renamed.

### Changed

- **Default theme is now `claret-dark`.** If you have `themePreset: "claret"`
  in `~/.config/opencode/cesium.json`, you'll now see the dark variant. Set
  `themePreset: "claret-light"` to keep the old look. The bare `"claret"` name
  is preserved as an alias for `"claret-dark"`.
- Refactored cross-process server-stop logic into `src/server/stop.ts` so the
  CLI's `cesium stop` and the new `cesium_stop` tool share the same code path.

## v0.2.2 — 2026-05-11

### Added

- `cesium stop` — kills the running cesium server cross-process via its PID
  file. Sends SIGTERM with a configurable grace period (`--timeout`, default
  3000 ms), then SIGKILL. `--force` skips the grace. Idempotent: safe when no
  server is running.
- `cesium restart` — stops then re-starts the server. Replaces the calling
  terminal with the new server (foreground, like `cesium serve`). Inherits
  serve's `--port` / `--hostname` flags.

## v0.2.1 — 2026-05-11

### Changed

- **Default theme is now `claret`** — a deep-rose-on-warm-cream palette derived
  from the claret.nvim color scheme. The previous default (`warm`) is still
  available as a preset; set `themePreset: "warm"` in `cesium.json` to keep the
  old look.

### Added

- Dynamic theme via `<stateDir>/theme.css`. Each artifact (and index page) now
  references this file via a relative `<link rel="stylesheet">`. Changing the
  configured theme and running `cesium theme apply` re-skins all linked
  artifacts on disk — file://-served artifacts fall back to their original
  inline tokens, preserving offline portability.
- `claret` theme preset.
- `cesium theme show` — print resolved theme tokens, indicate when on-disk
  theme.css is out of date.
- `cesium theme apply` — write theme.css from current config.
- `cesium theme apply --rewrite-artifacts` — retrofit existing artifacts and
  index pages on disk to reference theme.css. Adds the `<link>` tag idempotently
  to files that don't already have one.

### Architectural notes

- Inline `<style>` blocks now contain framework rules + a _fallback_ token set
  baked at publish time. The external `theme.css` overrides the fallback when
  present (CSS cascade). Standalone `.html` files still render correctly when
  opened via `file://` without the surrounding state dir.

## v0.2.0 — 2026-05-11

This is the v0.2.0 polish release. Three smaller features shipped as 0.1.3–0.1.5
(theme presets, cesium_critique, full-text search) and the standalone CLI lands
here. Use `cesium <subcommand>` from any shell.

### Added

- Standalone `cesium` CLI with subcommands:
  - `cesium ls [--all] [--json] [--limit N]` — list artifacts
  - `cesium open <id-prefix> [--print]` — open an artifact in the browser
  - `cesium serve [--port N] [--hostname H]` — run the local server in foreground
  - `cesium prune --older-than <duration> [--yes]` — delete old artifacts
- `package.json` `bin` field exposes the CLI when the plugin is installed via
  bun/opencode (linked into `node_modules/.bin/cesium`).

## v0.1.5 — 2026-05-11

### Added

- Index search now matches body text in addition to titles. Each artifact's
  rendered card carries a `data-body-text` attribute (capped at 5000 chars,
  lowercased) and the inline filter checks both fields.
- Body text is extracted at publish time via parse5 and stored on the
  `IndexEntry` shape.

### Changed

- `IndexEntry` gained a `bodyText: string` field. Existing `index.json` files
  without this field are loaded with an empty string; republishing populates it.
- Search input placeholder updated from "Filter by title…" to
  "Filter by title or content…".

## v0.1.4 — 2026-05-11

### Added

- `cesium_critique` tool. Agent can call this before publishing to get a 0-100
  score and structured findings (warn/suggest/info) about how well the body
  adheres to the design system. The system-prompt fragment now instructs
  agents to self-check on complex artifacts.

## v0.1.3 — 2026-05-11

### Added

- Four theme presets (`warm`, `cool`, `mono`, `paper`) selectable via `themePreset`
  in `~/.config/opencode/cesium.json`. `CESIUM_THEME_PRESET` env honored.
- Per-token `theme: {...}` overrides now stack on top of the chosen preset.

## v0.1.2 — 2026-05-11

### Added

- Each artifact now renders a small back-nav at the top of the body linking to
  its project's `index.html` and to the global `index.html`. Uses relative
  paths so it works the same over `http://` and `file://`.

## v0.1.1 — 2026-05-11

### Added

- `hostname` config field (default `127.0.0.1`) lets the local HTTP server bind
  to any address, including `0.0.0.0` for LAN access. `CESIUM_HOSTNAME` env var
  is honored as an override.
- Display URLs in `terminalSummary` now resolve sensibly: `127.0.0.1` becomes
  `localhost`, `0.0.0.0` becomes the first non-loopback IPv4 interface address,
  named hosts pass through verbatim. Generated http URLs are always reachable.

### Changed

- `terminalSummary` URLs now show `http://localhost:3030/...` by default
  (previously `http://127.0.0.1:3030/...`). Functionally equivalent on a single
  machine; consistent with how URLs are rendered when binding to other hosts.

## v0.1.0 — 2026-05-11

Initial release.

### Tools

- `cesium_publish` — agent-decided HTML artifact publishing with strict portability
  (no external resources), input validation, embedded JSON metadata, atomic writes,
  and revision chains via `supersedes`.
- `cesium_styleguide` — on-demand design system reference for the agent.

### Storage

- Artifacts written to `~/.local/state/cesium/projects/<project-slug>/artifacts/`.
- Project slug derived from git remote when available, else `<basename>-<6char hash>`.
- Embedded `<script type="application/json" id="cesium-meta">` is the source of truth;
  `index.json` per-project + global is a regenerated cache.
- Revision chains: `supersedes` field links a new artifact to its predecessor; the
  predecessor's metadata is patched in-place with `supersededBy`.

### Index pages

- Per-project and global `index.html` regenerated atomically on every publish.
- Inline JS for kind-filter chips, title search, and revision-chain collapsing.
- File lock at `<stateDir>/.index.lock` serializes concurrent publishes.

### Server

- Lazy-start Bun HTTP server on port 3030 (configurable). Scans 3030–3050 on conflict.
- Static file serving with proper MIME types and path-traversal defense in depth.
- Idle shutdown after 30 minutes of no requests.
- SSH detection (`$SSH_CONNECTION`) emits a `ssh -L` port-forward hint in the publish
  output.
- PID file at `<stateDir>/.server.pid` with stale-process detection.

### Design system

- Warm ivory / clay / oat palette inspired by the html-effectiveness reference.
- 16 named component classes covering typography, cards, callouts, code panels,
  timelines, diagrams, comparison and risk tables, and inline chips.
- System fonts only — no remote resources. Files are fully self-contained.

### Agent steering

- `experimental.chat.system.transform` hook injects a ~600-token system fragment
  describing the trigger heuristic (≥ 400 word threshold) and the component-class
  cheatsheet.
- Optional dedicated `@cesium` agent definition shipped at `agents/cesium.md` —
  copy into `~/.config/opencode/agents/` to invoke explicit-publish sessions.
