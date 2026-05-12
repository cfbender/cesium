# Agents

This file is for AI assistants working on the cesium codebase.

---

## Project layout

```
cesium/
├── src/
│   ├── index.ts          # opencode plugin entry — registers tools + injects prompt fragment
│   ├── config.ts         # config loader (~/.config/opencode/cesium.json)
│   ├── tools/
│   │   ├── publish.ts    # cesium_publish tool handler (html or blocks)
│   │   ├── ask.ts        # cesium_ask tool handler
│   │   ├── styleguide.ts # cesium_styleguide tool handler (catalog-driven)
│   │   └── critique.ts   # cesium_critique tool handler (mode-aware)
│   ├── render/
│   │   ├── theme.ts      # CSS framework + color tokens (source of truth for theme.css)
│   │   ├── wrap.ts       # assembles full document; links /theme.css + inline fallback
│   │   ├── fallback.ts   # ~8 lines of inline CSS for standalone-readable artifacts
│   │   ├── scrub.ts      # external-resource stripper; only used on escape-hatch payloads
│   │   ├── validate.ts   # validates publish input (html branch + blocks branch)
│   │   ├── critique.ts   # mode-aware findings
│   │   └── blocks/       # structured-block renderers (the closed union)
│   │       ├── index.ts  # dispatcher
│   │       ├── types.ts  # Block discriminated union
│   │       ├── catalog.ts# source of truth: meta + schema + example per block type
│   │       ├── markdown.ts # owned markdown subset (~80 lines, no dependency)
│   │       ├── escape.ts # html-escape helpers
│   │       ├── render.ts # renderBlocks(blocks, ctx)
│   │       └── renderers/# one file per block type
│   ├── storage/
│   │   ├── paths.ts      # derives state dir, project slug, filenames
│   │   ├── write.ts      # atomic file write (tmp → rename)
│   │   ├── assets.ts     # ensureThemeCss — materializes /theme.css in state dir
│   │   ├── index-cache.ts# reads/writes index.json cache
│   │   ├── index-gen.ts  # generates index.html from cache
│   │   └── lock.ts       # file-lock around index writes
│   ├── server/
│   │   ├── http.ts       # Bun HTTP server (127.0.0.1:3030, rooted at state dir)
│   │   └── lifecycle.ts  # lazy start, idle shutdown, PID file management
│   └── prompt/
│       └── system-fragment.md  # injected into agent sessions with cesium tools
├── assets/               # static assets shipped with the plugin (theme.css source, etc.)
├── examples/             # hand-written reference HTML artifacts
├── test/                 # bun test files
├── .specs/               # GITIGNORED scratch — design synthesis lives here per refactor
├── package.json
├── tsconfig.json
├── .oxlintrc.json
└── .gitignore
```

---

## Common commands

```bash
bun install           # install dependencies
bun test              # run test suite
bun run typecheck     # tsc --noEmit
bun run lint          # oxlint
bun run format        # oxfmt .
bun run format:check  # oxfmt --check . (CI-friendly)
```

---

## Code style

- **TypeScript strict mode.** `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, and
  `noImplicitOverride` are all on.
- **Never use** `as any`, `@ts-ignore`, or `@ts-expect-error`. If the types don't fit, fix
  the types. `oxlint` enforces this.
- **Toolchain:** `oxlint` for linting, `oxfmt` for formatting. Both are part of the OXC
  project (Rust-based, fast). Default oxfmt style: 2-space indent, double quotes, trailing
  commas, semicolons, 100-character line width (configured implicitly via oxfmt defaults
  and `package.json`).
- **ESM only.** `"type": "module"` in package.json. Use `.ts` extensions in imports
  (`import { foo } from "./foo.ts"`).

---

## Commit style

Short, imperative, lowercase first word, no emoji. Examples:

- `scaffold cesium v1 plugin project`
- `add storage write with atomic rename`
- `fix idle shutdown timer not resetting on request`

---

## Design reference

Design synthesis docs live in `.specs/` (gitignored, not checked in). Read the latest one
before working on any non-trivial feature.

- `.specs/2026-05-11-cesium-design.md` — original v1 design.
- `.specs/2026-05-12-cesium-block-mode.md` — current refactor: structured `blocks` input
  alongside legacy `html`, server-served `theme.css` with inline fallback, mode-aware
  critique, catalog-driven styleguide.

Each phase of the build corresponds to one commit/PR; check the git log for the phased
history.

---

## Architecture

### Two input modes

`cesium_publish` accepts either `html: string` (escape valve / legacy) **or**
`blocks: Block[]` (preferred). Exactly one is required; the runtime XOR is enforced in
`src/render/validate.ts`.

`blocks` is a closed discriminated union (see `src/render/blocks/types.ts`). The server
templates known block types into HTML; raw HTML lives in dedicated escape-hatch block
types (`raw_html`, `diagram`) whose payload is scrubbed but whose template wrapper is
trusted. Adding a new block type is a deliberate code change: types + renderer + catalog
entry + tests.

`cesium_ask` is unchanged — it is already tool-call-driven (questions array → server-
templated controls). The freeform body field stays as-is.

### Catalog as source of truth

`src/render/blocks/catalog.ts` re-exports a `meta` object from each renderer module,
holding `{ type, description, schema, example }`. The schema validator, the styleguide
tool, and the renderer dispatcher all consume this catalog. A test asserts the union,
the catalog, and the examples are in sync. Never duplicate block descriptions across
files; always reference catalog entries.

### CSS serving

The framework CSS lives at `<state-dir>/theme.css`, served by the cesium HTTP server.
It is materialized atomically by `src/storage/assets.ts:ensureThemeCss` on lifecycle
start and on each publish, iff the bundled hash differs from the on-disk hash. Each
artifact links `/theme.css` and inlines a small fallback (~8 lines, `src/render/fallback.ts`)
so a standalone-opened `.html` file is still readable. The polished look comes from the
served stylesheet.

---

## Key invariants

- **No external network resources.** Generated HTML must never reference `http://` or
  `https://` URLs for stylesheets, scripts, fonts, or images. The scrub pass in
  `src/render/scrub.ts` enforces this. The local `/theme.css` link is allowed and is the
  only stylesheet reference.
- **Templated output is trusted.** `scrub.ts` runs only on legacy `html`-mode bodies
  and on the payload of escape-hatch blocks (`raw_html.html`, `diagram.svg`,
  `diagram.html`). Never re-scrub the assembled body produced by the block dispatcher.
- **Closed block union.** `Block` in `src/render/blocks/types.ts` is the canonical list.
  Validation rejects unknown `type` strings. Anything not expressible as a known block
  belongs in `raw_html` (with a `purpose` string for the audit trail).
- **Atomic writes:** all file writes go through `src/storage/write.ts` (tmp → rename).
  Never write directly to the final path. This includes `theme.css`.
- **Metadata travels with the file:** the `<script type="application/json" id="cesium-meta">`
  block inside each artifact is the source of truth. `index.json` is a derived cache.
  Old artifacts written under earlier designs (with full inline CSS) remain self-contained
  forever; never rewrite them.
- **Server binds to 127.0.0.1 only** by default. Do not change this without a config flag.
