# Architecture

Cesium is an opencode plugin that converts substantive agent responses into self-contained
HTML artifacts stored on disk and served locally. This document describes the architectural
decisions made for v1.

**Status: v0.1.0 shipped.** See [`CHANGELOG.md`](CHANGELOG.md) for release notes.

---

## Vision

When the agent produces something worth keeping — a plan, comparison, code review, audit,
explainer, or RFC — it generates a beautiful `.html` file instead of printing markdown to
the terminal. The artifact lives in `~/.local/state/cesium/` and can be opened in a browser,
shared over SSH, or archived as-is. The terminal remains the control surface. Each artifact
is 100% self-contained: no external stylesheets, no CDN scripts, no network required to view.

---

## Trigger model

Cesium is **agent-decided via tool call**, not automatic on every response. The plugin
injects a ~40-line system-prompt fragment (~600 tokens) into every agent session that
describes when to publish vs. stay in the terminal.

**Publish heuristics (baked into the injected prompt):**

- Response would be >= ~400 words, OR
- Contains a comparison, decision matrix, or multi-section plan/PRD/RFC, OR
- A code review with more than 3 findings, OR
- Anything the user is likely to revisit or share.

**Stay in terminal:**

- Direct factual question, short status update, mid-tool-loop chatter.

**User override always wins:** `/cesium`, "publish this", "make me an HTML report" force
publish; "just tell me", "in terminal" suppress it.

**Tie-breaker:** when uncertain, publish and emit a 2-3 line terminal summary.

---

## Tool surface

Two tools are registered by the plugin:

### `cesium_publish` (primary)

Accepts the body HTML and metadata for one artifact. The plugin owns the full HTML shell:
`<!doctype html>`, `<head>`, the inlined CSS framework, embedded metadata, and the footer
with revision links. The agent writes only the `<body>` inner HTML.

Input fields:

- `title` (string, required)
- `kind` — `"plan" | "review" | "comparison" | "report" | "explainer" | "design" | "audit" | "rfc" | "other"`
- `html` — body inner HTML
- `summary` — optional 1-2 line terminal blurb
- `tags` — optional string array
- `supersedes` — optional id of artifact this revises

Returns: `{ id, filePath, fileUrl, httpUrl, indexUrl }`

### `cesium_styleguide` (on-demand reference)

Returns the full CSS reference page as a string. Called by the agent before starting a
complex artifact. Kept separate to avoid bloating every tool call.

---

## HTML generation strategy

**Approach:** shared inline CSS framework + agent-written semantic HTML.

The plugin injects a known-good `<style>` block (~3kb) into every artifact. The agent
composes content using a named class vocabulary (documented in the tool description and
retrievable via `cesium_styleguide`). The agent may also use inline `style="..."` and
inline `<svg>` for bespoke diagrams.

**Strict portability rule:** no external resources. The scrub pass strips or rewrites:

- `<link rel="stylesheet" href="...">` — removed, comment left
- `<script src="...">` — removed, comment left
- `url(https://...)` in style — removed
- `<img src="http...">` — removed, comment left

Broken or unparseable HTML is tolerated: the file is written anyway with a warning banner
prepended. Validation errors (missing title, empty html, invalid kind) are caught before
write and returned as tool errors.

**Color tokens (default theme):**

| Token         | Value     | Role                  |
| ------------- | --------- | --------------------- |
| `--bg`        | `#FAF9F5` | ivory page background |
| `--surface`   | `#FFFFFF` | card/panel surface    |
| `--surface-2` | `#F0EEE6` | secondary surface     |
| `--oat`       | `#E3DACC` | muted border fill     |
| `--rule`      | `#D1CFC5` | rule / divider        |
| `--ink`       | `#141413` | primary text          |
| `--ink-soft`  | `#3D3D3A` | secondary text        |
| `--muted`     | `#87867F` | placeholder / caption |
| `--accent`    | `#D97757` | clay — callout/link   |
| `--olive`     | `#788C5D` | sage — success        |
| `--code-bg`   | `#141413` | code panel bg         |
| `--code-fg`   | `#E8E6DE` | code panel fg         |

