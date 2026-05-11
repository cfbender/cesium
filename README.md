# Cesium

Cesium publishes substantive opencode agent responses — plans, code reviews,
comparisons, explainers, audits, RFCs — as self-contained beautiful HTML artifacts
on disk, instead of dumping markdown into the terminal. The browser becomes the
reading surface; the terminal stays the control surface. Each artifact is a single
`.html` file: portable, archivable, viewable offline, shareable as a URL over SSH.

## Examples

See [`examples/plan.html`](examples/plan.html) ·
[`examples/review.html`](examples/review.html) ·
[`examples/comparison.html`](examples/comparison.html) ·
[`examples/explainer.html`](examples/explainer.html) for hand-curated sample
artifacts demonstrating the design system and content shapes cesium produces.

## Install

Add to `~/.config/opencode/opencode.json`:

```json
{
  "plugin": ["cesium@git+https://github.com/cfbender/cesium.git"]
}
```

opencode installs the plugin automatically on next start. No additional setup
required.

## How it works

When the agent has something substantive to say, it calls the `cesium_publish` tool
instead of replying with markdown. The plugin then:

1. Validates the input and scrubs any external resources from the HTML body.
2. Wraps the body in a `<!doctype html>` shell with the inlined design-system CSS
   and embedded JSON metadata.
3. Atomically writes the artifact to `~/.local/state/cesium/projects/<slug>/artifacts/`.
4. Updates the per-project and global `index.html` listings.
5. Lazy-starts a local HTTP server on port 3030.
6. Returns a short terminal summary with both `http://` and `file://` URLs.

The agent decides per-response whether to publish, guided by a system-prompt
fragment with a ~400 word threshold and content-shape heuristics. Short factual
answers and status updates stay in the terminal.

## Where artifacts live

Default: `~/.local/state/cesium/`. Layout:

```
~/.local/state/cesium/
├── index.html              # global cross-project index
├── index.json              # global cache
└── projects/
    └── <project-slug>/
        ├── index.html      # per-project index
        ├── index.json      # per-project cache
        └── artifacts/
            └── 2026-05-11T14-22-09Z__plan-auth__a7K9pQ.html
```

Project slug is derived from `git remote origin` when available
(`github-com-cfbender-cesium`), otherwise from the directory basename plus a short
hash of the absolute path.

## Viewing artifacts

When the agent publishes, it prints a terminal summary like:

```
Cesium · Auth design rewrite (plan)
  http://localhost:3030/projects/github-com-cfbender-acme/artifacts/...
  file:///Users/cfb/.local/state/cesium/projects/.../...html
```

Open either URL in your browser. The local server starts lazily on first publish
in a session and shuts down after 30 minutes of inactivity.

### SSH / remote dev containers

The server binds to `127.0.0.1` only — safe by default. To view artifacts from a
remote machine, forward the port:

```
ssh -L 3030:localhost:3030 your-host
```

Then open `http://localhost:3030/` on your local machine. Cesium prints this hint
automatically when it detects `$SSH_CONNECTION`.

## Configuration

Optional `~/.config/opencode/cesium.json`:

| Key             | Type   | Default                      | Description                                        |
| --------------- | ------ | ---------------------------- | -------------------------------------------------- |
| `stateDir`      | string | `~/.local/state/cesium`      | Where artifacts and indexes live                   |
| `port`          | number | `3030`                       | First port to try for the local HTTP server        |
| `portMax`       | number | `3050`                       | Upper bound when scanning for free ports           |
| `hostname`      | string | `127.0.0.1`                  | Bind address. Use `0.0.0.0` to expose on the LAN   |
| `idleTimeoutMs` | number | `1800000`                    | Server idle-shutdown threshold (30 min)            |
| `themePreset`   | string | `"warm"`                     | Named color palette (`warm`/`cool`/`mono`/`paper`) |
| `theme`         | object | (default ivory / clay / oat) | Per-token color overrides (stacked on preset)      |

Environment overrides: `CESIUM_PORT`, `CESIUM_STATE_DIR`, `CESIUM_HOSTNAME`, `CESIUM_THEME_PRESET`.

> **Default is `127.0.0.1` — localhost only.** Setting `hostname` to `0.0.0.0`
> binds on all interfaces, making artifacts reachable from other devices on
> your LAN. Only do this on networks you trust.

### Theme presets

Cesium ships with four palettes:

- `warm` (default) — ivory/clay/oat. Matches the html-effectiveness reference.
- `cool` — desaturated blue-grey, technical mood.
- `mono` — high-contrast black/white/grey, editorial.
- `paper` — sepia/cream, soft and book-like.

Set in `~/.config/opencode/cesium.json`:

```json
{ "themePreset": "paper" }
```

Per-token overrides (`theme: { accent: "#..." }`) apply on top of the chosen preset.

## Optional: dedicated `@cesium` agent

For sessions where you always want HTML output, copy `agents/cesium.md` into
`~/.config/opencode/agents/`. Then invoke with `@cesium <request>` and the agent
will bias heavily toward publishing.

## Design system

The full visual reference is at [`assets/styleguide.html`](assets/styleguide.html),
also available to the agent on demand via the `cesium_styleguide` tool.

Component classes:

- `.eyebrow` `.h-display` `.h-section` `.section-num` — typography & section headers
- `.card` `.tldr` `.callout` (`.note` / `.warn` / `.risk`) — bounded surfaces & asides
- `.code` (with `.kw` `.str` `.cm` `.fn` highlights) — code panels
- `.timeline` `.diagram` — milestone lists & inline-SVG figures
- `.compare-table` `.risk-table` — structured grids
- `.kbd` `.pill` `.tag` `.byline` — inline chips & artifact footer

Default palette: warm ivory (`#FAF9F5`), clay (`#D97757`), oat (`#E3DACC`), ink
(`#141413`). System fonts only (`ui-serif`, `system-ui`, `ui-monospace`) — no
remote font loads, ever.

## Architecture

See [`ARCHITECTURE.md`](ARCHITECTURE.md) for the full design: trigger model, tool
surface, storage layout, server lifecycle, revision chains.

## Development

```bash
bun install
bun test                  # run test suite
bun run typecheck         # tsc --noEmit
bun run lint              # oxlint
bun run format            # oxfmt .
bun run examples:bake     # regenerate examples/*.html from src
```

## Status

v0.1.0 — initial release. See [`CHANGELOG.md`](CHANGELOG.md).

## License

MIT. See [`LICENSE`](LICENSE).
