# Changelog

# Changelog

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