User theme overrides: `~/.config/opencode/cesium.json` → `theme` field (per-token overrides
stack on top of the active preset). Four named presets are shipped (`warm`, `cool`, `mono`,
`paper`) selectable via `themePreset` — see README for the full preset reference.

**Type stack:** system fonts only (`ui-serif`, `system-ui`, `ui-monospace`) — strict
portability requires no remote font loads.

**Named component classes the agent uses:**
`.eyebrow`, `.h-display`, `.h-section`, `.section-num`, `.card`, `.tldr`, `.callout`,
`.code`, `.timeline`, `.diagram`, `.compare-table`, `.risk-table`, `.kbd`, `.pill`,
`.tag`, `.byline`

---

## Storage layout

```
~/.local/state/cesium/
├── index.html                              # global cross-project index
├── index.json                              # global cache (rebuilt on every publish)
└── projects/
    └── <project-slug>/
        ├── index.html                      # per-project index
        ├── index.json                      # per-project cache
        └── artifacts/
            ├── 2026-05-11T14-22-09Z__plan-auth-rewrite__a7K9pQ.html
            └── ...
```

**Project slug derivation (priority order):**

1. Git remote `origin`, normalized: `github-com-cfb-cesium`
2. `<cwd-basename>-<6char-hash-of-absolute-path>` — prevents collisions when multiple repos
   share the same basename

**Worktrees** of one repo merge into one project directory. Branch is captured in artifact
metadata, not in the path.

**Filename:** `<iso-utc-timestamp>__<title-slug>__<6char-nanoid>.html`
Sortable, greppable, human-readable, collision-resistant.

**Metadata: dual-source.**
Each artifact embeds a `<script type="application/json" id="cesium-meta">` block — the
source of truth. The artifact is 100% self-contained; metadata travels with the file.
`index.json` is a derived cache rebuilt on every publish (not the authoritative store).

**Metadata fields:** `id`, `title`, `kind`, `summary`, `tags`, `createdAt`, `model`,
`sessionId`, `projectSlug`, `projectName`, `cwd`, `worktree`, `gitBranch`, `gitCommit`,
`supersedes?`, `supersededBy?`, `contentSha256`

---

## Index & serving

**Index:** per-project and global `index.html` regenerated atomically on every publish.
Lists artifacts grouped by week, with kind filter chips, inline title search (tiny inline
JS), and revision-chain collapsing (latest version visible by default). Pre-rendered — works
without the server (archivable, rsync-friendly).

**Server:** lazy auto-start, single global process, port 3030 (increments to 3031..3050 if
busy).

- Bun HTTP server bound to `127.0.0.1:3030`, rooted at `~/.local/state/cesium/`.
- Starts on first publish in an opencode session.
- Idle-shuts after 30 minutes of no requests (configurable via `cesium.json`).
- PID file at `~/.local/state/cesium/.server.pid`. Stale PID detected and cleared on startup.
- SIGTERM handler for clean shutdown.
- SSH detection: if `$SSH_CONNECTION` is set, publish output reminds the user to forward
  the port. Server does NOT bind to `0.0.0.0` by default.

**Terminal output after publish:**

```
Cesium · Auth design (plan)
  http://localhost:3030/projects/github-com-cfb-cesium/artifacts/...
  file:///Users/cfb/.local/state/cesium/...
```

---

## Revision chains

When `cesium_publish` receives a `supersedes` id:

1. New artifact is written with `supersedes` populated.
2. Previous artifact's embedded metadata is patched in-place: `supersededBy` field added.
   Visual content is untouched.
3. Index renders the chain: "v3 of auth design (revises v2, v1)".

---

## v1 build phases

| Phase | Scope                                                                              | Status  |
| ----- | ---------------------------------------------------------------------------------- | ------- |
| 0     | Scaffolding, configs, docs, empty stubs                                            | shipped |
| 1     | Storage + render core (paths, write, theme, wrap, scrub, validate)                 | shipped |
| 2     | `cesium_publish` + `cesium_styleguide` tools, plugin entry, system prompt fragment | shipped |
| 3     | Per-project + global `index.html` generation, file lock, revision chains           | shipped |
| 4     | Lazy auto-server, port-scan, idle shutdown, SSH detection                          | shipped |
| 5     | Reference examples, dedicated agent definition, release polish                     | shipped |
