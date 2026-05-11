<h1>
  <img src="assets/favicon.svg" alt="" width="48" height="48" align="left" style="margin-right: 12px; vertical-align: middle;">
  Cesium
</h1>

Cesium publishes substantive opencode agent responses — plans, code reviews,
comparisons, explainers, audits, RFCs — as self-contained beautiful HTML artifacts
on disk, instead of dumping markdown into the terminal. The browser becomes the
reading surface; the terminal stays the control surface. Each artifact is a single
`.html` file: portable, archivable, viewable offline, shareable as a URL over SSH.

v0.3.0 adds **interactive Q&A artifacts** — the agent can now publish a question
form, wait for the user to answer in their browser, and receive the structured
responses before continuing work.

<video src="assets/cesium.mp4" autoplay loop muted playsinline width="720">
  Demo video — see <a href="assets/cesium.mp4">assets/cesium.mp4</a> if it
  doesn't play inline (some markdown viewers strip <code>&lt;video&gt;</code>).
</video>

## Examples

See [`examples/plan.html`](examples/plan.html) ·
[`examples/review.html`](examples/review.html) ·
[`examples/comparison.html`](examples/comparison.html) ·
[`examples/explainer.html`](examples/explainer.html) ·
[`examples/ask.html`](examples/ask.html) for hand-curated sample
artifacts demonstrating the design system and content shapes cesium produces.
Open `examples/ask.html` in your browser to see all six interactive question
types in action (offline banner shows when opened via `file://` — that's expected).

## Install

Cesium has two pieces — the opencode **plugin** (so the agent can publish for
you) and an optional **CLI** (so you can browse/manage artifacts from any
shell). Install one or both. Cesium is published to npm as
[`@cfbender/cesium`](https://www.npmjs.com/package/@cfbender/cesium) and
requires **Bun ≥ 1.0**.

### Plugin

Add to `~/.config/opencode/opencode.json`:

```json
{
  "plugin": ["@cfbender/cesium"]
}
```

opencode installs the plugin automatically on next start. Pin a specific
release with `@cfbender/cesium@0.3.3`, or track an exact git ref with
`cesium@git+https://github.com/cfbender/cesium.git#main` (useful for
unreleased changes).

### CLI

The CLI puts a `cesium` binary on your `PATH` for browsing, opening, and
managing artifacts (`cesium ls`, `cesium open`, `cesium serve`, `cesium prune`,
`cesium theme`).

**Recommended: install with [mise](https://mise.jdx.dev/)** so cesium is pinned
in your config and tracks with the rest of your toolchain. Add to your
`~/.config/mise/config.toml` (or a project-local `mise.toml`):

```toml
[tools]
"npm:@cfbender/cesium" = "latest"
```

Then run `mise install` (or `mise use -g npm:@cfbender/cesium@latest` for the
one-liner equivalent). Pin to a specific release with `"0.3.6"` instead of
`"latest"`. Upgrade with `mise upgrade npm:@cfbender/cesium`.

**Alternative: install with bun directly:**

```bash
bun install -g @cfbender/cesium
```

This puts the binary at `~/.bun/bin/cesium`. If `which cesium` returns nothing,
add `~/.bun/bin` to your shell rc:

```bash
export PATH="$HOME/.bun/bin:$PATH"
```

Upgrade with `bun update -g @cfbender/cesium`. Uninstall with
`bun remove -g @cfbender/cesium`.

### Developing on cesium itself

If you've cloned the repo and want the CLI to follow your edits live:

```bash
cd /path/to/cesium-checkout
bun link
```

### Releasing

Cesium uses npm's **Trusted Publisher** (OIDC) flow — no long-lived `NPM_TOKEN`
secret lives in the repo. The first release is published manually; every
release after that goes out automatically when you push a `v*` tag.

**One-time bootstrap** (already done for `@cfbender/cesium`, but keep this here
for forks):

1. Log in locally: `npm login`. Make sure you have publish access to the
   `@cfbender` scope (`npm whoami`, `npm access ls-packages`).
2. Publish the first version manually so the package exists on the registry:
   ```bash
   bun run typecheck && bun test
   npm publish --access public
   ```
   _Note: no `--provenance` here. Provenance attestation requires a
   supported CI provider (GitHub Actions, GitLab CI) and fails locally with
   `Automatic provenance generation not supported for provider: null`. The
   GitHub Action handles provenance for every release after this one._
3. On [npmjs.com](https://www.npmjs.com/package/@cfbender/cesium), open
   **Settings → Trusted Publishers → Add publisher**. Choose **GitHub Actions**
   and fill in:
   - Organization or user: `cfbender`
   - Repository: `cesium`
   - Workflow filename: `publish.yml`
   - Environment: _(leave blank)_

**Every release after that:**

```bash
# bump version in package.json + add a CHANGELOG entry, then:
git commit -am "release vX.Y.Z: <summary>"
git tag -a vX.Y.Z -m "vX.Y.Z"
git push origin main vX.Y.Z
```

The `Publish to npm` GitHub Action picks up the tag, runs typecheck + tests,
verifies the tag matches `package.json`'s `version`, and publishes with npm
provenance via OIDC. The action requires `id-token: write` permission (already
configured in the workflow) — no repo secrets needed.

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

Project and global index pages have a search input that matches against title
**and** body text. Useful when you remember a phrase from an artifact but not
its title.

The agent decides per-response whether to publish, guided by a system-prompt
fragment with a ~400 word threshold and content-shape heuristics. Short factual
answers and status updates stay in the terminal. The agent may call
`cesium_critique` before `cesium_publish` to self-check the artifact's structure
and design-system adherence.

## Interactive Q&A

For decisions that need structured input before proceeding, use `cesium_ask` instead
of `cesium_publish`. The agent publishes a question form, calls `cesium_wait` with the
returned id, and receives the user's answers as soon as they're submitted in the browser.

### Question types

| Type        | Description                                                       |
| ----------- | ----------------------------------------------------------------- |
| `pick_one`  | Radio group; one selection, optional `recommended`                |
| `pick_many` | Checkbox group; optional `min`/`max` count                        |
| `confirm`   | Yes/No gate with custom button labels                             |
| `ask_text`  | Free-text input; `multiline: true` for textarea                   |
| `slider`    | Numeric range with configurable `min`/`max`/`step`/`defaultValue` |
| `react`     | Thumbs-up/down reaction with optional comment                     |

### Minimal example

```js
// In an agent tool call:
cesium_ask({
  title: "How should we ship the auth rewrite?",
  body: "<p>Answers needed before sprint kickoff.</p>",
  questions: [
    {
      type: "pick_one",
      id: "library",
      question: "Which auth library?",
      options: [
        { id: "authjs", label: "Auth.js" },
        { id: "lucia", label: "Lucia" },
      ],
      recommended: "authjs",
    },
    {
      type: "slider",
      id: "risk",
      question: "Migration risk tolerance (1–10)",
      min: 1,
      max: 10,
      defaultValue: 5,
    },
  ],
  requireAll: true,
});

// Then block until answered:
cesium_wait({ id: "<returned-id>" });
```

The artifact is a single `.html` file with inline JS that POSTs each answer to the
cesium HTTP server. Once all required questions are answered, the session crystallizes
— controls freeze, the artifact becomes a permanent record of the decision.

See `examples/ask.html` for a live demo of all six question types — open it in your
browser to see the controls (the offline banner appears when viewed via `file://`,
which is expected).

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

## Common workflows

### Force a publish for the current response

The agent decides per-response whether to publish, but you can override:

- **"/cesium"** or **"publish this"** — publish even if the response is short.
- **"in terminal"** or **"don't make a doc"** — stay in the terminal.

For sessions where you always want HTML, use the dedicated `@cesium` agent
(see [Optional: dedicated `@cesium` agent](#optional-dedicated-cesium-agent)).

### Find an old artifact

```bash
cesium ls                      # current project
cesium ls --all                # everywhere
```

Or open `http://localhost:3030/` in the browser — both the per-project and
global index pages have a search box that matches title **and** body text.
Useful when you remember a phrase but not the title.

### Open an artifact by id

The id prefix is the short suffix on each filename (e.g. `a7K9pQ`):

```bash
cesium open a7K9          # open in the browser
cesium open a7K9 --print  # just print the URL
```

### Share an artifact

Each artifact is a single self-contained `.html` file — no external resources.
Three ways to share:

- **Same machine** — copy or attach the `file://` path printed in the terminal.
- **Over SSH** — forward the port with `ssh -L 3030:localhost:3030 your-host`,
  then send the `http://localhost:3030/...` URL.
- **On a trusted LAN** — set `"hostname": "0.0.0.0"` in `cesium.json` and share
  the LAN URL. Only do this on networks you trust.

### Clean up old artifacts

```bash
cesium prune --older-than 90d         # dry run — list what would be deleted
cesium prune --older-than 90d --yes   # actually delete
```

### Change the look

Edit `~/.config/opencode/cesium.json`:

```json
{ "themePreset": "warm" }
```

Then apply it. Existing artifacts pick up the new theme on next reload via the
shared `theme.css`:

```bash
cesium theme apply
cesium theme apply --rewrite-artifacts   # only needed for artifacts pre-v0.2.1
```

### Restart the server after a config change

The HTTP server caches config at start. After editing `cesium.json`:

```bash
cesium stop
```

The next publish (or `cesium serve`) will start a fresh server with the new
config. You can also ask the agent to call `cesium_stop` directly.

### Use interactive Q&A in an agent loop

When the agent needs your input mid-task, it can publish a question artifact
with `cesium_ask`, block on `cesium_wait`, and continue once you've submitted
the form. See [Interactive Q&A](#interactive-qa) for the full flow.

## CLI

Once installed (see [Install](#install) above), the `cesium` binary is
available in any shell:

```bash
cesium ls                        # list artifacts in the current project
cesium ls --all                  # all projects
cesium ls --json                 # JSON output

cesium open <id-prefix>          # open an artifact by id prefix in the browser
cesium open abc123 --print       # print the URL instead of opening

cesium serve                     # run the local HTTP server in foreground (no idle timeout)
cesium serve --port 4000         # override the configured port
cesium serve --hostname 0.0.0.0  # bind on all interfaces
cesium serve --idle-timeout 30m  # auto-shutdown after 30 min of inactivity (default: never)

cesium stop                      # stop the running server (cross-process via PID file)
cesium stop --force              # SIGKILL immediately, skip the SIGTERM grace
cesium stop --timeout 5000       # extend grace period (default 3000ms)

cesium restart                   # stop + start in foreground; inherits serve's flags

cesium prune --older-than 90d    # dry-run: list artifacts older than 90 days
cesium prune --older-than 90d --yes  # actually delete them

cesium theme show                # print resolved theme tokens
cesium theme apply               # write theme.css from current config
cesium theme apply --rewrite-artifacts  # retrofit old artifacts with the theme link

cesium --version                 # print the cesium version (also -v or 'version')
```

The CLI shares `~/.config/opencode/cesium.json` with the plugin, so port,
state directory, hostname, and theme settings flow through.

## Configuration

Optional `~/.config/opencode/cesium.json`:

| Key             | Type   | Default                 | Description                                                                              |
| --------------- | ------ | ----------------------- | ---------------------------------------------------------------------------------------- |
| `stateDir`      | string | `~/.local/state/cesium` | Where artifacts and indexes live                                                         |
| `port`          | number | `3030`                  | First port to try for the local HTTP server                                              |
| `portMax`       | number | `3050`                  | Upper bound when scanning for free ports                                                 |
| `hostname`      | string | `127.0.0.1`             | Bind address. Use `0.0.0.0` to expose on the LAN                                         |
| `idleTimeoutMs` | number | `1800000`               | Plugin server idle-shutdown threshold (30 min). Does not apply to foreground `cesium serve` |
| `themePreset`   | string | `"claret-dark"`         | Named color palette (`claret-dark`/`claret-light`/`claret`/`warm`/`cool`/`mono`/`paper`) |
| `theme`         | object | (claret-dark palette)   | Per-token color overrides (stacked on preset)                                            |

Environment overrides: `CESIUM_PORT`, `CESIUM_STATE_DIR`, `CESIUM_HOSTNAME`, `CESIUM_THEME_PRESET`.

> **Default is `127.0.0.1` — localhost only.** Setting `hostname` to `0.0.0.0`
> binds on all interfaces, making artifacts reachable from other devices on
> your LAN. Only do this on networks you trust.

### Theme presets

Cesium ships with seven palettes:

- `claret-dark` **(default)** — deep wine bg with bright rose and sage; sourced
  from claret.nvim's dark palette.
- `claret-light` — warm cream bg with deep claret rose; the light variant of
  the claret family.
- `claret` — alias for `claret-dark` (backward compat).
- `warm` — ivory/clay/oat. Matches the html-effectiveness reference.
- `cool` — desaturated blue-grey, technical mood.
- `mono` — high-contrast black/white/grey, editorial.
- `paper` — sepia/cream, soft and book-like.

Set in `~/.config/opencode/cesium.json`:

```json
{ "themePreset": "warm" }
```

Per-token overrides (`theme: { accent: "#..." }`) apply on top of the chosen preset.

### Theme retroactivity

Cesium writes a single `<stateDir>/theme.css` containing the active theme
tokens. Each artifact references it via relative `<link>`. Change your theme
and run `cesium theme apply` — every artifact served from this state dir picks
up the new look on next reload, with no per-file rewrite.

For artifacts published before v0.2.1 (which lack the `<link>` reference),
run `cesium theme apply --rewrite-artifacts` once to retrofit them.

Standalone `.html` files (e.g. emailed) fall back to their inline-baked theme
when the external `theme.css` is unreachable — portability preserved.

## Optional: dedicated `@cesium` agent

For sessions where you always want HTML output, copy `agents/cesium.md` into
`~/.config/opencode/agents/`. Then invoke with `@cesium <request>` and the agent
will bias heavily toward publishing. The agent has access to all six tools:
`cesium_publish`, `cesium_ask`, `cesium_wait`, `cesium_styleguide`, `cesium_critique`, and `cesium_stop`.

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

Default palette: claret (`#FDF8F3`), rose accent (`#8B2252`), deep wine code panels. System fonts only (`ui-serif`, `system-ui`, `ui-monospace`) — no
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

v0.3.5 — see [`CHANGELOG.md`](CHANGELOG.md). Now published to npm as
[`@cfbender/cesium`](https://www.npmjs.com/package/@cfbender/cesium).

## Acknowledgements

Cesium took inspiration from:

- [@trq212's tweet](https://x.com/trq212/status/2052809885763747935) on
  letting agents respond with HTML instead of dumping markdown into the
  terminal — the seed idea for the whole project.
- **Octto** — for the model of an agent that publishes a live, browser-served
  surface alongside the terminal, rather than replacing it.

## License

MIT. See [`LICENSE`](LICENSE).
