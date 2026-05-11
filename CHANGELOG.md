# Changelog

# Changelog

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
